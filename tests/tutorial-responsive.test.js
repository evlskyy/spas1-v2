const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('tutorial layout has phone-sized rules for its page, headings, lists, and back button', function() {
  assert.match(html, /#projectIdentityTitle \.project-tutorial-button \{[^}]*min-height: 44px;[^}]*white-space: normal;/);
  assert.match(html, /#view-tutorial \{ width: 100%; min-width: 0; align-items: stretch; padding: 8px !important; \}/);
  assert.match(html, /#view-tutorial \.home-project-info-content \{[^}]*width: 100%;[^}]*overflow-wrap: anywhere;/);
  assert.match(html, /#view-tutorial \.home-project-info-heading h2 \{[^}]*font-size: clamp\(20px, 5\.2vw, 24px\)/);
  assert.match(html, /#view-tutorial \.project-tutorial-list li \{[^}]*font-size: 14px; line-height: 1\.65;/);
  assert.match(html, /#view-tutorial \.project-tutorial-back \{[^}]*min-height: 40px;[^}]*white-space: normal;/);
});

test('tutorial reflects current stock, admin, accounting, and public-page behavior', function() {
  assert.match(html, /AboutSky<\/strong> dapat dibuka tanpa masuk ke portal admin/);
  assert.match(html, /SUPER ADMIN dapat menekan <strong>Kembalikan sisa<\/strong> untuk mencatat sisa tersebut kembali sebagai transaksi masuk gudang/);
  assert.match(html, /Welcome to SUPER SPAS1/);
  assert.match(html, /Folder LPDH &amp; LPJ/);
  assert.match(html, /data Kalkulator AKG mengikuti keterangan masing-masing modul/);
  assert.doesNotMatch(html, /Folder simulasi dapat disimpan sebagai draf/);
});
