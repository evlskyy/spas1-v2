const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const lpj = fs.readFileSync(path.join(root, 'lpj.js'), 'utf8');
const groupStart = html.indexOf('function groupAccountingReportDates(');
const groupEnd = html.indexOf('\nfunction renderAccountingReportFolders', groupStart);
const groupSource = html.slice(groupStart, groupEnd);
const renderStart = html.indexOf('function renderAccountingReportFolders(');
const renderEnd = html.indexOf('\nasync function loadAccountingReportFolders', renderStart);
const renderSource = html.slice(renderStart, renderEnd);
const navigationStart = html.indexOf('function openAccountingReportFolder(');
const navigationEnd = html.indexOf('\nfunction switchAdminTab', navigationStart);
const navigationSource = html.slice(navigationStart, navigationEnd);

test('LPDH and LPJ reports are combined into date folders', function() {
  const context = {};
  vm.runInNewContext(groupSource, context);

  const folders = context.groupAccountingReportDates(
    ['2026-11-14', '2026-11-12'],
    ['2026-11-14', '2026-11-13']
  );

  assert.deepEqual(Array.from(folders, function(folder) {
    return [folder.date, folder.lpdh, folder.lpj];
  }), [
    ['2026-11-14', true, true],
    ['2026-11-13', false, true],
    ['2026-11-12', true, false]
  ]);
});

test('invalid saved report dates are rejected before creating folders', function() {
  const context = {};
  vm.runInNewContext(groupSource, context);

  assert.throws(function() {
    context.groupAccountingReportDates(['2026-02-30'], []);
  }, /tanggal laporan yang tidak valid/);
});

test('date folder opens a detail page with its available reports', function() {
  const list = { innerHTML: '', hidden: false };
  const detail = { innerHTML: '', hidden: true };
  const folders = [{ date: '2026-11-14', lpdh: true, lpj: false }];
  const context = {
    document: {
      getElementById: function(id) {
        return id === 'accountingReportFolderList' ? list :
          id === 'accountingReportFolderDetail' ? detail : null;
      }
    },
    accountingReportFolders: folders,
    accountingReportFoldersLoaded: true,
    currentAccountingReportFolder: '',
    escapeHtml: function(value) { return String(value); }
  };
  vm.runInNewContext(renderSource, context);
  vm.runInNewContext(navigationSource, context);
  context.renderAccountingReportFolders();

  assert.match(list.innerHTML, /class="accounting-folder-card"/);
  assert.match(list.innerHTML, /14\/11\/2026/);
  context.openAccountingReportFolder('2026-11-14');

  assert.equal(list.hidden, true);
  assert.equal(detail.hidden, false);
  assert.match(detail.innerHTML, /Folder Laporan 14\/11\/2026/);
  assert.match(detail.innerHTML, /Buka LPDH/);
  assert.match(detail.innerHTML, /Belum ada LPJ/);
  assert.match(detail.innerHTML, /showAccountingReportFolderList/);
});

test('opening a saved report folder sets its date and selects the report tab', function() {
  const dateInput = { value: '' };
  const navButton = { id: 'nav-tab-lpdh' };
  const switched = [];
  const context = {
    accountingReportFolders: [{ date: '2026-11-14', lpdh: true, lpj: false }],
    document: {
      getElementById: function(id) {
        return id === 'lpdhReportDate' ? dateInput :
          id === 'nav-tab-lpdh' ? navButton : null;
      }
    },
    switchAdminTab: function(tabId, button) { switched.push([tabId, button]); },
    showToast: function() {}
  };
  vm.runInNewContext(navigationSource, context);

  context.openAccountingReportFromFolder('lpdh', '2026-11-14');

  assert.equal(dateInput.value, '2026-11-14');
  assert.equal(switched[0][0], 'tab-lpdh');
  assert.equal(switched[0][1], navButton);
});

test('accounting archive reads existing Supabase reports and refreshes after saves', function() {
  assert.match(html, /case 'listLpdhReportDates'/);
  assert.match(html, /case 'listLpjReportDates'/);
  assert.match(html, /supabaseRequest\('spas1_lpdh_reports'/);
  assert.match(html, /supabaseRequest\('spas1_lpj_reports'/);
  assert.match(html, /tab-accounting-folders/);
  assert.match(html, /src="assets\/spas1-folder\.svg"/);
  assert.match(html, /loadAccountingReportFolders\(\);/);
  assert.match(lpj, /window\.loadAccountingReportFolders\(\)/);
  assert.match(html, /function openAccountingReportFromFolder\(reportType, date\)/);
});

test('stock tab includes a right-click new folder flow for daily stock archive', function() {
  assert.doesNotMatch(html, /Folder Hari Ini/);
  assert.match(html, /New folder/);
  assert.match(html, /createStockFolderPrompt\(\)/);
});

test('audit stock page does not expose the folder shortcut or print action', function() {
  assert.doesNotMatch(html, /openStockAuditFolderPicker\(\)/);
  assert.doesNotMatch(html, /id="stockFolderList"/);
  assert.doesNotMatch(html, /Cetak Audit/);
});
