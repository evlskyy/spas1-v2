const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const maintenanceHtml = fs.readFileSync(path.join(root, 'maintenance.html'), 'utf8');
const middlewareSource = fs.readFileSync(path.join(root, 'functions', '_middleware.js'), 'utf8')
  .replace('export async function onRequest', 'async function onRequest') +
  '\nglobalThis.onRequest = onRequest;';
const context = { URL, Headers, Request, Response };
vm.runInNewContext(middlewareSource, context);

test('maintenance middleware serves the standalone page with HTTP 503', async function() {
  let forwardedUrl;
  const response = await context.onRequest({
    request: new Request('https://spas1.my.id/dashboard', { method: 'POST' }),
    env: { MAINTENANCE_MODE: 'true' },
    next: async (request) => {
      forwardedUrl = new URL(request.url);
      return new Response(maintenanceHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
  });

  assert.equal(forwardedUrl.pathname, '/maintenance');
  assert.equal(response.status, 503);
  assert.equal(response.statusText, 'Service Unavailable');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.ok(response.headers.get('Content-Security-Policy'));
  assert.match(await response.text(), /Sistem Sedang Dalam Pemeliharaan/);
});

test('maintenance middleware lets the maintenance page image assets load normally', async function() {
  for (const [pathname, contentType] of [
    ['/assets/maintenance-children.svg', 'image/svg+xml'],
    ['/assets/spas1-mark.png', 'image/png']
  ]) {
    const response = await context.onRequest({
      request: new Request('https://spas1.my.id' + pathname),
      env: { MAINTENANCE_MODE: 'true' },
      next: async () => new Response('image data', {
        headers: { 'Content-Type': contentType }
      })
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), contentType);
    assert.equal(await response.text(), 'image data');
  }
});

test('maintenance page uses the supplied licensed vector and SPAS1 logo assets', function() {
  const vectorPath = path.join(root, 'assets', 'maintenance-children.svg');
  const vector = fs.readFileSync(vectorPath, 'utf8');
  assert.match(maintenanceHtml, /src="assets\/maintenance-children\.svg"/);
  assert.ok(fs.existsSync(vectorPath));
  assert.match(vector, /<svg\b[^>]*viewBox="0 0 1376 768"/);
  assert.match(vector, /<image width="1376" height="768" href="data:image\/png;base64,/);
  assert.doesNotMatch(vector, /<rect\b/);
  assert.match(maintenanceHtml, /src="assets\/spas1-mark\.png"/);
  assert.doesNotMatch(maintenanceHtml, /anak-mbg\.png|googleusercontent\.com/);
  assert.match(maintenanceHtml, /prefers-reduced-motion/);
  assert.match(maintenanceHtml, /Sistem Sedang Dalam Pemeliharaan Terjadwal/);
  assert.match(maintenanceHtml, /aria-valuenow="85"/);
  assert.match(maintenanceHtml, /https:\/\/wa\.me\/6281378004808/);
  assert.match(maintenanceHtml, /Iamsky/);
  assert.doesNotMatch(maintenanceHtml, /mailto:/);
});

test('maintenance middleware bypasses the static page when disabled', async function() {
  const request = new Request('https://spas1.my.id/dashboard');
  const response = await context.onRequest({
    request,
    env: { MAINTENANCE_MODE: 'false' },
    next: async (forwardedRequest) => {
      assert.equal(forwardedRequest, undefined);
      return new Response('application online');
    }
  });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'application online');
});
