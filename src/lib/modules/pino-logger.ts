import type { APIContext, APIRoute } from "astro";
import { PUBLIC_CF_ENV } from "astro:env/client";
import pino from "pino";

// Global log collection
let pendingLogs: any[] = [];
let flushScheduled = false;

// Create a simple base logger
const baseLogger = pino({
  level: "info",
  browser: {
    asObject: true,
    write: (_o) => {
      // This overrides the console.log call (default behavior)
    },
    transmit: {
      level: "info",
      send: (
        level: pino.Level,
        logEvent: { messages: any[]; bindings?: any[] }
      ) => {
        // Add to pending logs for batch sending
        pendingLogs.push({
          level: level, // Store the level
          messages: logEvent.messages,
          bindings: logEvent.bindings,
        });

        // Also log to console for visibility during development
        const consoleMethod = level === "fatal" ? "error" : level;
        if (console[consoleMethod]) {
          console[consoleMethod](logEvent.messages[0]);
        }
      },
    },
  },
});

/**
 * Get a logger for the current file
 * Use this in ALL files - both components and API endpoints
 *
 * @example
 * ```
 * import { getLogger } from '../components/pino-logger.js';
 * const logger = getLogger();
 *
 * export function myFunction() {
 *   logger.info('Something happened');
 * }
 * ```
 */
export function getLogger(options: { name?: string } = {}) {
  const name = options.name || getCallerFile();
  return baseLogger.child({ name });
}

/**
 * Register a Cloudflare context for pending logs
 * Call this at the top of your API handler
 *
 * @example
 * ```
 * import { getLogger, registerContext } from '../components/pino-logger.js';
 *
 * export const onRequest = async (context) => {
 *   const logger = getLogger();
 *   registerContext(context);
 *
 *   logger.info('Processing request');
 *   return new Response('Success');
 * };
 * ```
 */
export async function logWrapper(context: APIContext, next: APIRoute) {
  const result = await next(context);
  const waitUntil = context.locals.runtime.ctx.waitUntil;

  if (waitUntil && !flushScheduled) {
    flushScheduled = true;
    // Get env vars from Cloudflare runtime (available at runtime, not during build)
    const env = context.locals.runtime.env;
    waitUntil(
      flushLogs(env?.GRAFANA_USERNAME, env?.GRAFANA_API_KEY).finally(() => {
        flushScheduled = false;
      })
    );
  }

  return result;
}

/**
 * Helper to create a standard console-like logger
 * For users who prefer the console.log style API
 *
 * @example
 * ```
 * import { createConsoleLogger } from '../components/pino-logger.js';
 * const console = createConsoleLogger();
 *
 * console.log('Just like regular console.log');
 * ```
 */
export function createConsoleLogger(name?: string) {
  const logger = getLogger({ name: name || getCallerFile() });

  return {
    log: (...args: any[]) => logger.info(args[0]),
    info: (...args: any[]) => logger.info(args[0]),
    warn: (...args: any[]) => logger.warn(args[0]),
    error: (...args: any[]) => logger.error(args[0]),
    debug: (...args: any[]) => logger.debug(args[0]),
  };
}

/**
 * Send all pending logs to the OpenTelemetry collector
 * @param grafanaUsername - Grafana username from environment (passed from runtime context)
 * @param grafanaApiKey - Grafana API key from environment (passed from runtime context)
 */
async function flushLogs(grafanaUsername?: string, grafanaApiKey?: string): Promise<void> {
  // Wait a small amount of time for any final logs
  await new Promise((resolve) => setTimeout(resolve, 10));

  if (pendingLogs.length === 0) return;

  const logsToSend = [...pendingLogs];
  pendingLogs = [];

  // Skip if credentials are not available (e.g., during build or on client)
  if (!grafanaUsername || !grafanaApiKey) {
    return;
  }

  try {
    // Format logs for OpenTelemetry
    const formattedLogs = logsToSend.map((logEntry: any) => {
      // logEntry is now { level, messages, bindings }
      const message = logEntry.messages[0];
      const timestamp = new Date().toISOString();

      return {
        timestamp,
        severity: logEntry.level.toUpperCase(), // Use the stored level, converted to uppercase
        body: message,
        attributes: {
          "service.name": "cf-worker" + PUBLIC_CF_ENV === 'staging' ? "-staj" : "",
          ...logEntry.bindings?.[0], // Include child logger context from stored bindings
        },
      };
    });

    // Send logs to OpenTelemetry collector
    const response = await fetch(
      "https://otlp-gateway-prod-eu-west-2.grafana.net/otlp/v1/logs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Basic " +
            btoa(`${grafanaUsername}:${grafanaApiKey}`),
        },
        body: JSON.stringify({
          resourceLogs: [
            {
              resource: {
                attributes: [
                  {
                    key: "service.name",
                    value: { stringValue: "cloudflare-worker" },
                  },
                  {
                    key: "host.name",
                    value: { stringValue: "cloudflare-worker-runtime" },
                  },
                ],
              },
              scopeLogs: [
                {
                  scope: {
                    name: "pino-otel",
                  },
                  logRecords: formattedLogs.map((log) => ({
                    timeUnixNano: new Date(log.timestamp).getTime() * 1000000,
                    severityText: log.severity,
                    body: {
                      stringValue:
                        typeof log.body === "string"
                          ? log.body
                          : JSON.stringify(log.body),
                    },
                    attributes: Object.entries(log.attributes || {}).map(
                      ([k, v]) => ({
                        key: k,
                        value: { stringValue: String(v) },
                      })
                    ),
                  })),
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to send logs: ${response.status} ${response.statusText}`
      );
    }
  } catch (error) {
    console.error("Failed to send logs to OpenTelemetry collector:", error);
    // Put logs back in the queue for next attempt
    pendingLogs = [...logsToSend, ...pendingLogs];
  }
}

/**
 * Utility to get the caller's filename
 */
function getCallerFile(): string {
  try {
    const err = new Error();
    const stack = err.stack?.split("\n") || [];

    for (let i = 2; i < stack.length; i++) {
      const line = stack[i];
      if (line && !line.includes("pino-logger.ts")) {
        const match = line.match(
          /at\s+(?:\w+\s+\()?(?:file:|[^:]+[/\\])([^:]+)/
        );
        if (match && match[1]) {
          return match[1];
        }
      }
    }
  } catch {
    // Fallback to "unknown"
  }
  return "unknown";
}
