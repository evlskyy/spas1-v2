const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('function submitAnnouncement()');
const end = html.indexOf('\nfunction prepareAdminImage', start);
const source = html.slice(start, end);

function createAnnouncementContext(overrides) {
  const calls = [];
  const form = {
    reportValidity: function() { return true; }
  };
  const button = { disabled: false, innerHTML: '' };
  const inputs = {
    announcementCategory: { value: 'Umum' },
    announcementDate: { value: '2026-11-14' },
    announcementTitle: { value: '  Info Uji Coba  ' },
    announcementContent: { value: '  Konten uji coba.  ' },
    announcementPoster: { files: [] },
    adminNewsForm: form
  };
  const context = Object.assign({
    window: { SPAS1_AUTH_ROLE: 'admin', SPAS1_AUTH_TOKEN: 'token' },
    document: {
      getElementById: function(id) {
        if (id === 'announcementSubmit') return button;
        if (id === 'adminNewsForm') return form;
        return inputs[id] || { files: [] };
      }
    },
    callSupabaseAction: function(name, payload, success, failure) {
      calls.push({ name, payload, success, failure });
      success({ status: 'success', message: 'Info berhasil diterbitkan.' });
    },
    showToast: function() {},
    alert: function() {},
    localDateInputValue: function() { return '2026-11-14'; },
    console: { error: function() {} }
  }, overrides);
  vm.runInNewContext(source, context);
  return { context, calls, button, form };
}

test('submitAnnouncement rejects empty required fields before sending data', function() {
  const calls = [];
  const context = {
    window: { SPAS1_AUTH_ROLE: 'admin', SPAS1_AUTH_TOKEN: 'token' },
    document: {
      getElementById: function(id) {
        if (id === 'announcementSubmit') return { disabled: false, innerHTML: '' };
        if (id === 'adminNewsForm') return { reportValidity: function() { return false; } };
        if (id === 'announcementCategory') return { value: '  ' };
        if (id === 'announcementDate') return { value: '' };
        if (id === 'announcementTitle') return { value: ' ' };
        if (id === 'announcementContent') return { value: ' ' };
        return { files: [] };
      }
    },
    callSupabaseAction: function() { calls.push(true); },
    showToast: function() {},
    alert: function() {},
    localDateInputValue: function() { return '2026-11-14'; },
    console: { error: function() {} }
  };

  vm.runInNewContext(source, context);
  context.submitAnnouncement();

  assert.equal(calls.length, 0);
});

test('submitAnnouncement trims payload and publishes valid info once', function() {
  const { context, calls, button } = createAnnouncementContext();

  context.submitAnnouncement();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'createAnnouncement');
  assert.deepEqual(calls[0].payload, {
    category: 'Umum',
    date: '2026-11-14',
    title: 'Info Uji Coba',
    content: 'Konten uji coba.'
  });
  assert.equal(button.disabled, false);
  assert.match(button.innerHTML, /Terbitkan Info/);
});
