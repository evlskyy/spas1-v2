const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('async function callSupabase(action, payload)');
const end = html.indexOf('\nfunction callSupabaseAction', start);
const source = html.slice(start, end);

for (const action of ['saveAdminAboutData', 'saveAdminAboutDraft']) {
  test(action + ' upserts About settings on the Pengaturan key', async function() {
    const requests = [];
    const context = {
      supabaseRequest: async function(table, options) {
        requests.push({ table, options });
        return [];
      }
    };
    vm.runInNewContext(source, context);

    await context.callSupabase(action, {});

    const settingsWrites = requests.filter(function(request) {
      return request.table === 'SPAS1_SETTINGS';
    });
    assert.equal(settingsWrites.length, 2);
    for (const request of settingsWrites) {
      assert.equal(request.options.method, 'POST');
      assert.equal(request.options.query.on_conflict, 'Pengaturan');
      assert.match(request.options.prefer, /resolution=merge-duplicates/);
    }
  });
}
