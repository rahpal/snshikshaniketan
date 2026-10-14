/**
 * Environment access. Every secret the app needs is read here and nowhere else,
 * so there is exactly one place to look when something is misconfigured.
 */

const REQUIRED = [
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'FEES_SHEET_ID',
  'SESSION_SECRET',
];

let cached = null;

export function getEnv() {
  if (cached) return cached;

  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'See fee-app/docs/SETUP.md.'
    );
  }

  const secret = process.env.SESSION_SECRET;
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 48');
  }

  cached = {
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // Env vars cannot hold real newlines, so the key is stored with literal \n.
    privateKey: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    sheetId: process.env.FEES_SHEET_ID,
    sessionSecret: secret,
    cacheTtlMs: Number.parseInt(process.env.SHEET_CACHE_TTL_SECONDS ?? '30', 10) * 1000,
  };

  return cached;
}
