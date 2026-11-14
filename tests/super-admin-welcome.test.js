const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('const SUPER_ADMIN_WELCOME_STORAGE_KEY');
const end = html.indexOf('\nfunction showSuperAdminWelcome()', start);
const source = html.slice(start, end);
const answerStart = html.indexOf('function selectSuperAdminWelcomeAnswer(');
const answerEnd = html.indexOf('\nfunction finishSuperAdminWelcome()', answerStart);
const answerSource = html.slice(answerStart, answerEnd);

function createContext(storage) {
  const notices = [];
  const errors = [];
  const context = {
    window: { localStorage: storage },
    showToast: function(message) { notices.push(message); },
    console: { error: function(message) { errors.push(message); } }
  };
  vm.runInNewContext(source, context);
  return { context, notices, errors };
}

test('welcome completion persists across reloads until browser storage is cleared', function() {
  const values = new Map();
  const storage = {
    getItem: function(key) { return values.get(key) || null; },
    setItem: function(key, value) { values.set(key, value); }
  };
  const firstLogin = createContext(storage);

  assert.equal(firstLogin.context.hasCompletedSuperAdminWelcome(), false);
  assert.equal(firstLogin.context.rememberSuperAdminWelcome(), true);
  assert.equal(createContext(storage).context.hasCompletedSuperAdminWelcome(), true);

  values.clear();
  assert.equal(createContext(storage).context.hasCompletedSuperAdminWelcome(), false);
});

test('storage failures are reported and do not silently claim completion', function() {
  const storage = {
    getItem: function() { throw new Error('storage blocked'); },
    setItem: function() { throw new Error('storage blocked'); }
  };
  const { context, notices, errors } = createContext(storage);

  assert.equal(context.hasCompletedSuperAdminWelcome(), false);
  assert.equal(context.rememberSuperAdminWelcome(), false);
  assert.equal(errors.length, 2);
  assert.equal(notices.length, 1);
});

test('role answers are independent and enable entry only after all six are answered', function() {
  const roles = Array.from({ length: 6 }, function(_, index) {
    const role = { dataset: { adminRole: 'Role ' + index, answer: '' } };
    role.buttons = ['yes', 'no'].map(function(answer) {
      return {
        dataset: { answer },
        attributes: {},
        closest: function() { return role; },
        setAttribute: function(name, value) { this.attributes[name] = value; }
      };
    });
    role.querySelectorAll = function() { return role.buttons; };
    return role;
  });
  const status = { textContent: '' };
  const finish = { disabled: true };
  const context = {
    document: {
      querySelectorAll: function() { return roles; },
      getElementById: function(id) {
        return id === 'superAdminWelcomeStatus' ? status : finish;
      }
    }
  };
  vm.runInNewContext(answerSource, context);

  context.selectSuperAdminWelcomeAnswer(roles[0].buttons[0]);
  assert.equal(finish.disabled, true);
  context.selectSuperAdminWelcomeAnswer(roles[0].buttons[1]);
  assert.equal(roles[0].buttons[0].attributes['aria-pressed'], 'false');
  assert.equal(roles[0].buttons[1].attributes['aria-pressed'], 'true');
  roles.slice(1).forEach(function(role) {
    context.selectSuperAdminWelcomeAnswer(role.buttons[0]);
  });

  assert.equal(finish.disabled, false);
  assert.equal(status.textContent, '6 dari 6 peran sudah dijawab.');
});

test('welcome includes the Admin role and the S-mark robot greeting stage', function() {
  const roles = Array.from(html.matchAll(/data-admin-role="([^"]+)"/g), function(match) { return match[1]; });

  assert.deepEqual(roles, ['Kepala SPPG', 'Ahli Gizi', 'Akuntan', 'Aslap', 'Head Chef', 'Admin']);
  assert.match(html, /id="superAdminRobotGreeting"/);
  assert.match(html, /Say Hallo!/);
  assert.match(html, /src="assets\/spas1-mark\.png" alt=""/);
  assert.match(html, /onclick="finishSuperAdminRobotWelcome\(\)"/);
});
