const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('Bank Menu supports code and name search', function() {
  assert.match(html, /id="recipeBankMenuSearch"/);
  assert.match(html, /placeholder="Cari #002 atau nama menu\.\.\."/);
  assert.match(html, /window\.onRecipeBankMenuSearch = function\(\)/);
  assert.match(html, /padStart\(3, '0'\)/);
});
