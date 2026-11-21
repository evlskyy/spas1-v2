const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('password visibility toggle renders an inline SVG eye without Font Awesome', function() {
  assert.match(html, /\.password-toggle-icon svg \{[^}]*stroke: currentColor;/);
  assert.match(html, /const eyeSvg = function\(showPassword\)/);
  assert.match(html, /icon\.innerHTML = eyeSvg\(false\)/);
  assert.match(html, /icon\.innerHTML = eyeSvg\(showPassword\)/);
});
