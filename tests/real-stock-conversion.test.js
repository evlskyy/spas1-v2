const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase_migration.sql'), 'utf8');
const stockMigration = fs.readFileSync(path.join(__dirname, '..', 'supabase_stock_conversion_migration.sql'), 'utf8');

test('real purchase notes capture mixed-unit conversion metadata', function() {
  assert.match(html, /data-purchase-field="smallUnit"/);
  assert.match(html, /data-purchase-field="conversionFactor"/);
  assert.match(html, /smallUnit: line\.querySelector\('\[data-purchase-field="smallUnit"\]'\)/);
  assert.match(html, /conversionFactor: line\.querySelector\('\[data-purchase-field="conversionFactor"\]'\)/);
  assert.match(html, /return \{ category: category, name: name, unit: unit, smallUnit: smallUnit, conversionFactor: conversionFactor/);
  assert.match(migration, /add column if not exists "Satuan Pecahan" text not null default ''/);
  assert.match(migration, /add column if not exists "Faktor Konversi" numeric/);
  assert.match(migration, /alter column "Stok" type numeric/);
  assert.match(migration, /v_small_unit := btrim\(coalesce\(v_line ->> 'smallUnit', ''\)\)/);
});

test('real stock equivalent formatting handles fractional primary units', function() {
  const start = html.indexOf('function normalizeStockConversionFields(');
  const end = html.indexOf('\nfunction parseModuleData', start);
  const context = {};
  vm.runInNewContext(html.slice(start, end), context);

  assert.equal(context.formatStockEquivalent(5.25, 'Dus', 'bungkus', 12), '5 Dus + 3 bungkus');
  assert.equal(context.formatStockEquivalent(0.75, 'Dus', 'bungkus', 12), '9 bungkus');
  assert.throws(function() {
    context.normalizeStockConversionFields('bungkus', '');
  }, /Satuan pecahan dan faktor konversi/);
});

test('real stock movement records normalized and entered quantities', function() {
  assert.match(html, /id="slMovementSmallQuantity"/);
  assert.match(html, /p_small_quantity: smallQuantity/);
  assert.match(migration, /p_small_quantity numeric default 0/);
  assert.match(migration, /"Jumlah Utama" numeric not null default 0/);
  assert.match(migration, /"Jumlah Pecahan" numeric not null default 0/);
  assert.match(migration, /v_quantity := p_quantity \+ case when p_small_quantity > 0 then p_small_quantity \/ v_conversion_factor else 0 end/);
});

test('daily kitchen use converts both quantities and can return remainder', function() {
  assert.match(html, /sl-kitchen-used-primary/);
  assert.match(html, /sl-kitchen-used-small/);
  assert.match(html, /usedPrimaryQuantity: usedPrimaryQuantity/);
  assert.match(html, /usedSmallQuantity: usedSmallQuantity/);
  assert.match(html, /case 'returnKitchenUsageRemainder'/);
  assert.match(migration, /create or replace function public\.return_stok_logistik_kitchen_remainder/);
  assert.match(migration, /"Jumlah Dikembalikan" numeric not null default 0/);
  assert.match(migration, /"Transaksi Pengembalian ID" uuid references public\."modul3_stok_logistik_transaksi"/);
  assert.match(migration, /"Transaksi Referensi ID"/);
});

test('stock module no longer exposes or calls the dummy note feature', function() {
  assert.doesNotMatch(html, /KitchenDemo|kitchen-demo|kitchen_demo/);
  assert.doesNotMatch(html, /Uji Nota &amp; Folder Sisa/);
  assert.doesNotMatch(html, /case 'fetchKitchenDemoNotes'/);
  assert.doesNotMatch(html, /case 'saveKitchenDemoNote'/);
  assert.doesNotMatch(html, /case 'deleteKitchenDemoNote'/);
  assert.doesNotMatch(html, /loadKitchenDemoNotes\(\)/);
  assert.doesNotMatch(migration, /create table if not exists public\."modul3_stok_logistik_kitchen_demo"/);
});

test('free-tier stock migration is atomic and scoped to stock tables', function() {
  assert.match(stockMigration, /^begin;/);
  assert.match(stockMigration, /commit;\s*$/);
  assert.match(stockMigration, /public\."modul3_stok_logistik"/);
  assert.match(stockMigration, /public\."modul3_stok_logistik_transaksi"/);
  assert.match(stockMigration, /public\."modul3_stok_logistik_belanja_harian"/);
  assert.match(stockMigration, /public\."modul3_stok_logistik_pemakaian_harian"/);
  assert.match(stockMigration, /record_stok_logistik_daily_purchase/);
  assert.match(stockMigration, /return_stok_logistik_kitchen_remainder/);
  assert.match(stockMigration, /guard_stok_logistik_return_void/);
  assert.doesNotMatch(stockMigration, /create policy|drop policy|auth\.users|MODUL1_|MODUL4_/i);
});
