const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function getCssRule(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected CSS rule for ${selector}`);
  return match[1];
}

test('SUPER ADMIN and Radar Info cards use white surfaces in light mode', function() {
  const superAdminRule = getCssRule('body.app-light-mode #view-home #btnSuperAdminLogin');
  const radarRule = getCssRule('body.app-light-mode .home-news-launcher');

  assert.match(superAdminRule, /background:\s*#FFFFFF\s*!important/);
  assert.match(superAdminRule, /border-color:\s*#D1D5DB\s*!important/);
  assert.match(radarRule, /background:\s*#FFFFFF/);
  assert.match(radarRule, /border-color:\s*#D1D5DB/);
});
