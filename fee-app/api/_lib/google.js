import { SignJWT, importPKCS8 } from 'jose';
import { getEnv } from './env.js';

/**
 * Minimal Google Sheets client.
 *
 * The service-account flow is short enough to do directly: sign a JWT with the
 * private key, swap it for an access token, call the REST API. Doing it here
 * rather than through googleapis/google-auth-library keeps the function bundle
 * small (which matters for serverless cold starts) and means every outbound
 * call goes through fetch, so it can be intercepted in tests.
 */

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const JWT_BEARER = 'urn:ietf:params:oauth:grant-type:jwt-bearer';

let signingKey = null;
let accessToken = null; // { value, expiresAt }

async function getSigningKey() {
  if (!signingKey) {
    const { privateKey } = getEnv();
    try {
      signingKey = await importPKCS8(privateKey, 'RS256');
    } catch (error) {
      throw new Error(
        'GOOGLE_PRIVATE_KEY could not be read as a PKCS#8 private key. Check that the ' +
          `whole key is present and its newlines are escaped as \\n. (${error.message})`
      );
    }
  }
  return signingKey;
}

async function getAccessToken() {
  // Refresh a minute early so a token cannot expire mid-request.
  if (accessToken && accessToken.expiresAt > Date.now() + 60_000) return accessToken.value;

  const { serviceAccountEmail } = getEnv();
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(serviceAccountEmail)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(await getSigningKey());

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: JWT_BEARER, assertion }),
  });

  const text = await response.text();
  if (!response.ok) {
    let detail = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text);
      detail = parsed.error_description ?? parsed.error ?? detail;
    } catch {
      // keep the raw text
    }
    throw new Error(
      `Google refused the service account credentials (${response.status}): ${detail}. ` +
        'Check GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.'
    );
  }

  const data = JSON.parse(text);
  accessToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return accessToken.value;
}

/** Drops the cached token and key. Used by tests; harmless in production. */
export function resetAuthCache() {
  signingKey = null;
  accessToken = null;
}

async function request(path, { method = 'GET', query, body } = {}) {
  const { sheetId } = getEnv();
  const token = await getAccessToken();

  const url = new URL(`${SHEETS_API}/${sheetId}${path}`);
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(name, String(value));
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  if (!response.ok) {
    let detail = text.slice(0, 500);
    try {
      detail = JSON.parse(text)?.error?.message ?? detail;
    } catch {
      // keep the raw text
    }
    if (response.status === 403) {
      detail += ' - is the spreadsheet shared with the service account as an Editor?';
    }
    throw new Error(`Google Sheets API ${response.status} on ${method} ${path}: ${detail}`);
  }

  return text.length > 0 ? JSON.parse(text) : {};
}

/** Reads a range. Pass a bare tab name to get every populated row in it. */
export async function getValues(range) {
  const data = await request(`/values/${encodeURIComponent(range)}`, {
    query: { majorDimension: 'ROWS', valueRenderOption: 'UNFORMATTED_VALUE' },
  });
  return data.values ?? [];
}

/** Appends rows below the last populated row of the tab. */
export async function appendValues(range, values) {
  return request(`/values/${encodeURIComponent(range)}:append`, {
    method: 'POST',
    query: {
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      includeValuesInResponse: false,
    },
    body: { range, majorDimension: 'ROWS', values },
  });
}

/** Overwrites an exact range. */
export async function updateValues(range, values) {
  return request(`/values/${encodeURIComponent(range)}`, {
    method: 'PUT',
    query: { valueInputOption: 'RAW' },
    body: { range, majorDimension: 'ROWS', values },
  });
}

/** Structural changes: adding tabs, freezing rows, protecting ranges. */
export async function batchUpdate(requests) {
  return request(':batchUpdate', { method: 'POST', body: { requests } });
}

export async function getSpreadsheet(fields = 'spreadsheetId,properties.title,sheets.properties') {
  return request('', { query: { fields } });
}
