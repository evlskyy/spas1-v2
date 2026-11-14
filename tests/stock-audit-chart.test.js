const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('function renderStockMovementChart(');
const end = html.indexOf('\nfunction renderStockMovementRows', start);
const source = html.slice(start, end);

function render(rows, emptyMessage) {
  const chart = { innerHTML: '', querySelectorAll: function() { return []; } };
  const context = {
    document: { getElementById: function() { return chart; } },
    window: { requestAnimationFrame: function(callback) { callback(); } },
    rows,
    emptyMessage,
    escapeHtml: function(value) {
      return String(value).replace(/[&<>"']/g, function(char) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
      });
    }
  };
  vm.runInNewContext(source + '\nrenderStockMovementChart(rows, emptyMessage);', context, {
    filename: 'index.html stock audit chart'
  });
  return chart.innerHTML;
}

test('renders active incoming and outgoing totals separately for each unit', function() {
  const markup = render([
    { Tipe: 'Masuk', Satuan: 'kg', Jumlah: 5, Status: 'Aktif' },
    { Tipe: 'Keluar', Satuan: 'kg', Jumlah: 2, Status: 'Aktif' },
    { Tipe: 'Masuk', Satuan: 'pcs', Jumlah: 7, Status: 'Aktif' },
    { Tipe: 'Masuk', Satuan: 'kg', Jumlah: 99, Status: 'Dibatalkan' }
  ]);

  assert.match(markup, /5 kg/);
  assert.match(markup, /2 kg/);
  assert.match(markup, /7 pcs/);
  assert.doesNotMatch(markup, /99 kg/);
  assert.equal((markup.match(/class="sl-audit-chart-row"/g) || []).length, 2);
});

test('shows an explicit message when there are no active chartable movements', function() {
  const markup = render([
    { Tipe: 'Masuk', Satuan: 'kg', Jumlah: 5, Status: 'Dibatalkan' }
  ], 'Tidak ada transaksi aktif.');

  assert.match(markup, /Tidak ada transaksi aktif\./);
});
