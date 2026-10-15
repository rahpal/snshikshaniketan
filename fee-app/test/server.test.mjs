import test from 'node:test';
import assert from 'node:assert/strict';

import { FakeSpreadsheet, installEnv, installFetch } from './helpers/fake-sheets.mjs';

installEnv();

const { createFeeAppServer } = await import('../server.mjs');
const { createUser, setPassword, findUserByUsername } = await import('../api/_lib/users.js');
const { invalidate } = await import('../api/_lib/table.js');
const { resetAuthCache } = await import('../api/_lib/google.js');
const { resetThrottle } = await import('../api/_lib/throttle.js');

const PASSWORD = 'SchoolFee2026';

/**
 * Starts the real local server on a free port and talks to it over real HTTP,
 * so what is tested is the way the school will actually run this - not a
 * handler called directly.
 */
async function withServer(run) {
  const sheet = new FakeSpreadsheet();
  const restore = installFetch(sheet);
  invalidate();
  resetAuthCache();
  resetThrottle();

  const { server, routes } = await createFeeAppServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    return await run({ base, sheet, routes });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    restore();
    invalidate();
  }
}

test('every API endpoint is found by walking the api directory', async () => {
  await withServer(async ({ routes }) => {
    // A new endpoint must work without anyone registering it by hand.
    for (const route of [
      '/api/auth/login',
      '/api/auth/me',
      '/api/payments/create',
      '/api/payments/void',
      '/api/reports/classwise',
      '/api/admin/users/create',
      '/api/cron/backup',
    ]) {
      assert.ok(routes.has(route), `${route} should be routed`);
    }

    // Shared code under api/_lib is not an endpoint.
    assert.ok(![...routes.keys()].some((route) => route.includes('_lib')));
  });
});

test('signing in over real HTTP works, cookie and all', async () => {
  await withServer(async ({ base }) => {
    await createUser({
      username: 'bkpal',
      full_name: 'BK Pal',
      role: 'admin',
      password: PASSWORD,
      created_by: 'test',
    });
    await setPassword(await findUserByUsername('bkpal', { fresh: true }), PASSWORD);

    const response = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ username: 'bkpal', password: PASSWORD }),
    });

    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /sns_fee_session=/);
    assert.match(cookie, /HttpOnly/);

    // And that cookie identifies the user on the next request.
    const me = await fetch(`${base}/api/auth/me`, {
      headers: { Cookie: cookie.split(';')[0] },
    });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.username, 'bkpal');
  });
});

test('an unknown endpoint is a clean 404, not a crash', async () => {
  await withServer(async ({ base }) => {
    const response = await fetch(`${base}/api/nope/at/all`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, 'no_such_endpoint');
  });
});

test('a request body is read from the stream, since nothing parses it here', async () => {
  await withServer(async ({ base }) => {
    // Vercel hands handlers a parsed body; this server does not, so the
    // fallback in readBody is what makes local hosting work at all.
    const response = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ username: '', password: '' }),
    });
    const data = await response.json();
    assert.equal(response.status, 400);
    assert.equal(data.code, 'validation_failed');
    assert.ok(data.details.username);
  });
});

test('the app itself is served, and unknown paths fall back to it', async () => {
  await withServer(async ({ base }) => {
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    const html = await page.text();
    assert.match(html, /<div id="root">/);

    // A deep link is the app's to route, not a 404.
    const deep = await fetch(`${base}/classwise`);
    assert.equal(deep.status, 200);
    assert.match(await deep.text(), /<div id="root">/);

    // And the built assets it asks for are really there.
    const asset = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
    assert.ok(asset, 'the built page should reference a script');
    const script = await fetch(`${base}${asset}`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get('content-type'), /javascript/);
  });
});

test('the security headers the deployed app sets are set here too', async () => {
  await withServer(async ({ base }) => {
    const response = await fetch(`${base}/`);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
  });
});

test('a path cannot climb out of the built app', async () => {
  await withServer(async ({ base }) => {
    // Serving the whole disk because someone asked nicely is how local
    // hosting goes wrong.
    const response = await fetch(`${base}/../../../etc/passwd`, { redirect: 'manual' });
    const body = await response.text();
    assert.ok(!body.includes('root:'), 'must not serve files outside dist/');
  });
});
