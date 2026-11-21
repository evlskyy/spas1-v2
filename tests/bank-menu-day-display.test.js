const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('selected Bank Menu follows its weekday and displays a dated emoji menu list', function() {
  assert.match(html, /onchange="onRecipeBankMenuSelectChange\(\)"/);
  assert.match(html, /selectedRecipeDay = menuDay/);
  assert.match(html, /formatBankMenuDailyList\(selectedRecipeDay, bankMenuItems, menuObj\.menuList\)/);
  assert.match(html, /formatBankMenuDailyList\(selectedDay, bankMenuItems, menuObj\.menuList\)/);
  assert.match(html, /getManualRecipeDateHeader/);
  assert.match(html, /componentKey === 'proteinNabati'\) return '🫘'/);
});
