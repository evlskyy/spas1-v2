const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

test('AboutSky database content is escaped before rendering', function() {
  const html = fs.readFileSync(path.join(root, 'aboutsky.html'), 'utf8');
  const start = html.indexOf('let projectsData = [');
  const end = html.indexOf('\nfunction handleFilterClick', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const grid = { innerHTML: '' };
  const context = {
    URL,
    window: { location: { href: 'https://spas1.my.id/aboutsky.html' } },
    document: { getElementById: () => grid },
    console
  };
  const source = html.slice(start, end) +
    '\nglobalThis.projectSnapshot = () => projectsData; globalThis.replaceProjects = (value) => { projectsData = value; };';
  vm.runInNewContext(source, context);

  const projects = JSON.parse(JSON.stringify(context.projectSnapshot()));
  projects[0].title = '<img src=x onerror=alert(1)>';
  context.replaceProjects(projects);
  context.renderProjects();

  assert.ok(grid.innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!grid.innerHTML.includes('<img src=x'));
  assert.equal(context.safeExternalUrl('javascript:alert(1)'), '#');
});

test('stored AboutSky social links are normalized to the Cloudflare page', function() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const start = html.indexOf('const ABOUTSKY_PUBLIC_URL =');
  const end = html.indexOf('\nfunction loadPublicSiteContent()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const link = {
    style: {},
    hasAttribute: () => false,
    setAttribute() {},
    querySelector: () => null
  };
  const context = {
    URL,
    CSS: { escape: (value) => value },
    document: {
      querySelectorAll: (selector) => selector === '[data-content-key]' ? [] : [link],
      getElementById: () => null
    }
  };
  vm.runInNewContext(html.slice(start, end), context);
  context.applySiteContent({
    socials: [{
      key: 'aboutskyy',
      label: 'About Skyy',
      url: 'https://sites.google.com/view/deployskyy/about',
      enabled: true
    }]
  });

  assert.equal(link.href, 'https://spas1.my.id/aboutsky.html');
});

test('AboutSky archive uses Supabase without Apps Script CSP access', async function() {
  const middleware = fs.readFileSync(path.join(root, 'functions', '_middleware.js'), 'utf8')
    .replace('export async function onRequest', 'async function onRequest') +
    '\nglobalThis.onRequest = onRequest;';
  const context = { URL, Headers, Request, Response };
  vm.runInNewContext(middleware, context);

  async function getPolicy(pathname) {
    const response = await context.onRequest({
      request: new Request('https://spas1.my.id' + pathname),
      env: { MAINTENANCE_MODE: 'false' },
      next: async () => new Response('ok')
    });
    return response.headers.get('Content-Security-Policy');
  }

  const aboutPolicy = await getPolicy('/aboutsky.html');
  const appPolicy = await getPolicy('/index.html');
  assert.ok(aboutPolicy.includes('https://ysvxtbupzhubxkbvtzmo.supabase.co'));
  assert.ok(!aboutPolicy.includes('https://script.google.com'));
  assert.ok(!aboutPolicy.includes('https://script.googleusercontent.com'));
  assert.ok(!appPolicy.includes('https://script.google.com'));
});

test('AboutSky private archives authenticate with Supabase and use private signed links', function() {
  const page = fs.readFileSync(path.join(root, 'aboutsky.html'), 'utf8');
  const archiveFunction = fs.readFileSync(
    path.join(root, 'supabase', 'functions', 'aboutsky-archive', 'index.ts'),
    'utf8'
  );
  const migration = fs.readFileSync(path.join(root, 'supabase', 'aboutsky_migration.sql'), 'utf8');

  assert.ok(page.includes('/auth/v1/token?grant_type=password'));
  assert.ok(page.includes('/functions/v1/aboutsky-archive'));
  assert.ok(!page.includes('ABOUTSKY_GAS_URL'));
  assert.ok(!page.includes('callAboutSkyGAS'));
  assert.ok(archiveFunction.includes('userClient.auth.getUser(token)'));
  assert.ok(archiveFunction.includes('user.app_metadata?.role !== "admin"'));
  assert.ok(archiveFunction.includes('.createSignedUrl(record.storage_path, signedUrlLifetimeSeconds'));
  assert.ok(archiveFunction.includes('{ download: true }'));
  assert.ok(migration.includes("values ('aboutsky-private-archive', 'aboutsky-private-archive', false"));
  assert.ok(migration.includes('alter table public.aboutsky_archive_files enable row level security'));
  assert.ok(migration.includes('revoke all on public.aboutsky_archive_files from public, anon, authenticated'));
});

test('archive rendering treats file metadata as text and rejects external links', function() {
  const html = fs.readFileSync(path.join(root, 'aboutsky.html'), 'utf8');
  const start = html.indexOf('function renderArsipContentFromServer(response) {');
  const end = html.indexOf('\nfunction closeArsipModal()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  class Element {
    constructor(tagName) {
      this.tagName = tagName;
      this.children = [];
      this.style = {};
      this.classList = { add: () => {} };
      this._text = '';
    }

    set textContent(value) {
      this._text = String(value);
      this.children = [];
    }

    get textContent() {
      return this._text + this.children.map((child) => child.textContent || '').join('');
    }

    appendChild(child) {
      this.children.push(child);
      return child;
    }

    replaceChildren(...children) {
      this._text = '';
      this.children = children;
    }
  }

  const elements = {
    arsipContentTitle: new Element('h2'),
    arsipContentIcon: new Element('div'),
    arsipContentBody: new Element('div'),
    arsipContentModal: new Element('div')
  };
  const document = {
    body: { style: {} },
    getElementById: (id) => elements[id],
    createElement: (tagName) => new Element(tagName),
    createTextNode: (text) => ({ textContent: String(text) })
  };
  const source = html.slice(start, end) + `
    function getFileIcon(type) { return type === 'pdf' ? 'fa-file-pdf' : 'fa-file'; }
    globalThis.renderArchive = renderArsipContentFromServer;`;
  const context = {
    URL,
    document,
    ABOUTSKY_SUPABASE_URL: 'https://ysvxtbupzhubxkbvtzmo.supabase.co'
  };
  vm.runInNewContext(source, context);
  context.renderArchive({
    folder: { title: '<svg onload=alert(1)>', icon: 'fa-folder' },
    files: [
      {
        name: '<img src=x onerror=alert(1)>',
        type: 'pdf',
        desc: '<script>alert(1)</script>',
        size: '1 KB',
        link: 'https://attacker.example/file',
        downloadLink: 'https://attacker.example/file?download=1'
      },
      {
        name: 'safe.pdf',
        type: 'pdf',
        desc: 'Private file',
        size: '2 KB',
        link: 'https://ysvxtbupzhubxkbvtzmo.supabase.co/storage/v1/object/sign/archive?token=abc',
        downloadLink: 'https://ysvxtbupzhubxkbvtzmo.supabase.co/storage/v1/object/sign/archive?token=def&download=true'
      }
    ]
  });

  const body = elements.arsipContentBody;
  const descendants = [];
  function collect(element) {
    descendants.push(element);
    (element.children || []).forEach(collect);
  }
  collect(body);
  assert.ok(body.textContent.includes('<img src=x onerror=alert(1)>'));
  assert.ok(body.textContent.includes('<script>alert(1)</script>'));
  assert.ok(!descendants.some((element) => ['img', 'script', 'svg'].includes(element.tagName)));
  const links = descendants.filter((element) => element.tagName === 'a');
  assert.equal(links.length, 2);
  assert.ok(links.every((link) => link.href.startsWith('https://ysvxtbupzhubxkbvtzmo.supabase.co/')));
});

test('archive importer accepts only supported file types and the Storage size limit', function() {
  const { getFileMetadata } = require(path.join(root, 'scripts', 'import-aboutsky-archive.js'));

  assert.deepEqual(getFileMetadata('/archive/document.docx', 1024), {
    type: 'doc',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
  assert.throws(() => getFileMetadata('/archive/unknown.exe', 1024), /Tipe file tidak didukung/);
  assert.throws(() => getFileMetadata('/archive/large.pdf', 100 * 1024 * 1024 + 1), /melebihi 100 MB/);
});
