const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = __dirname;
const envFile = path.join(projectRoot, '.env');
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
};
const attendanceLabels = {
  yes: 'әрине, келемін',
  'plus-one': 'жұбыммен келемін',
  no: 'өкінішке орай, келе алмаймын',
};
const rateLimit = new Map();
const requestLimit = 4096;
const rateWindowMs = 60_000;
const maxRequestsPerWindow = 10;

function loadLocalEnvironment() {
  if (!fs.existsSync(envFile)) return;
  const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] in process.env) continue;
    const value = match[2].replace(/^(?:"(.*)"|'(.*)')$/, (_, doubleQuoted, singleQuoted) => (
      doubleQuoted ?? singleQuoted ?? ''
    ));
    process.env[match[1]] = value;
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
}

function getClientKey(request) {
  return request.socket.remoteAddress || 'unknown';
}

function isRateLimited(key) {
  const now = Date.now();
  const attempts = (rateLimit.get(key) || []).filter((timestamp) => now - timestamp < rateWindowMs);
  attempts.push(now);
  rateLimit.set(key, attempts);
  return attempts.length > maxRequestsPerWindow;
}

async function readRequestJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > requestLimit) {
      const error = new Error('Request is too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Invalid JSON');
    error.statusCode = 400;
    throw error;
  }
}

async function handleRsvp(request, response) {
  const requestOrigin = request.headers.origin;
  if (requestOrigin) {
    let originHost;
    try {
      originHost = new URL(requestOrigin).host;
    } catch {
      sendJson(response, 403, { ok: false });
      return;
    }
    if (originHost !== request.headers.host) {
      sendJson(response, 403, { ok: false });
      return;
    }
  }

  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    sendJson(response, 415, { ok: false });
    return;
  }
  if (isRateLimited(getClientKey(request))) {
    sendJson(response, 429, { ok: false });
    return;
  }

  let payload;
  try {
    payload = await readRequestJson(request);
  } catch (error) {
    sendJson(response, error.statusCode || 400, { ok: false });
    return;
  }

  const guestName = typeof payload?.guestName === 'string'
    ? payload.guestName.replace(/[\r\n\t\u0000-\u001f]+/g, ' ').trim()
    : '';
  const attendance = payload?.attendance;
  if (!guestName || guestName.length > 100 || !Object.hasOwn(attendanceLabels, attendance)) {
    sendJson(response, 400, { ok: false });
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    sendJson(response, 503, { ok: false });
    return;
  }

  const message = [
    'Жаңа тойға жауап',
    `Аты-жөні: ${guestName}`,
    `Қатысуы: ${attendanceLabels[attendance]}`,
  ].join('\n');

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
      signal: AbortSignal.timeout(8000),
    });
    const telegramResult = await telegramResponse.json().catch(() => null);
    if (!telegramResponse.ok || telegramResult?.ok !== true) {
      console.error(`Telegram sendMessage failed with HTTP ${telegramResponse.status}`);
      sendJson(response, 502, { ok: false });
      return;
    }
  } catch (error) {
    console.error(`Telegram sendMessage failed: ${error.name || 'network error'}`);
    sendJson(response, 502, { ok: false });
    return;
  }

  sendJson(response, 200, { ok: true });
}

function serveStatic(request, response, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    sendJson(response, 400, { ok: false });
    return;
  }

  const requestedPath = decodedPath === '/' ? '/index.html' : decodedPath;
  const filePath = path.resolve(projectRoot, `.${requestedPath}`);
  const relativePath = path.relative(projectRoot, filePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)
    || relativePath.split(path.sep).some((segment) => segment === '.git' || segment.startsWith('.env'))) {
    sendJson(response, 403, { ok: false });
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Cache-Control': 'no-cache',
      'Content-Length': stats.size,
      'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    fs.createReadStream(filePath).pipe(response);
  });
}

loadLocalEnvironment();
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;
  } catch {
    sendJson(response, 400, { ok: false });
    return;
  }

  if (pathname === '/api/rsvp') {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      sendJson(response, 405, { ok: false });
      return;
    }
    void handleRsvp(request, response);
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    sendJson(response, 405, { ok: false });
    return;
  }
  serveStatic(request, response, pathname);
});

server.listen(port, host, () => {
  console.log(`Invitation server listening on http://${host}:${port}`);
});
