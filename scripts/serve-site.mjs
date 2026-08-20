#!/usr/bin/env node

import { createServer } from 'node:http';
import { access, readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const [rootArgument, portArgument] = process.argv.slice(2);
if (!rootArgument || !portArgument || !/^\d+$/u.test(portArgument)) {
  throw new Error('Aufruf: node scripts/serve-site.mjs <output-root> <port>');
}

const root = resolve(process.cwd(), rootArgument);
const port = Number(portArgument);
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.csv', 'text/csv; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.ics', 'text/calendar; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.xml', 'application/xml; charset=utf-8'],
]);

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function compileRedirect(source, target, status) {
  const names = [];
  let pattern = source.replace(/[.+?^${}()|[\]\\]/gu, '\\$&');
  pattern = pattern.replace(/:([a-zA-Z][a-zA-Z0-9_]*)/gu, (_match, name) => {
    names.push(name);
    return '([^/]+)';
  });
  pattern = pattern.replace(/\*/gu, () => {
    names.push('splat');
    return '(.*)';
  });
  return { regex: new RegExp(`^${pattern}$`, 'u'), names, target, status: Number(status) };
}

let redirects = [];
const redirectsPath = resolve(root, '_redirects');
if (await exists(redirectsPath)) {
  redirects = (await readFile(redirectsPath, 'utf8'))
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split(/\s+/u))
    .filter((parts) => parts.length >= 3)
    .map(([source, target, status]) => compileRedirect(source, target, status));
}

const headersPath = resolve(root, '_headers');
const headers = await readFile(headersPath, 'utf8');
const buildCommit = headers.match(/X-Portal-Commit:\s*([0-9a-f]{40})/iu)?.[1];

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
    for (const redirect of redirects) {
      const match = redirect.regex.exec(url.pathname);
      if (!match) continue;
      let location = redirect.target;
      redirect.names.forEach((name, index) => {
        location = location.replaceAll(`:${name}`, match[index + 1] ?? '');
      });
      response.writeHead(redirect.status, { location });
      response.end();
      return;
    }

    const pathname = decodeURIComponent(url.pathname);
    const requestedPath = resolve(root, `.${pathname}`);
    if (requestedPath !== root && !requestedPath.startsWith(`${root}${sep}`)) {
      response.writeHead(400).end('Bad Request');
      return;
    }

    const candidates = pathname.endsWith('/')
      ? [resolve(requestedPath, 'index.html')]
      : [requestedPath, `${requestedPath}.html`, resolve(requestedPath, 'index.html')];
    const filePath = (await Promise.all(candidates.map(async (candidate) => [candidate, await exists(candidate)])))
      .find(([, available]) => available)?.[0];
    const finalPath = filePath ?? resolve(root, '404.html');
    const body = await readFile(finalPath);
    response.statusCode = filePath ? 200 : 404;
    response.setHeader('content-type', mimeTypes.get(extname(finalPath)) ?? 'application/octet-stream');
    if (buildCommit) response.setHeader('x-portal-commit', buildCommit);
    if (request.method === 'HEAD') response.end();
    else response.end(body);
  } catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(error instanceof Error ? error.message : 'Serverfehler');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Static preview: http://127.0.0.1:${port}`);
});
