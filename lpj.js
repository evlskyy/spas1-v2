const LPJ_ROW_SCHEMAS = {
  cash_book: [
    { key: 'date', label: 'Tanggal', type: 'date' },
    { key: 'receipt_no', label: 'No. Bukti', type: 'text', maxLength: 80 },
    { key: 'category', label: 'Kategori Akun', type: 'select', options: ['Penerimaan Banper', 'Bahan Pangan', 'Operasional', 'Honorarium', 'Lain-lain'] },
    { key: 'description', label: 'Uraian Transaksi', type: 'text', maxLength: 300 },
    { key: 'debit', label: 'Penerimaan / Debet (Rp)', type: 'number' },
    { key: 'credit', label: 'Pengeluaran / Kredit (Rp)', type: 'number' }
  ],
  budget: [
    { key: 'code', label: 'Kode Akun', type: 'text', maxLength: 30 },
    { key: 'component', label: 'Komponen Belanja', type: 'text', maxLength: 180 },
    { key: 'budget', label: 'Pagu Anggaran RAB (Rp)', type: 'number' }
  ],
  food_costs: [
    { key: 'item', label: 'Kelompok Komoditas Pangan', type: 'text', maxLength: 180 },
    { key: 'volume', label: 'Total Volume', type: 'number', step: 'any' },
    { key: 'unit', label: 'Satuan', type: 'text', maxLength: 40 },
    { key: 'average_price', label: 'Rata-Rata Harga (Rp)', type: 'number' }
  ],
  stock_card: [
    { key: 'item_code', label: 'Kode Barang', type: 'text', maxLength: 40 },
    { key: 'item', label: 'Nama Bahan Baku', type: 'text', maxLength: 180 },
    { key: 'unit', label: 'Satuan', type: 'text', maxLength: 40 },
    { key: 'opening', label: 'Stok Awal', type: 'number', step: 'any' },
    { key: 'incoming', label: 'Barang Masuk', type: 'number', step: 'any' },
    { key: 'outgoing', label: 'Barang Keluar', type: 'number', step: 'any' },
    { key: 'physical', label: 'Stok Fisik Opname', type: 'number', step: 'any' }
  ],
  distribution: [
    { key: 'recipient', label: 'Nama Sekolah / Posyandu Penerima', type: 'text', maxLength: 180 },
    { key: 'level', label: 'Jenjang', type: 'text', maxLength: 80 },
    { key: 'target_per_day', label: 'Target Porsi / Hari', type: 'number' },
    { key: 'days', label: 'Jumlah Hari Aktif', type: 'number' },
    { key: 'bast', label: 'No. BAST & Status', type: 'text', maxLength: 120 }
  ],
  honorarium: [
    { key: 'name', label: 'Nama Relawan / Tenaga Dapur', type: 'text', maxLength: 120 },
    { key: 'role', label: 'Jabatan / Tugas', type: 'text', maxLength: 160 },
    { key: 'attendance_days', label: 'Jumlah Hari Hadir', type: 'number' },
    { key: 'daily_rate', label: 'Tarif Insentif / Hari (Rp)', type: 'number' },
    { key: 'tax', label: 'Potongan PPh 21 (Rp)', type: 'number' }
  ]
};

const LPJ_TBODY_IDS = {
  cash_book: 'lpjCashBookRows',
  budget: 'lpjBudgetRows',
  food_costs: 'lpjFoodRows',
  stock_card: 'lpjStockRows',
  distribution: 'lpjDistributionRows',
  honorarium: 'lpjHonorariumRows'
};

const LPJ_IDENTITY_FIELDS = {
  sppg_name: 'lpjFacilityName',
  sppg_code: 'lpjFacilityCode',
  address: 'lpjAddress',
  period: 'lpjPeriod',
  decree_number: 'lpjAgreement',
  bank_account: 'lpjBankAccount',
  head_name: 'lpjHeadName',
  accountant_name: 'lpjAccountantName',
  logistics_name: 'lpjLogisticsName',
  nutritionist_name: 'lpjNutritionistName',
  beneficiary_target: 'lpjDailyTarget',
  total_funds: 'lpjFundReceived',
  reporting_date: 'lpjReportingDate'
};

let lpjLoadedDate = '';
let lpjDirty = false;
let lpjLoadSequence = 0;
window.SPAS1_SIGNATURE_VALUES = window.SPAS1_SIGNATURE_VALUES || {};

function lpjEscapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(char) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
  });
}

function lpjNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function lpjMoney(value) {
  return 'Rp ' + Math.round(lpjNumber(value)).toLocaleString('id-ID');
}

function lpjDefaultRows(section) {
  if (section === 'budget') {
    return [
      { code: '5211-01', component: 'Belanja Bahan Pangan (Makanan & Susu)', budget: 0 },
      { code: '5211-02', component: 'Belanja Operasional Dapur, Kemasan & Distribusi', budget: 0 },
      { code: '5211-03', component: 'Honorarium / Insentif Relawan & Tenaga Dapur', budget: 0 },
      { code: '5211-04', component: 'Sewa Peralatan / Pemeliharaan / Lain-lain', budget: 0 }
    ];
  }
  if (section === 'food_costs') {
    return [
      { item: 'Karbohidrat', volume: 0, unit: 'Kg', average_price: 0 },
      { item: 'Protein Hewani', volume: 0, unit: 'Kg', average_price: 0 },
      { item: 'Protein Nabati', volume: 0, unit: 'Kg', average_price: 0 },
      { item: 'Sayur-Mayur', volume: 0, unit: 'Kg', average_price: 0 },
      { item: 'Buah-Buahan', volume: 0, unit: 'Kg', average_price: 0 },
      { item: 'Susu', volume: 0, unit: 'Kotak', average_price: 0 },
      { item: 'Bumbu & Bahan Pelengkap', volume: 0, unit: 'Paket', average_price: 0 }
    ];
  }
  if (section === 'honorarium') return [{ name: 'Anonymous', role: '', attendance_days: 0, daily_rate: 0, tax: 0 }];
  return [{}];
}

function createDefaultLpjReport(date) {
  return {
    report_date: date,
    identity: {
      sppg_name: '',
      sppg_code: '',
      address: '',
      period: '',
      decree_number: '',
      bank_account: '',
      head_name: 'Anonymous',
      accountant_name: 'Anonymous',
      logistics_name: 'Anonymous',
      nutritionist_name: 'Anonymous',
      beneficiary_target: 0,
      total_funds: 0,
      reporting_date: date
    },
    cash_book: [],
    budget: lpjDefaultRows('budget'),
    food_costs: lpjDefaultRows('food_costs'),
    stock_card: [],
    distribution: [],
    honorarium: lpjDefaultRows('honorarium'),
    sptjm: { city: '', statement_date: date },
    signatures: { head: '', accountant: '' }
  };
}

function initializeSignaturePad(canvasId, key, imageId, onChange) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || canvas.dataset.initialized === 'true') return;
  canvas.dataset.initialized = 'true';
  canvas.dataset.signatureKey = key;
  const context = canvas.getContext('2d');
  context.lineWidth = 4;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = '#111827';
  let drawing = false;
  const point = function(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height
    };
  };
  canvas.addEventListener('pointerdown', function(event) {
    event.preventDefault();
    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    const position = point(event);
    context.beginPath();
    context.moveTo(position.x, position.y);
    context.lineTo(position.x + 0.1, position.y + 0.1);
    context.stroke();
  });
  canvas.addEventListener('pointermove', function(event) {
    if (!drawing) return;
    const position = point(event);
    context.lineTo(position.x, position.y);
    context.stroke();
  });
  const finish = function() {
    if (!drawing) return;
    drawing = false;
    setSignaturePadValue(key, canvas.toDataURL('image/png'), canvasId, imageId);
    if (typeof onChange === 'function') onChange();
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
}

function setSignaturePadValue(key, value, canvasId, imageId) {
  const signature = typeof value === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : '';
  window.SPAS1_SIGNATURE_VALUES[key] = signature;
  const image = document.getElementById(imageId);
  const canvas = document.getElementById(canvasId);
  if (image) {
    image.src = signature;
    image.classList.toggle('hidden', !signature);
  }
  if (!canvas) return;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  const imageVersion = Number(canvas.dataset.signatureVersion || 0) + 1;
  canvas.dataset.signatureVersion = String(imageVersion);
  if (signature) {
    const savedImage = new Image();
    savedImage.onload = function() {
      if (canvas.dataset.signatureVersion !== String(imageVersion)) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(savedImage, 0, 0, canvas.width, canvas.height);
    };
    savedImage.src = signature;
  }
}

function getSignatureValue(key) {
  return String(window.SPAS1_SIGNATURE_VALUES[key] || '');
}

function clearSignaturePad(key) {
  const canvas = document.querySelector('canvas[data-signature-key="' + key + '"]');
  if (!canvas) return;
  const imageId = key === 'lpdhApprover' ? 'lpdhApproverSignatureImage'
    : key === 'lpdhAccountant' ? 'lpdhAccountantSignatureImage'
    : key === 'lpjHead' ? 'lpjHeadSignatureImage' : 'lpjAccountantSignatureImage';
  setSignaturePadValue(key, '', canvas.id, imageId);
  if (key.startsWith('lpdh')) {
    lpdhDirty = true;
  } else {
    lpjDirty = true;
  }
}

function initializeLpjDate() {
  const dateInput = document.getElementById('lpjReportDate');
  if (dateInput && !dateInput.value) dateInput.value = localDateInputValue();
  const reportDate = dateInput ? dateInput.value : localDateInputValue();
  const statementDate = document.getElementById('lpjSptjmStatementDate');
  const reportingDate = document.getElementById('lpjReportingDate');
  if (statementDate && !statementDate.value) statementDate.value = reportDate;
  if (reportingDate && !reportingDate.value) reportingDate.value = reportDate;
  const nameInput = document.getElementById('lpjFacilityName');
  const brandName = document.querySelector('[data-brand-field="sppg"]');
  if (nameInput && !nameInput.value && brandName) nameInput.value = brandName.textContent.trim();
}

function initializeLpjForm() {
  const form = document.getElementById('lpjForm');
  if (!form || form.dataset.initialized === 'true') return;
  form.dataset.initialized = 'true';
  form.addEventListener('input', function(event) {
    if (event.target.id === 'lpjReportDate') return;
    lpjDirty = true;
    updateLpjCalculations();
  });
  form.addEventListener('change', function(event) {
    if (event.target.id === 'lpjReportDate') return;
    lpjDirty = true;
    updateLpjCalculations();
  });
  initializeSignaturePad('lpjHeadSignaturePad', 'lpjHead', 'lpjHeadSignatureImage', function() { lpjDirty = true; });
  initializeSignaturePad('lpjAccountantSignaturePad', 'lpjAccountant', 'lpjAccountantSignatureImage', function() { lpjDirty = true; });
}

function lpjCreateInput(section, row, column) {
  const value = row[column.key] == null ? '' : String(row[column.key]);
  if (column.type === 'select') {
    const options = '<option value="">Pilih kategori...</option>' + column.options.map(function(option) {
      return '<option value="' + lpjEscapeHtml(option) + '"' + (value === option ? ' selected' : '') + '>' + lpjEscapeHtml(option) + '</option>';
    }).join('');
    return '<select data-field="' + column.key + '" aria-label="' + lpjEscapeHtml(column.label) + '">' + options + '</select>';
  }
  return '<input type="' + column.type + '" data-field="' + column.key + '" aria-label="' + lpjEscapeHtml(column.label) + '"' +
    (column.maxLength ? ' maxlength="' + column.maxLength + '"' : '') +
    (column.type === 'number' ? ' min="0" step="' + (column.step || '1') + '"' : '') +
    ' value="' + lpjEscapeHtml(value) + '">';
}

function renderLpjRows(section, rows) {
  const tbody = document.getElementById(LPJ_TBODY_IDS[section]);
  if (!tbody) return;
  const schema = LPJ_ROW_SCHEMAS[section];
  const data = Array.isArray(rows) && rows.length ? rows : lpjDefaultRows(section);
  tbody.replaceChildren();
  data.forEach(function(rowData) {
    const row = rowData && typeof rowData === 'object' && !Array.isArray(rowData) ? rowData : {};
    const tr = document.createElement('tr');
    tr.dataset.lpjRow = section;
    schema.forEach(function(column) {
      const td = document.createElement('td');
      td.innerHTML = lpjCreateInput(section, row, column);
      tr.appendChild(td);
    });
    const computed = {
      cash_book: ['balance'],
      budget: ['realized', 'remaining', 'percentage'],
      food_costs: ['total'],
      stock_card: ['book_balance', 'difference'],
      distribution: ['total_portions'],
      honorarium: ['gross', 'net']
    }[section] || [];
    computed.forEach(function(key) {
      const td = document.createElement('td');
      const span = document.createElement('span');
      span.dataset.calculated = key;
      td.appendChild(span);
      tr.appendChild(td);
    });
    const action = document.createElement('td');
    action.className = 'no-print';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lpj-row-remove';
    button.textContent = 'Hapus';
    button.setAttribute('aria-label', 'Hapus baris');
    button.addEventListener('click', function() { removeLpjRow(section, button); });
    action.appendChild(button);
    tr.appendChild(action);
    tbody.appendChild(tr);
  });
  updateLpjCalculations();
}

function lpjEmptyRow(section) {
  const row = {};
  LPJ_ROW_SCHEMAS[section].forEach(function(column) {
    row[column.key] = column.type === 'number' ? 0 : '';
  });
  if (section === 'cash_book') row.date = document.getElementById('lpjReportDate').value;
  if (section === 'honorarium') row.name = 'Anonymous';
  return row;
}

function addLpjRow(section) {
  if (!LPJ_TBODY_IDS[section]) return;
  const tbody = document.getElementById(LPJ_TBODY_IDS[section]);
  const row = document.createElement('tr');
  row.dataset.lpjRow = section;
  LPJ_ROW_SCHEMAS[section].forEach(function(column) {
    const cell = document.createElement('td');
    cell.innerHTML = lpjCreateInput(section, lpjEmptyRow(section), column);
    row.appendChild(cell);
  });
  const computed = {
    cash_book: ['balance'],
    budget: ['realized', 'remaining', 'percentage'],
    food_costs: ['total'],
    stock_card: ['book_balance', 'difference'],
    distribution: ['total_portions'],
    honorarium: ['gross', 'net']
  }[section] || [];
  computed.forEach(function(key) {
    const cell = document.createElement('td');
    const span = document.createElement('span');
    span.dataset.calculated = key;
    cell.appendChild(span);
    row.appendChild(cell);
  });
  const action = document.createElement('td');
  action.className = 'no-print';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'lpj-row-remove';
  button.textContent = 'Hapus';
  button.setAttribute('aria-label', 'Hapus baris');
  button.addEventListener('click', function() { removeLpjRow(section, button); });
  action.appendChild(button);
  row.appendChild(action);
  tbody.appendChild(row);
  lpjDirty = true;
  updateLpjCalculations();
}

function removeLpjRow(section, button) {
  const row = button.closest('tr[data-lpj-row]');
  if (row) row.remove();
  if (!document.querySelector('#' + LPJ_TBODY_IDS[section] + ' tr[data-lpj-row]')) renderLpjRows(section, []);
  lpjDirty = true;
  updateLpjCalculations();
}

function readLpjRows(section) {
  const tbody = document.getElementById(LPJ_TBODY_IDS[section]);
  if (!tbody) return [];
  return Array.from(tbody.querySelectorAll('tr[data-lpj-row]')).map(function(row) {
    const result = {};
    let hasData = false;
    LPJ_ROW_SCHEMAS[section].forEach(function(column) {
      const input = row.querySelector('[data-field="' + column.key + '"]');
      if (!input) return;
      if (column.type === 'number') {
        result[column.key] = input.value === '' ? 0 : Number(input.value);
        if (input.value !== '' && Number(input.value) !== 0) hasData = true;
      } else {
        result[column.key] = input.value.trim();
        if (result[column.key] && !(section === 'cash_book' && column.key === 'date')) hasData = true;
      }
    });
    return hasData ? result : null;
  }).filter(Boolean);
}

function updateLpjCalculations() {
  if (!document.getElementById('lpjCashBookRows')) return;
  document.getElementById('lpjHeadSignatureName').textContent = document.getElementById('lpjHeadName').value.trim() || 'Anonymous';
  document.getElementById('lpjAccountantSignatureName').textContent = document.getElementById('lpjAccountantName').value.trim() || 'Anonymous';
  let balance = 0;
  let income = 0;
  let expense = 0;
  const expensesByCategory = { 'Bahan Pangan': 0, 'Operasional': 0, 'Honorarium': 0, 'Lain-lain': 0 };
  document.querySelectorAll('#lpjCashBookRows tr[data-lpj-row]').forEach(function(row) {
    const debit = lpjNumber(row.querySelector('[data-field="debit"]').value);
    const credit = lpjNumber(row.querySelector('[data-field="credit"]').value);
    const category = row.querySelector('[data-field="category"]').value;
    income += debit;
    expense += credit;
    balance += debit - credit;
    if (Object.prototype.hasOwnProperty.call(expensesByCategory, category)) expensesByCategory[category] += credit;
    const output = row.querySelector('[data-calculated="balance"]');
    if (output) output.textContent = lpjMoney(balance);
  });
  document.getElementById('lpjCashIncome').textContent = 'Penerimaan: ' + lpjMoney(income);
  document.getElementById('lpjCashExpense').textContent = 'Pengeluaran: ' + lpjMoney(expense);
  document.getElementById('lpjCashBalance').textContent = 'Saldo akhir: ' + lpjMoney(balance);
  document.querySelectorAll('#lpjBudgetRows tr[data-lpj-row]').forEach(function(row) {
    const code = row.querySelector('[data-field="code"]').value;
    const budget = lpjNumber(row.querySelector('[data-field="budget"]').value);
    const categoryKey = { '5211-01': 'Bahan Pangan', '5211-02': 'Operasional', '5211-03': 'Honorarium', '5211-04': 'Lain-lain' }[code] || '';
    const realized = expensesByCategory[categoryKey] || 0;
    const remaining = budget - realized;
    const percentage = budget > 0 ? (realized / budget * 100) : 0;
    const values = { realized: lpjMoney(realized), remaining: lpjMoney(remaining), percentage: percentage.toFixed(1) + '%' };
    Object.keys(values).forEach(function(key) {
      const output = row.querySelector('[data-calculated="' + key + '"]');
      if (output) output.textContent = values[key];
    });
  });
  document.querySelectorAll('#lpjFoodRows tr[data-lpj-row]').forEach(function(row) {
    const total = lpjNumber(row.querySelector('[data-field="volume"]').value) * lpjNumber(row.querySelector('[data-field="average_price"]').value);
    const output = row.querySelector('[data-calculated="total"]');
    if (output) output.textContent = lpjMoney(total);
  });
  document.querySelectorAll('#lpjStockRows tr[data-lpj-row]').forEach(function(row) {
    const book = lpjNumber(row.querySelector('[data-field="opening"]').value) + lpjNumber(row.querySelector('[data-field="incoming"]').value) - lpjNumber(row.querySelector('[data-field="outgoing"]').value);
    const difference = lpjNumber(row.querySelector('[data-field="physical"]').value) - book;
    const bookOutput = row.querySelector('[data-calculated="book_balance"]');
    const diffOutput = row.querySelector('[data-calculated="difference"]');
    if (bookOutput) bookOutput.textContent = book.toLocaleString('id-ID');
    if (diffOutput) diffOutput.textContent = difference.toLocaleString('id-ID');
  });
  document.querySelectorAll('#lpjDistributionRows tr[data-lpj-row]').forEach(function(row) {
    const portions = lpjNumber(row.querySelector('[data-field="target_per_day"]').value) * lpjNumber(row.querySelector('[data-field="days"]').value);
    const output = row.querySelector('[data-calculated="total_portions"]');
    if (output) output.textContent = Math.round(portions).toLocaleString('id-ID');
  });
  document.querySelectorAll('#lpjHonorariumRows tr[data-lpj-row]').forEach(function(row) {
    const gross = lpjNumber(row.querySelector('[data-field="attendance_days"]').value) * lpjNumber(row.querySelector('[data-field="daily_rate"]').value);
    const net = gross - lpjNumber(row.querySelector('[data-field="tax"]').value);
    const grossOutput = row.querySelector('[data-calculated="gross"]');
    const netOutput = row.querySelector('[data-calculated="net"]');
    if (grossOutput) grossOutput.textContent = lpjMoney(gross);
    if (netOutput) netOutput.textContent = lpjMoney(net);
  });
}

function setLpjFormData(report, statusMessage) {
  const fallback = createDefaultLpjReport(report.report_date || document.getElementById('lpjReportDate').value);
  const identity = report.identity && typeof report.identity === 'object' ? report.identity : fallback.identity;
  document.getElementById('lpjReportDate').value = String(report.report_date || localDateInputValue());
  Object.keys(LPJ_IDENTITY_FIELDS).forEach(function(key) {
    const input = document.getElementById(LPJ_IDENTITY_FIELDS[key]);
    if (!input) return;
    let value = identity[key];
    if (key.endsWith('_name')) value = String(value || 'Anonymous');
    if (key === 'sppg_name' && !value) {
      const brandName = document.querySelector('[data-brand-field="sppg"]');
      value = brandName ? brandName.textContent.trim() : '';
    }
    if (value == null) value = key === 'beneficiary_target' || key === 'total_funds' ? 0 : '';
    input.value = String(value);
  });
  renderLpjRows('cash_book', report.cash_book);
  renderLpjRows('budget', report.budget);
  renderLpjRows('food_costs', report.food_costs);
  renderLpjRows('stock_card', report.stock_card);
  renderLpjRows('distribution', report.distribution);
  renderLpjRows('honorarium', report.honorarium);
  const sptjm = report.sptjm && typeof report.sptjm === 'object' ? report.sptjm : fallback.sptjm;
  document.getElementById('lpjSptjmCity').value = String(sptjm.city || '');
  document.getElementById('lpjSptjmStatementDate').value = String(sptjm.statement_date || report.report_date || '');
  const signatures = report.signatures && typeof report.signatures === 'object' ? report.signatures : {};
  setSignaturePadValue('lpjHead', String(signatures.head || ''), 'lpjHeadSignaturePad', 'lpjHeadSignatureImage');
  setSignaturePadValue('lpjAccountant', String(signatures.accountant || ''), 'lpjAccountantSignaturePad', 'lpjAccountantSignatureImage');
  document.getElementById('lpjHeadSignatureName').textContent = document.getElementById('lpjHeadName').value;
  document.getElementById('lpjAccountantSignatureName').textContent = document.getElementById('lpjAccountantName').value;
  lpjLoadedDate = document.getElementById('lpjReportDate').value;
  lpjDirty = false;
  document.getElementById('lpjStatus').textContent = statusMessage || 'LPJ siap diisi.';
  updateLpjCalculations();
}

function resetLpjForm() {
  const form = document.getElementById('lpjForm');
  if (!form) return;
  lpjLoadSequence++;
  form.reset();
  initializeLpjDate();
  renderLpjRows('cash_book', []);
  renderLpjRows('budget', lpjDefaultRows('budget'));
  renderLpjRows('food_costs', lpjDefaultRows('food_costs'));
  renderLpjRows('stock_card', []);
  renderLpjRows('distribution', []);
  renderLpjRows('honorarium', lpjDefaultRows('honorarium'));
  setSignaturePadValue('lpjHead', '', 'lpjHeadSignaturePad', 'lpjHeadSignatureImage');
  setSignaturePadValue('lpjAccountant', '', 'lpjAccountantSignaturePad', 'lpjAccountantSignatureImage');
  lpjLoadedDate = '';
  lpjDirty = false;
  document.getElementById('lpjStatus').textContent = 'Pilih tanggal untuk memuat atau membuat LPJ.';
  updateLpjCalculations();
}

async function loadLpjReport() {
  initializeLpjDate();
  const date = document.getElementById('lpjReportDate').value;
  const status = document.getElementById('lpjStatus');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    status.textContent = 'Pilih tanggal laporan yang valid.';
    return;
  }
  if (lpjDirty && !confirm('Ada perubahan LPJ yang belum disimpan. Buang perubahan tersebut dan muat tanggal yang dipilih?')) {
    if (lpjLoadedDate) document.getElementById('lpjReportDate').value = lpjLoadedDate;
    return;
  }
  if (window.SPAS1_AUTH_ROLE !== 'admin' || !window.SPAS1_SUPABASE_SESSION) {
    status.textContent = 'Sesi SUPER ADMIN tidak aktif. Silakan login kembali.';
    return;
  }
  const requestId = ++lpjLoadSequence;
  status.textContent = 'Memuat LPJ dari Supabase...';
  document.getElementById('lpjSaveButton').disabled = true;
  try {
    const result = await callSupabase('fetchLpjReport', { report_date: date });
    if (requestId !== lpjLoadSequence) return;
    if (lpjDirty) {
      status.textContent = 'LPJ tidak dimuat karena ada perubahan saat permintaan berlangsung. Muat ulang untuk membuang perubahan.';
      return;
    }
    setLpjFormData(result.data || createDefaultLpjReport(date), result.data ? 'LPJ berhasil dimuat dari Supabase.' : 'Belum ada LPJ pada tanggal ini. Isi formulir lalu simpan.');
  } catch (error) {
    if (requestId === lpjLoadSequence) {
      status.textContent = 'Gagal memuat LPJ: ' + error.message;
      showToast('❌ Gagal memuat LPJ: ' + error.message);
    }
  } finally {
    if (requestId === lpjLoadSequence) document.getElementById('lpjSaveButton').disabled = false;
  }
}

function collectLpjFormData() {
  const reportDate = document.getElementById('lpjReportDate').value;
  const parsedDate = new Date(reportDate + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== reportDate) {
    throw new Error('Tanggal laporan LPJ tidak valid.');
  }
  if (lpjLoadedDate !== reportDate) throw new Error('Muat LPJ untuk tanggal ini terlebih dahulu sebelum menyimpan atau mengekspor.');
  const identity = {};
  Object.keys(LPJ_IDENTITY_FIELDS).forEach(function(key) {
    const input = document.getElementById(LPJ_IDENTITY_FIELDS[key]);
    const value = input.value.trim();
    identity[key] = key === 'beneficiary_target' || key === 'total_funds' ? (value === '' ? 0 : Number(value)) : value;
  });
  ['head_name', 'accountant_name', 'logistics_name', 'nutritionist_name'].forEach(function(key) {
    if (!identity[key]) identity[key] = 'Anonymous';
  });
  if (!identity.sppg_name || !identity.period) throw new Error('Nama SPPG dan periode pertanggungjawaban wajib diisi.');
  if (!Number.isSafeInteger(identity.beneficiary_target) || identity.beneficiary_target < 0 ||
      !Number.isSafeInteger(identity.total_funds) || identity.total_funds < 0) {
    throw new Error('Target penerima dan total dana harus berupa bilangan bulat nol atau lebih.');
  }
  const sptjm = {
    city: document.getElementById('lpjSptjmCity').value.trim(),
    statement_date: document.getElementById('lpjSptjmStatementDate').value || reportDate
  };
  const rows = {
    cash_book: readLpjRows('cash_book'),
    budget: readLpjRows('budget'),
    food_costs: readLpjRows('food_costs'),
    stock_card: readLpjRows('stock_card'),
    distribution: readLpjRows('distribution'),
    honorarium: readLpjRows('honorarium')
  };
  Object.keys(rows).forEach(function(section) {
    rows[section].forEach(function(row, rowIndex) {
      LPJ_ROW_SCHEMAS[section].forEach(function(column) {
        const value = row[column.key];
        if (column.type === 'number' && (!Number.isFinite(value) || value < 0 ||
            (column.step !== 'any' && !Number.isSafeInteger(value)) || value > 999999999999)) {
          throw new Error('Nilai ' + column.label + ' pada baris ' + (rowIndex + 1) + ' harus berupa angka nol atau lebih.');
        }
        if (column.type === 'select' && value && !column.options.includes(value)) {
          throw new Error('Kategori pada baris ' + (rowIndex + 1) + ' tidak valid.');
        }
      });
    });
  });
  rows.cash_book.forEach(function(row, index) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !row.category || !row.description ||
        (row.debit > 0 && row.credit > 0)) {
      throw new Error('Lengkapi tanggal, kategori, uraian, dan pilih hanya penerimaan atau pengeluaran pada transaksi BKU nomor ' + (index + 1) + '.');
    }
  });
  return {
    report_date: reportDate,
    identity: identity,
    cash_book: rows.cash_book,
    budget: rows.budget,
    food_costs: rows.food_costs,
    stock_card: rows.stock_card,
    distribution: rows.distribution,
    honorarium: rows.honorarium.map(function(row) { if (!row.name) row.name = 'Anonymous'; return row; }),
    sptjm: sptjm,
    signatures: { head: getSignatureValue('lpjHead'), accountant: getSignatureValue('lpjAccountant') }
  };
}

async function saveLpjReport(event) {
  event.preventDefault();
  const status = document.getElementById('lpjStatus');
  const button = document.getElementById('lpjSaveButton');
  if (window.SPAS1_AUTH_ROLE !== 'admin' || !window.SPAS1_SUPABASE_SESSION) {
    showToast('❌ Sesi SUPER ADMIN tidak aktif. Silakan login kembali.');
    return;
  }
  let report;
  try {
    report = collectLpjFormData();
  } catch (error) {
    status.textContent = error.message;
    showToast('❌ ' + error.message);
    return;
  }
  button.disabled = true;
  status.textContent = 'Menyimpan LPJ ke Supabase...';
  try {
    const result = await callSupabase('saveLpjReport', report);
    if (!result || result.status !== 'success' || !result.data) throw new Error('Supabase tidak mengonfirmasi laporan tersimpan.');
    setLpjFormData(result.data, result.message || 'LPJ berhasil disimpan.');
    showToast('✅ ' + (result.message || 'LPJ berhasil disimpan.'));
    if (typeof window.loadAccountingReportFolders === 'function') window.loadAccountingReportFolders();
  } catch (error) {
    status.textContent = 'Gagal menyimpan LPJ: ' + error.message;
    showToast('❌ Gagal menyimpan LPJ: ' + error.message);
  } finally {
    button.disabled = false;
  }
}

function lpjRowsWithCalculations(section, report) {
  const rows = report[section] || [];
  if (section === 'cash_book') {
    let balance = 0;
    return rows.map(function(row, index) {
      const debit = lpjNumber(row.debit), credit = lpjNumber(row.credit);
      balance += debit - credit;
      return [index + 1, row.date || '', row.receipt_no || '', row.category || '', row.description || '', debit, credit, balance];
    });
  }
  if (section === 'budget') {
    const totals = { 'Bahan Pangan': 0, 'Operasional': 0, 'Honorarium': 0, 'Lain-lain': 0 };
    (report.cash_book || []).forEach(function(row) { if (Object.prototype.hasOwnProperty.call(totals, row.category)) totals[row.category] += lpjNumber(row.credit); });
    return rows.map(function(row) {
      const map = { '5211-01': 'Bahan Pangan', '5211-02': 'Operasional', '5211-03': 'Honorarium', '5211-04': 'Lain-lain' };
      const budget = lpjNumber(row.budget);
      const realized = totals[map[row.code]] || 0;
      return [row.code || '', row.component || '', budget, realized, budget - realized, budget ? realized / budget : 0, budget ? (realized / budget * 100).toFixed(1) + '%' : '0.0%'];
    });
  }
  if (section === 'food_costs') return rows.map(function(row, index) {
    const total = lpjNumber(row.volume) * lpjNumber(row.average_price);
    return [index + 1, row.item || '', lpjNumber(row.volume), row.unit || '', lpjNumber(row.average_price), total];
  });
  if (section === 'stock_card') return rows.map(function(row, index) {
    const end = lpjNumber(row.opening) + lpjNumber(row.incoming) - lpjNumber(row.outgoing);
    return [index + 1, row.item_code || '', row.item || '', row.unit || '', lpjNumber(row.opening), lpjNumber(row.incoming), lpjNumber(row.outgoing), end, lpjNumber(row.physical), lpjNumber(row.physical) - end];
  });
  if (section === 'distribution') return rows.map(function(row, index) {
    return [index + 1, row.recipient || '', row.level || '', lpjNumber(row.target_per_day), lpjNumber(row.days), lpjNumber(row.target_per_day) * lpjNumber(row.days), row.bast || ''];
  });
  return rows.map(function(row, index) {
    const gross = lpjNumber(row.attendance_days) * lpjNumber(row.daily_rate);
    return [index + 1, row.name || 'Anonymous', row.role || '', lpjNumber(row.attendance_days), lpjNumber(row.daily_rate), gross, lpjNumber(row.tax), gross - lpjNumber(row.tax)];
  });
}

function buildLpjSheetDefinitions(report) {
  const identity = report.identity;
  const cashRows = lpjRowsWithCalculations('cash_book', report);
  const income = (report.cash_book || []).reduce(function(sum, row) { return sum + lpjNumber(row.debit); }, 0);
  const expense = (report.cash_book || []).reduce(function(sum, row) { return sum + lpjNumber(row.credit); }, 0);
  const balance = income - expense;
  const budgetRows = lpjRowsWithCalculations('budget', report);
  const foodRows = lpjRowsWithCalculations('food_costs', report);
  const stockRows = lpjRowsWithCalculations('stock_card', report);
  const distributionRows = lpjRowsWithCalculations('distribution', report);
  const honorRows = lpjRowsWithCalculations('honorarium', report);
  const foodTotal = foodRows.reduce(function(sum, row) { return sum + lpjNumber(row[5]); }, 0);
  const distributionTotal = distributionRows.reduce(function(sum, row) { return sum + lpjNumber(row[5]); }, 0);
  const honorTotal = honorRows.reduce(function(sum, row) { return sum + lpjNumber(row[7]); }, 0);
  const sptjmRows = [
    ['SURAT PERNYATAAN TANGGUNG JAWAB MUTLAK (SPTJM) & BA PEMERIKSAAN KAS'],
    [],
    ['Yang bertanda tangan di bawah ini:'],
    ['Nama Kepala SPPG', identity.head_name || 'Anonymous'],
    ['Jabatan', 'Kepala Satuan Pelayanan Pemenuhan Gizi (SPPG)'],
    ['Nama Satuan Pelayanan', identity.sppg_name],
    ['Kode Registrasi / SK', (identity.sppg_code || '') + (identity.decree_number ? ' / ' + identity.decree_number : '')],
    ['Alamat Dapur SPPG', identity.address],
    [],
    ['Menyatakan dengan sesungguhnya bahwa:'],
    ['1. Dana Bantuan Pemerintah (Banper) diterima sebesar', lpjNumber(identity.total_funds)],
    ['2. Realisasi belanja periode laporan sebesar', expense],
    ['3. Saldo kas akhir periode laporan sebesar', balance],
    ['4. Data dan bukti pertanggungjawaban telah diperiksa sesuai ketentuan yang berlaku.'],
    [],
    ['Mengetahui / Memeriksa', '', '', '', 'Tempat, tanggal', (report.sptjm.city || '') + (report.sptjm.statement_date ? ', ' + report.sptjm.statement_date : '')],
    ['Akuntan SPPG', '', '', '', 'Kepala SPPG (Meterai Rp10.000)'],
    [identity.accountant_name || 'Anonymous', '', '', '', identity.head_name || 'Anonymous']
  ];
  const signatureRowIndex = sptjmRows.length;
  sptjmRows.push(['', '', '', '', '', '']);
  sptjmRows.push(['( Tanda tangan digital )', '', '', '', '( Tanda tangan digital )']);
  return [
    {
      name: 'Identitas_SPPG',
      rows: [
        ['MASTER IDENTITAS & PENGATURAN ADMINISTRASI SPPG - BADAN GIZI NASIONAL'],
        [],
        ['PARAMETER', 'ISIAN DATA (EDIT PADA FORM LPJ)'],
        ['Nama Satuan Pelayanan (SPPG)', identity.sppg_name],
        ['Kode Registrasi / ID Dapur', identity.sppg_code],
        ['Alamat Lengkap Dapur', identity.address],
        ['Periode Pertanggungjawaban', identity.period],
        ['Nomor SK Penetapan / PKS', identity.decree_number],
        ['Nama Bank & No. Rekening Operasional', identity.bank_account],
        ['Nama Kepala SPPG', identity.head_name || 'Anonymous'],
        ['Nama Akuntan SPPG', identity.accountant_name || 'Anonymous'],
        ['Nama Asisten Lapangan (Logistik)', identity.logistics_name || 'Anonymous'],
        ['Nama Ahli Gizi', identity.nutritionist_name || 'Anonymous'],
        ['Target Penerima Manfaat per Hari', identity.beneficiary_target],
        ['Total Dana Banper Diterima Periode Ini (Rp)', identity.total_funds],
        ['Tanggal Pelaporan LPJ / SPTJM', identity.reporting_date || report.report_date]
      ],
      widths: [42, 54],
      headerRows: [3]
    },
    {
      name: 'Buku_Kas_Umum',
      rows: [
        ['BUKU KAS UMUM (BKU) - SATUAN PELAYANAN PEMENUHAN GIZI (SPPG)'],
        [],
        ['Nama SPPG', identity.sppg_name, '', '', 'Periode', identity.period],
        ['Kode SPPG', identity.sppg_code, '', '', 'Rekening', identity.bank_account],
        [],
        ['No', 'Tanggal', 'No. Bukti', 'Kategori Akun', 'Uraian Transaksi', 'Penerimaan / Debet (Rp)', 'Pengeluaran / Kredit (Rp)', 'Saldo Kas (Rp)'],
        ...cashRows,
        ['TOTAL MUTASI & SALDO AKHIR BKU', '', '', '', '', income, expense, balance]
      ],
      widths: [8, 15, 16, 22, 46, 22, 22, 20],
      headerRows: [6]
    },
    {
      name: 'Laporan_Realisasi_Anggaran',
      rows: [
        ['LAPORAN REALISASI ANGGARAN (LRA) - PROGRAM MAKAN BERGIZI GRATIS'],
        [],
        ['Nama SPPG', identity.sppg_name],
        ['Periode', identity.period],
        [],
        ['Kode Akun', 'Komponen Belanja', 'Pagu Anggaran RAB (Rp)', 'Realisasi Belanja (Rp)', 'Sisa Anggaran (Rp)', 'Persentase Serapan', 'Keterangan'],
        ...budgetRows.map(function(row) { return row.slice(0, 5).concat([row[6], 'Terhubung otomatis dari Buku Kas Umum']); }),
        ['TOTAL ANGGARAN & REALISASI', '', budgetRows.reduce(function(sum, row) { return sum + lpjNumber(row[2]); }, 0), budgetRows.reduce(function(sum, row) { return sum + lpjNumber(row[3]); }, 0), budgetRows.reduce(function(sum, row) { return sum + lpjNumber(row[4]); }, 0), '', 'Sisa dana dikembalikan / saldo periode berikutnya']
      ],
      widths: [16, 48, 23, 23, 22, 18, 44],
      headerRows: [6]
    },
    {
      name: 'Laporan_Biaya_Bahan_Pangan',
      rows: [
        ['LAPORAN BIAYA BAHAN PANGAN (LBBP) PER KELOMPOK KOMODITAS'],
        [],
        [],
        ['No', 'Kelompok Komoditas Pangan', 'Total Volume', 'Satuan', 'Rata-Rata Harga (Rp)', 'Total Biaya (Rp)', 'Proporsi (%)'],
        ...foodRows.map(function(row) { return [row[0], row[1], row[2], row[3], row[4], row[5], foodTotal ? row[5] / foodTotal : 0]; }),
        ['TOTAL BIAYA BAHAN PANGAN PERIODE INI', '', foodRows.reduce(function(sum, row) { return sum + lpjNumber(row[2]); }, 0), '', '', foodTotal, 1]
      ],
      widths: [8, 50, 16, 15, 23, 21, 17],
      headerRows: [4]
    },
    {
      name: 'Kartu_Stok_Bahan_Baku',
      rows: [
        ['KARTU STOK GUDANG & BERITA ACARA STOK OPNAME BAHAN BAKU'],
        [],
        [],
        ['No', 'Kode Barang', 'Nama Bahan Baku', 'Satuan', 'Stok Awal', 'Barang Masuk', 'Barang Keluar (Masak)', 'Stok Akhir Buku', 'Stok Fisik Opname', 'Selisih'],
        ...stockRows,
        ['TOTAL STOK', '', '', '', '', '', '', '', '', '']
      ],
      widths: [8, 18, 36, 15, 16, 16, 22, 20, 22, 15],
      headerRows: [4]
    },
    {
      name: 'BAST_Distribusi_Porsi',
      rows: [
        ['REKAPITULASI BERITA ACARA SERAH TERIMA (BAST) DISTRIBUSI MAKANAN'],
        [],
        [],
        ['No', 'Nama Sekolah / Posyandu Penerima', 'Jenjang', 'Target Porsi/Hari', 'Jumlah Hari Aktif', 'Total Porsi Tersalurkan', 'No. BAST & Status'],
        ...distributionRows,
        ['TOTAL DISTRIBUSI PENERIMA MANFAAT', '', '', '', '', distributionTotal, '']
      ],
      widths: [8, 44, 18, 20, 19, 24, 28],
      headerRows: [4]
    },
    {
      name: 'Honorarium_Relawan',
      rows: [
        ['DAFTAR HADIR & REKAPITULASI INSENTIF RELAWAN DAPUR SPPG'],
        [],
        [],
        ['No', 'Nama Relawan / Tenaga Dapur', 'Jabatan / Tugas', 'Jumlah Hari Hadir', 'Tarif Insentif/Hari (Rp)', 'Total Bruto (Rp)', 'Potongan PPh 21 (Rp)', 'Insentif Bersih Diterima (Rp)'],
        ...honorRows,
        ['TOTAL INSENTIF RELAWAN PERIODE INI', '', '', '', '', honorRows.reduce(function(sum, row) { return sum + lpjNumber(row[5]); }, 0), honorRows.reduce(function(sum, row) { return sum + lpjNumber(row[6]); }, 0), honorTotal]
      ],
      widths: [8, 34, 34, 19, 23, 22, 22, 26],
      headerRows: [4]
    },
    {
      name: 'SPTJM_dan_BA_Kas',
      rows: sptjmRows,
      widths: [43, 26, 18, 16, 36, 28],
      headerRows: [],
      signatureRowIndex: signatureRowIndex
    }
  ];
}

async function exportLpjExcel() {
  if (!window.ExcelJS || typeof window.ExcelJS.Workbook !== 'function') {
    showToast('❌ Library Excel belum termuat. Muat ulang halaman lalu coba kembali.');
    return;
  }
  const form = document.getElementById('lpjForm');
  if (!form.reportValidity()) return;
  try {
    const report = collectLpjFormData();
    const definitions = buildLpjSheetDefinitions(report);
    const workbook = new window.ExcelJS.Workbook();
    workbook.creator = 'SPAS1';
    workbook.subject = 'Laporan Pertanggungjawaban Administrasi SPPG';
    workbook.created = new Date();
    definitions.forEach(function(definition) {
      const worksheet = workbook.addWorksheet(definition.name, {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
      });
      worksheet.addRows(definition.rows);
      worksheet.columns = definition.widths.map(function(width) { return { width: width }; });
      worksheet.views = [{ state: 'frozen', ySplit: definition.headerRows.length ? definition.headerRows[0] : 3 }];
      worksheet.getRow(1).height = 28;
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      if (definition.rows[0].length > 1) worksheet.mergeCells(1, 1, 1, definition.rows[0].length);
      definition.headerRows.forEach(function(rowNumber) {
        const row = worksheet.getRow(rowNumber);
        row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
        row.alignment = { vertical: 'middle', wrapText: true };
      });
      worksheet.eachRow(function(row) {
        row.eachCell(function(cell) {
          cell.alignment = { vertical: 'top', wrapText: true };
        });
      });
      if (definition.name === 'SPTJM_dan_BA_Kas' && definition.signatureRowIndex != null) {
        worksheet.getRow(definition.signatureRowIndex + 1).height = 58;
        if (report.signatures.accountant) {
          const imageId = workbook.addImage({ base64: report.signatures.accountant, extension: 'png' });
          worksheet.addImage(imageId, { tl: { col: 1, row: definition.signatureRowIndex }, br: { col: 3, row: definition.signatureRowIndex + 2 } });
        }
        if (report.signatures.head) {
          const imageId = workbook.addImage({ base64: report.signatures.head, extension: 'png' });
          worksheet.addImage(imageId, { tl: { col: 4, row: definition.signatureRowIndex }, br: { col: 6, row: definition.signatureRowIndex + 2 } });
        }
      }
    });
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'LPJ_SPPG_' + report.report_date + '.xlsx');
    showToast('✅ Ekspor LPJ dengan 8 lembar berhasil.');
  } catch (error) {
    console.error('Ekspor Excel LPJ gagal:', error);
    showToast('❌ Ekspor Excel LPJ gagal: ' + error.message);
  }
}
