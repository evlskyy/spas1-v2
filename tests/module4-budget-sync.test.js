const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('saving Module 4 budget uses local normalization instead of undefined backup validation', function() {
  assert.match(html, /case 'saveModule4Budget':/);
  assert.match(html, /const normalizeBudgetMap = function\(budget\)/);
  assert.match(html, /const normalizedBudget = normalizeBudgetMap\(payload\.budget \|\| \{\}\)/);
  const budgetStart = html.indexOf("case 'saveModule4Budget':");
  const budgetEnd = html.indexOf("case 'saveModule4Schedule':", budgetStart);
  const budgetCase = html.slice(budgetStart, budgetEnd);
  assert.doesNotMatch(budgetCase, /validateBackupData\(/);
});

test('Module 4 state save can recover from missing replica identity', function() {
  assert.match(html, /550001\|cannot update table\|replica identity/);
  assert.match(html, /method: 'DELETE',[\s\S]*?AppKey: 'eq\.app-state'/);
  assert.match(html, /method: 'POST',[\s\S]*?prefer: 'return=minimal'/);
});
