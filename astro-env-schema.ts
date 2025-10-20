
import { envField } from "astro/config";

type EnvSchema = Record<string, 
        ReturnType<typeof envField.string>
        | ReturnType<typeof envField.number>
        | ReturnType<typeof envField.boolean>
        | ReturnType<typeof envField.enum>
    >

const publicString = envField.string({
    context: "client",
    access: "public",
});

const privateString = envField.string({
    context: "server",
    access: "secret",
});

// Maintain client and server separately in alphabetical order
const schema: EnvSchema = {
    // Client-side environment variables (PUBLIC_*)
    PUBLIC_BREVO_WEBHOOK_URL: publicString,
    PUBLIC_CF_ENV: envField.enum({
        context: 'client',
        access: "public",
        values: ['staging', 'production']
    }),
    PUBLIC_KC_HOSTNAME: publicString,
    PUBLIC_PADDLE_CLIENT_TOKEN: publicString,
    PUBLIC_PADDLE_ORGANIZATION_PRICE_ID: publicString,
    PUBLIC_PADDLE_PREMIUM_PRICE_ID: publicString,
    PUBLIC_PADDLE_PRICE_ID: publicString,

    // Server-side secret environment variables
    BREVO_API_KEY: privateString,
    CF_WEBHOOK_SECRET: privateString,
    DB_HOST: privateString,
    DB_NAME: privateString,
    DB_PASSWORD: privateString,
    DB_PORT: envField.number({
        context: "server",
        access: "secret",
        default: 5432,
    }),
    DB_USER: privateString,
    DISCORD_BOT_TOKEN: privateString,
    DISCORD_PUBLIC_KEY: privateString,
    FILE_SHARING_JWT_PUBLIC_KEY: privateString,
    GRAFANA_API_KEY: privateString,
    GRAFANA_USERNAME: privateString,
    KC_CLIENT_ID: privateString,
    KC_CLIENT_SECRET: privateString,
    KC_WEBHOOK_SECRET: privateString,
    PADDLE_API_KEY: privateString,
    PADDLE_WEBHOOK_SECRET: privateString,
    POSTHOG_API_KEY: privateString,
    S3_ACCESS_KEY_ID: privateString,
    S3_BUCKET: privateString,
    S3_ENDPOINT: privateString,
    S3_SECRET_ACCESS_KEY: privateString,
}

export default schema;