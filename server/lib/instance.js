// The production app, built from environment variables (set in Vercel).
import { createApp } from "./app.js";
import { neonDb } from "./db.js";
import { resendMailer } from "./email.js";

const env = process.env;
const DATABASE_URL = env.DATABASE_URL || env.POSTGRES_URL; // the Vercel-Neon integration sets both
const missing = Object.entries({ DATABASE_URL, RESEND_API_KEY: env.RESEND_API_KEY, AUTH_SECRET: env.AUTH_SECRET })
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);

export const handle = createApp({
  db: neonDb(DATABASE_URL),
  sendEmail: resendMailer({
    apiKey: env.RESEND_API_KEY,
    // Without a verified domain, Resend only delivers to your own Resend login email.
    from: env.EMAIL_FROM || "Comment Streak <onboarding@resend.dev>",
  }),
  secret: env.AUTH_SECRET,
});
