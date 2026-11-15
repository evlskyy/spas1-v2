const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('Module 1 keeps its solid indigo hover tile and readable camera icon in light mode', function() {
  const moduleOneIcon = html.match(/<div class="home-module-icon--attendance w-12 h-12 bg-indigo-600\/20 text-indigo-400[^"]*"><i class="fa-solid fa-camera-rotate"><\/i><\/div>/);

  assert.ok(moduleOneIcon, 'Module 1 camera icon should keep its indigo base styling');
  assert.match(moduleOneIcon[0], /group-hover:bg-indigo-600/);
  assert.match(moduleOneIcon[0], /group-hover:text-white/);
  assert.match(html, /#view-home \.dark-card:hover \.home-module-icon--attendance \{ background-color: #4F46E5 !important; color: #FFFFFF !important; \}/);
});
