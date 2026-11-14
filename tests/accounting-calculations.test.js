const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const lpj = fs.readFileSync(path.join(root, 'lpj.js'), 'utf8');

function extract(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, 'source start marker must exist');
  assert.notEqual(end, -1, 'source end marker must exist');
  return source.slice(start, end);
}

test('Pagu PO converts units case-insensitively and rejects incompatible units', function() {
  const context = {};
  vm.runInNewContext(extract(html, 'function calculateBudgetCost(', '\nrenderBudgetTable = function'), context);

  assert.equal(context.calculateBudgetCost({ unit: 'gram', priceUnit: 'Kg', price: 12000 }, 2000), 24000);
  assert.equal(context.calculateBudgetCost({ unit: 'ml', priceUnit: 'Liter', price: 18000 }, 500), 9000);
  assert.equal(context.calculateBudgetCost({ unit: 'gram', priceUnit: 'liter', price: 12000 }, 2000), null);
});

test('LPDH totals expense lines, cash availability, closing balance, and operational cap', function() {
  const outputIds = [
    'lpdhSummaryPortions', 'lpdhSummaryFood', 'lpdhSummaryOperations', 'lpdhSummaryHonor',
    'lpdhSummaryAvailable', 'lpdhSummaryExpenses', 'lpdhSummaryClosing', 'lpdhExpenseGrandTotal',
    'lpdhApproverName', 'lpdhAccountantName', 'lpdhApproverSignatureName', 'lpdhAccountantSignatureName'
  ];
  const elements = Object.fromEntries(outputIds.map(function(id) { return [id, { value: '', textContent: '', style: {} }]; }));
  elements.lpdhBeneficiaryPortions = { value: '100' };
  elements.lpdhOpeningCash = { value: '10000' };
  elements.lpdhTopUp = { value: '2000' };
  elements.lpdhOperationalCap = { value: '2500' };
  elements.lpdhCapStatus = {
    textContent: '',
    classList: { remove: function() {}, add: function(value) { this.added = value; } }
  };
  elements.lpdhApproverName.value = 'Kepala SPPG';
  elements.lpdhAccountantName.value = 'Akuntan';

  function expenseRow(category, quantity, unitPrice) {
    const fields = {
      '.lpdh-row-number': { textContent: '' },
      '.lpdh-amount': { textContent: '' },
      '.lpdh-row-quantity': { value: String(quantity) },
      '.lpdh-row-unit-price': { value: String(unitPrice) },
      '.lpdh-expense-category': { value: category }
    };
    return { querySelector: function(selector) { return fields[selector]; } };
  }
  const rows = [expenseRow('Operasional', 3, 1000), expenseRow('Bahan Pangan', 1.5, 2000)];
  const context = {
    document: {
      getElementById: function(id) { return elements[id]; },
      querySelectorAll: function(selector) {
        return selector === '#lpdhExpenseRows [data-lpdh-expense-row]' ? rows : [];
      }
    },
    lpdhFormatMoney: function(value) { return 'Rp ' + Math.round(value).toLocaleString('id-ID'); }
  };
  vm.runInNewContext(extract(html, 'function updateLpdhCalculations(', '\nfunction setLpdhFormData'), context);
  context.updateLpdhCalculations();

  assert.equal(elements.lpdhSummaryAvailable.textContent, 'Rp 12.000');
  assert.equal(elements.lpdhSummaryExpenses.textContent, 'Rp 6.000');
  assert.equal(elements.lpdhSummaryClosing.textContent, 'Rp 6.000');
  assert.equal(elements.lpdhSummaryOperations.textContent, 'Rp 3.000');
  assert.equal(elements.lpdhCapStatus.classList.added, 'over');
  assert.equal(elements.lpdhApproverSignatureName.textContent, 'Kepala SPPG');
});

test('LPJ budget realization follows cash-book expense categories', function() {
  const context = {
    lpjNumber: function(value) {
      const number = Number(value);
      return Number.isFinite(number) ? number : 0;
    }
  };
  vm.runInNewContext(extract(lpj, 'function lpjRowsWithCalculations(', '\nfunction buildLpjSheetDefinitions'), context);
  const rows = context.lpjRowsWithCalculations('budget', {
    cash_book: [
      { category: 'Bahan Pangan', credit: 4000 },
      { category: 'Operasional', credit: 1500 },
      { category: 'Penerimaan Banper', credit: 9000 }
    ],
    budget: [{ code: '5211-01', component: 'Pangan', budget: 5000 }]
  });

  assert.equal(rows[0][3], 4000);
  assert.equal(rows[0][4], 1000);
  assert.equal(rows[0][5], 0.8);
  assert.equal(rows[0][6], '80.0%');
});

test('READ INFO PROJECT documents calculation behavior for all four modules', function() {
  assert.match(html, /Pagu Anggaran PO[\s\S]*?FK/i);
  assert.match(html, /LPDH[\s\S]*?Saldo kas akhir/i);
  assert.match(html, /LPJ[\s\S]*?serapan/i);
  assert.match(html, /Kalkulator AKG[\s\S]*?per 100 g/i);
});
