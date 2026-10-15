#!/usr/bin/env node
/**
 * Runs the whole register on one computer, with no Vercel and no account.
 *
 * The deployed app serves `dist/` as static files and each file under `api/`
 * as a function; this does exactly the same two things with Node's own http
 * server, so the handlers that run here are the ones that would run there.
 *
 *   npm run build
 *   npm start
 *
 * See docs/OPERATIONS.md for keeping it running and for backups, which the
 * cloud scheduler would otherwise have taken care of.
 */

import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const API = join(ROOT, 'api');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

/**
 * Walks api/ and maps each file to the route the cloud would serve it at, so a
 * new endpoint works here without anyone remembering to register it.
 */
async function loadRoutes(directory = API) {
  const routes = new Map();
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return routes;
  }

  for (const entry of entries) {
    const full = join(directory, entry.name);
    // Vercel ignores paths beginning with an underscore; so does this.
    if (entry.name.startsWith('_')) continue;
    if (entry.isDirectory()) {
      for (const [route, handler] of await loadRoutes(full)) routes.set(route, handler);
      continue;
    }
    if (!entry.name.endsWith('.js')) continue;

    const route = `/api/${relative(API, full).split(sep).join('/')}`.replace(/\.js$/, '');
    const module = await import(pathToFileURL(full).href);
    if (typeof module.default === 'function') routes.set(route, module.default);
  }

  return routes;
}

async function serveStatic(req, res, pathname) {
  // Anything that is not a real file is the single-page app, which does its
  // own routing - the same rewrite the deployed vercel.json performs.
  let file = resolve(join(DIST, pathname));
  if (!file.startsWith(DIST)) file = join(DIST, 'index.html'); // no escaping dist/
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(DIST, 'index.html');
  }

  let body;
  try {
    body = await readFile(file);
  } catch {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end(
      'The app has not been built yet. Run "npm run build" in fee-app, then start this again.'
    );
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', CONTENT_TYPES[extname(file)] ?? 'application/octet-stream');
  // The same headers vercel.json sets, so behaviour does not differ by host.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (file.endsWith('index.html')) res.setHeader('Cache-Control', 'no-store');
  return res.end(body);
}

export async function createFeeAppServer() {
  const routes = await loadRoutes();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

    if (url.pathname.startsWith('/api/')) {
      const handler = routes.get(url.pathname);
      if (!handler) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ error: 'Not found.', code: 'no_such_endpoint' }));
      }
      try {
        return await handler(req, res);
      } catch (error) {
        // handler() already catches its own; this is the last line of defence
        // so one bad request cannot take the whole server down.
        console.error('Unhandled error in', url.pathname, error);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        return res.end(JSON.stringify({ error: 'Something went wrong.', code: 'internal_error' }));
      }
    }

    return serveStatic(req, res, url.pathname);
  });

  return { server, routes };
}

/**
 * Says plainly whether the spreadsheet can be reached, at startup.
 *
 * Without this, a mistyped key shows up as "something went wrong" on the
 * sign-in screen with nothing to go on - and unlike the cloud there is no
 * deployment log to go and read. Never fatal: a sheet that is unreachable now
 * may be reachable in a minute, and the server coming up is not the problem.
 */
async function reportConfiguration() {
  let title;
  try {
    // Reachability first. Checking the tabs before this would report the one
    // credential problem once per tab, and suggest repairing a spreadsheet
    // that was never opened.
    const { getSpreadsheet } = await import('./api/_lib/google.js');
    const meta = await getSpreadsheet('properties.title');
    title = meta.properties?.title ?? '(untitled)';
  } catch (error) {
    console.log('   Spreadsheet  COULD NOT BE REACHED');
    console.log(`                ${error.message}`);
    console.log('                Check .env.local against docs/SETUP.md.');
    return;
  }

  try {
    const { verifySchema } = await import('./api/_lib/table.js');
    const problems = await verifySchema();
    if (problems.length === 0) {
      console.log(`   Spreadsheet  connected - "${title}"`);
      return;
    }
    // Reachable, so this really is about its tabs and columns.
    console.log(`   Spreadsheet  "${title}" needs repair`);
    for (const problem of problems) console.log(`                - ${problem}`);
    console.log('                Run: npm run bootstrap-sheet');
  } catch (error) {
    console.log(`   Spreadsheet  "${title}" could not be read`);
    console.log(`                ${error.message}`);
  }
}

// Only when run as a command, so tests can start it themselves.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const host = process.env.HOST ?? '127.0.0.1';
  const { server, routes } = await createFeeAppServer();

  server.listen(port, host, () => {
    console.log('S.N.S. Shiksha Niketan - fee register');
    console.log(`   Serving on   http://localhost:${port}`);
    console.log(`   Endpoints    ${routes.size}`);
    if (host === '127.0.0.1') {
      console.log('   Reachable from this computer only. See docs/OPERATIONS.md to open it');
      console.log('   to the rest of the school network.');
    } else {
      console.log(`   Listening on ${host} - other devices on the network can reach it.`);
    }
    reportConfiguration().then(() => console.log('\n   Press Ctrl+C to stop.'));
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      console.log('\nStopping.');
      server.close(() => process.exit(0));
    });
  }
}
