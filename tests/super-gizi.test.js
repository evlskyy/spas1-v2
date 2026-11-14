const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'super-gizi.js'), 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context);
const calculate = context.window.SuperGizi.calculate;

test('scales per-100 g nutrients to serving weight and sums categories', function() {
  const result = calculate([
    { name: 'Nasi', category: 'Karbohidrat', grams: 150, energyPer100: 130, proteinPer100: 2, carbsPer100: 28 },
    { name: 'Tempe', category: 'Protein Nabati', grams: 50, energyPer100: 190, proteinPer100: 20, carbsPer100: 8 }
  ], { energy: 2150, protein: 60 });

  assert.equal(result.totals.energy, 290);
  assert.equal(result.totals.protein, 13);
  assert.equal(result.totals.carbs, 46);
  assert.equal(result.percentages.energy, 290 / 2150 * 100);
  assert.equal(result.percentages.protein, 13 / 60 * 100);
  assert.equal(result.categoryTotals.Karbohidrat.energy, 195);
  assert.equal(result.categoryTotals['Protein Nabati'].protein, 10);
});

test('zero gram weight contributes zero and missing or zero targets have no percentage', function() {
  const result = calculate([
    { name: 'Bahan', category: 'Sayuran', grams: 0, energyPer100: 80, proteinPer100: 5 }
  ], { energy: 0 });

  assert.equal(result.totals.energy, 0);
  assert.equal(result.totals.protein, 0);
  assert.equal(result.percentages.energy, null);
  assert.equal(result.percentages.protein, null);
});

test('invalid negative nutrient entries do not produce negative totals', function() {
  const result = calculate([
    { name: 'Bahan', category: 'Pelengkap', grams: 100, energyPer100: -20, proteinPer100: 4 }
  ], {});

  assert.equal(result.totals.energy, 0);
  assert.equal(result.totals.protein, 4);
});
