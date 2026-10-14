import { SignJWT, jwtVerify } from 'jose';
import { getEnv } from './env.js';

/**
 * Sessions are a signed JWT carried in an httpOnly cookie.
 *
 * httpOnly keeps it out of reach of any script on the page, so an XSS bug
 * cannot steal a session the way it could read localStorage. SameSite=Strict
 * means the cookie is not sent on cross-site requests at all, which is what
 * blocks CSRF against the write endpoints.
 */

export const COOKIE_NAME = 'sns_fee_session';
export const SESSION_HOURS = 8;

let keyCache = null;
function key() {
  if (!keyCache) keyCache = new TextEncoder().encode(getEnv().sessionSecret);
  return keyCache;
}

/**
 * `pwd_at` pins the session to the password that was current when it was
 * issued, so an admin resetting someone's password immediately invalidates
 * that person's existing sessions.
 */
export async function signSession({ user_id, username, role, pwd_at }) {
  return new SignJWT({ username, role, pwd_at: pwd_at ?? '' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user_id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key());
}

export async function verifySession(token) {
  const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
  return {
    user_id: payload.sub,
    username: payload.username,
    role: payload.role,
    pwd_at: payload.pwd_at ?? '',
  };
}

export function readCookie(req, name = COOKIE_NAME) {
  const header = req.headers?.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return null;
}

function serialize(value, maxAgeSeconds) {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    // Browsers treat http://localhost as a secure context, so this is safe in dev too.
    'Secure',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
  ].join('; ');
}

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', serialize(token, SESSION_HOURS * 60 * 60));
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', serialize('', 0));
}
