import type { APIRoute } from "astro";
// modules folder contains files for common operations
import { getLogger, logWrapper } from "../../lib/modules/pino-logger";
import { CF_WEBHOOK_SECRET } from "astro:env/server";

// We use drizzle for typesafe db access
// import { createDb } from "../../lib/db/drizzle";
// import { users, bookedRooms } from "../../lib/db/schema";
// import { eq, and } from "drizzle-orm";


export const prerender = false;
const logger = getLogger();

export const POST: APIRoute = async (c) => {
  return await logWrapper(c, WorkerHandler)
}

/**
 * This is just a reference API, so don't do anything here.
 *
 * Let's get the Bearer and any body for this request,
 * then return a 404 error.
 */
const WorkerHandler: APIRoute = async ({ request, locals }) => {
    try {
      const authHeader = request.headers.get("Authorization");
      const secretToken = authHeader?.replace("Bearer ", "");

      // Verify secret token using Astro env
      if (!secretToken || secretToken !== CF_WEBHOOK_SECRET) {
        logger.error("Invalid or missing authentication token");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
  
      // Parse the request body
      interface CustomRequestBody {
        hello?: string;
        world?: string;
      }
  
      let requestBody: CustomRequestBody;
      try {
        requestBody = (await request.json()) as CustomRequestBody;
      } catch (e) {
        logger.error(e, "Invalid JSON in request body:");
        // Typically return an error Response here.
      }
  
      // We are in a Cloudflare Worker
      locals.runtime.ctx.waitUntil(
        Promise.resolve().then(() => {
          logger.info({
            requestBody,
            secretToken,
            authHeader
          }, "API request details logged");
        })
      )
      // locals.runtime.env.KV.get("something")
      return new Response(null, { status: 404 });
    } catch (e) {
      logger.error(e, "Error handling this API:");
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
