(function() {
  'use strict';

  const STORAGE_KEY = 'spas1_super_gizi_v1';
  const CATEGORIES = [
    'Karbohidrat',
    'Protein Hewani',
    'Protein Nabati',
    'Sayuran',
    'Susu',
    'Buah-Buahan',
    'Pelengkap'
  ];
  const NUTRIENTS = [
    { key: 'energy', label: 'Energi', unit: 'kkal' },
    { key: 'protein', label: 'Protein', unit: 'g' },
    { key: 'fat', label: 'Lemak', unit: 'g' },
    { key: 'carbs', label: 'Karbohidrat', unit: 'g' },
    { key: 'fiber', label: 'Serat', unit: 'g' },
    { key: 'vitaminA', label: 'Vitamin A', unit: 'µg' },
    { key: 'vitaminC', label: 'Vitamin C', unit: 'mg' },
    { key: 'calcium', label: 'Kalsium', unit: 'mg' },
    { key: 'iron', label: 'Zat besi', unit: 'mg' }
  ];
  const DEFAULT_STATE = {
    ingredients: [],
    targets: { energy: 2150 }
  };

  function numberOrZero(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  }

  function calculate(ingredients, targets) {
    if (!Array.isArray(ingredients)) throw new TypeError('Daftar bahan harus berupa array.');
    if (!targets || typeof targets !== 'object' || Array.isArray(targets)) {
      throw new TypeError('Target AKG harus berupa objek nilai target.');
    }
    const totals = {};
    const categoryTotals = {};
    NUTRIENTS.forEach(function(nutrient) { totals[nutrient.key] = 0; });

    ingredients.forEach(function(ingredient) {
      const grams = numberOrZero(ingredient.grams);
      if (!categoryTotals[ingredient.category]) {
        categoryTotals[ingredient.category] = {};
        NUTRIENTS.forEach(function(nutrient) { categoryTotals[ingredient.category][nutrient.key] = 0; });
      }
      NUTRIENTS.forEach(function(nutrient) {
        const amount = numberOrZero(ingredient[nutrient.key + 'Per100']) * grams / 100;
        totals[nutrient.key] += amount;
        categoryTotals[ingredient.category][nutrient.key] += amount;
      });
    });

    const percentages = {};
    NUTRIENTS.forEach(function(nutrient) {
      const target = Number(targets[nutrient.key]);
      percentages[nutrient.key] = Number.isFinite(target) && target > 0
        ? totals[nutrient.key] / target * 100
        : null;
    });
    return { totals: totals, categoryTotals: categoryTotals, percentages: percentages };
  }

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_STATE));
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.ingredients) || !parsed.targets ||
          typeof parsed.targets !== 'object' || Array.isArray(parsed.targets) ||
          parsed.ingredients.some(function(ingredient) { return !ingredient || typeof ingredient !== 'object' || Array.isArray(ingredient); })) {
        throw new Error('Format data Kalkulator AKG lokal tidak sesuai.');
      }
      return { ingredients: parsed.ingredients, targets: parsed.targets };
    } catch (error) {
      console.error('Gagal memuat data SUPER GIZI dari browser:', error);
      throw error;
    }
  }

  function saveState(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      const status = document.getElementById('sgSaveStatus');
      if (status) status.textContent = 'Tersimpan di browser ini';
    } catch (error) {
      console.error('Gagal menyimpan data SUPER GIZI di browser:', error);
      const status = document.getElementById('sgSaveStatus');
      if (status) status.textContent = 'Gagal menyimpan data browser';
      if (typeof window.showToast === 'function') window.showToast('Gagal menyimpan data SUPER GIZI: ' + error.message);
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function(character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function formatAmount(value, digits) {
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits === undefined ? 2 : digits }).format(value);
  }

  function renderIngredientRows(state) {
    const body = document.getElementById('sgIngredientRows');
    if (!body) return;
    if (!state.ingredients.length) {
      body.innerHTML = '<tr><td colspan="4" class="px-3 py-5 text-center text-gray-500">Belum ada bahan. Tambahkan bahan dengan data gizi per 100 g.</td></tr>';
      return;
    }
    body.innerHTML = state.ingredients.map(function(ingredient, index) {
      const values = NUTRIENTS.map(function(nutrient) {
        const amount = numberOrZero(ingredient[nutrient.key + 'Per100']) * numberOrZero(ingredient.grams) / 100;
        return '<span>' + escapeHtml(nutrient.label) + ': ' + formatAmount(amount) + ' ' + escapeHtml(nutrient.unit) + '</span>';
      }).join('');
      const sourceValues = NUTRIENTS.map(function(nutrient) {
        return escapeHtml(nutrient.label) + ': ' + formatAmount(numberOrZero(ingredient[nutrient.key + 'Per100'])) +
          ' ' + escapeHtml(nutrient.unit);
      }).join(' · ');
      return '<tr class="border-t border-gray-200 align-top"><td class="px-3 py-3 font-semibold">' + escapeHtml(ingredient.name) +
        '<div class="mt-1 text-[10px] font-normal text-gray-500">' + values + '</div><div class="mt-1 text-[9px] font-normal text-gray-400">Data per 100 g: ' +
        sourceValues + '</div></td><td class="px-3 py-3">' +
        escapeHtml(ingredient.category) + '</td><td class="px-3 py-3 whitespace-nowrap">' + formatAmount(numberOrZero(ingredient.grams)) +
        ' g</td><td class="px-3 py-3"><div class="no-print flex gap-1"><button type="button" class="rounded-lg bg-indigo-100 px-2.5 py-1.5 text-xs font-bold text-indigo-700" data-edit-ingredient="' +
        index + '" aria-label="Ubah ' + escapeHtml(ingredient.name) + '">Ubah</button><button type="button" class="rounded-lg bg-red-100 px-2.5 py-1.5 text-xs font-bold text-red-700" data-remove-ingredient="' +
        index + '" aria-label="Hapus ' + escapeHtml(ingredient.name) + '">Hapus</button></div></td></tr>';
    }).join('');
  }

  function renderVisualDashboard(state, result) {
    const energyDonut = document.getElementById('sgEnergyDonut');
    const energyValue = document.getElementById('sgEnergyDonutValue');
    const energyCaption = document.getElementById('sgEnergyDonutCaption');
    const energyTitle = document.getElementById('sgEnergyDonutTitle');
    const energyPercent = result.percentages.energy;
    const energyTarget = Number(state.targets.energy);
    if (energyDonut && energyValue && energyCaption && energyTitle) {
      const progress = energyPercent === null ? 0 : Math.min(100, Math.max(0, energyPercent));
      energyDonut.style.setProperty('--sg-progress', progress + '%');
      energyValue.textContent = energyPercent === null ? '—' : formatAmount(energyPercent) + '%';
      energyDonut.setAttribute('aria-label', energyPercent === null
        ? 'Target energi belum diisi.'
        : 'Energi per porsi ' + formatAmount(result.totals.energy) + ' dari target ' +
          formatAmount(energyTarget) + ' kkal, kontribusi ' + formatAmount(energyPercent) + ' persen.');
      energyTitle.textContent = energyPercent !== null && energyPercent > 100
        ? 'Target energi terlampaui'
        : 'Kontribusi energi';
      energyCaption.textContent = energyPercent === null
        ? 'Isi target energi untuk melihat grafik.'
        : state.ingredients.length
          ? 'Menu per porsi dibanding target.'
          : 'Tambahkan bahan untuk memulai.';
    }

    const macroCards = document.getElementById('sgMacroCards');
    if (macroCards) {
      const macros = [
        { key: 'energy', label: 'Energi', icon: '⚡' },
        { key: 'carbs', label: 'Karbohidrat', icon: '◉' },
        { key: 'protein', label: 'Protein', icon: '◆' },
        { key: 'fat', label: 'Lemak', icon: '●' }
      ];
      macroCards.innerHTML = macros.map(function(macro) {
        const nutrient = NUTRIENTS.find(function(item) { return item.key === macro.key; });
        const target = Number(state.targets[macro.key]);
        const percent = result.percentages[macro.key];
        return '<article class="sg-macro-card" data-nutrient="' + macro.key + '"><h4>' + macro.icon + ' ' +
          escapeHtml(macro.label) + '</h4><strong>' + formatAmount(result.totals[macro.key]) +
          ' <small>' + escapeHtml(nutrient.unit) + '</small></strong><span>' +
          (percent === null ? 'Target belum diisi' : formatAmount(percent) + '% dari ' + formatAmount(target) + ' ' + escapeHtml(nutrient.unit)) +
          '</span></article>';
      }).join('');
    }

    const nutrientBars = document.getElementById('sgNutrientBars');
    if (nutrientBars) {
      nutrientBars.innerHTML = NUTRIENTS.map(function(nutrient) {
        const target = Number(state.targets[nutrient.key]);
        const percent = result.percentages[nutrient.key];
        const width = percent === null ? 0 : Math.min(100, Math.max(0, percent));
        const overTarget = percent !== null && percent > 100;
        const targetText = percent === null
          ? 'Isi target'
          : formatAmount(percent) + '%';
        return '<div class="sg-nutrient-bar-row"><span>' + escapeHtml(nutrient.label) + '</span><div class="sg-chart-track" role="progressbar" aria-label="Kontribusi ' +
          escapeHtml(nutrient.label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + width +
          '" aria-valuetext="' + escapeHtml(targetText) + '"><span class="sg-chart-fill' + (overTarget ? ' is-over-target' : '') +
          '" style="width:' + width + '%"></span></div><strong>' + targetText + '</strong></div>';
      }).join('');
    }

    const topNutrients = document.getElementById('sgTopNutrients');
    if (topNutrients) {
      const ranked = state.ingredients.length
        ? NUTRIENTS.filter(function(nutrient) { return result.percentages[nutrient.key] !== null; })
          .sort(function(first, second) { return result.percentages[second.key] - result.percentages[first.key]; })
          .slice(0, 3)
        : [];
      topNutrients.innerHTML = ranked.length
        ? ranked.map(function(nutrient, index) {
          return '<article class="sg-top-card"><span>' + (index + 1) + ' · ' + formatAmount(result.percentages[nutrient.key]) +
            '% target</span><strong>' + escapeHtml(nutrient.label) + '</strong></article>';
        }).join('')
        : '<p class="text-xs text-gray-500">Tambahkan bahan dan isi target zat gizi untuk melihat ringkasan.</p>';
    }
  }

  function renderSummary(state) {
    const result = calculate(state.ingredients, state.targets);
    renderVisualDashboard(state, result);
    const summary = document.getElementById('sgNutrientSummary');
    const categories = document.getElementById('sgCategorySummary');
    if (summary) {
      summary.innerHTML = NUTRIENTS.map(function(nutrient) {
        const target = Number(state.targets[nutrient.key]);
        const hasTarget = Number.isFinite(target) && target > 0;
        const percent = result.percentages[nutrient.key];
        return '<tr class="border-t border-gray-200"><th scope="row" class="px-3 py-2 text-left font-semibold">' +
          escapeHtml(nutrient.label) + '</th><td class="px-3 py-2 text-right">' + formatAmount(result.totals[nutrient.key]) +
          ' ' + escapeHtml(nutrient.unit) + '</td><td class="px-3 py-2 text-right">' +
          (hasTarget ? formatAmount(target) + ' ' + escapeHtml(nutrient.unit) : 'Belum diisi') +
          '</td><td class="px-3 py-2 text-right font-bold">' + (percent === null ? '—' : formatAmount(percent) + '%') + '</td></tr>';
      }).join('');
    }
    if (categories) {
      categories.innerHTML = CATEGORIES.map(function(category) {
        const values = result.categoryTotals[category] || {};
        const hasIngredients = state.ingredients.some(function(ingredient) { return ingredient.category === category; });
        if (!hasIngredients) return '';
        return '<tr class="border-t border-gray-200"><th scope="row" class="px-3 py-2 text-left font-semibold">' + escapeHtml(category) +
          '</th><td class="px-3 py-2 text-right">' + formatAmount(values.energy || 0) +
          ' kkal</td><td class="px-3 py-2 text-right">' + formatAmount(values.protein || 0) +
          ' g</td><td class="px-3 py-2 text-right">' + formatAmount(values.carbs || 0) + ' g</td></tr>';
      }).filter(Boolean).join('') || '<tr><td colspan="4" class="px-3 py-4 text-center text-gray-500">Kategori akan muncul setelah bahan ditambahkan.</td></tr>';
    }
    renderIngredientRows(state);
  }

  function persistAndRender(state) {
    saveState(state);
    renderSummary(state);
  }

  function resetIngredientForm(form) {
    form.reset();
    delete form.dataset.editIndex;
    document.getElementById('sgCategory').value = CATEGORIES[0];
    document.getElementById('sgSubmitButton').textContent = 'Tambahkan Bahan';
    document.getElementById('sgCancelEditButton').classList.add('hidden');
  }

  function addIngredient(state) {
    const form = document.getElementById('sgIngredientForm');
    if (!form) return;
    const formData = new FormData(form);
    const ingredient = {
      name: String(formData.get('name') || '').trim(),
      category: String(formData.get('category') || ''),
      grams: Number(formData.get('grams'))
    };
    if (!ingredient.name) {
      window.alert('Nama bahan wajib diisi.');
      return;
    }
    if (!CATEGORIES.includes(ingredient.category)) {
      window.alert('Pilih kategori bahan yang tersedia.');
      return;
    }
    if (!Number.isFinite(ingredient.grams) || ingredient.grams < 0) {
      window.alert('Gramasi per porsi harus berupa angka nol atau lebih.');
      return;
    }
    for (const nutrient of NUTRIENTS) {
      const raw = formData.get(nutrient.key + 'Per100');
      const value = Number(raw);
      if (raw === null || raw === '' || !Number.isFinite(value) || value < 0) {
        window.alert('Isi nilai ' + nutrient.label + ' per 100 g dengan angka nol atau lebih. Jika tidak ada, isi 0.');
        return;
      }
      ingredient[nutrient.key + 'Per100'] = value;
    }
    const editIndex = Number(form.dataset.editIndex);
    if (Number.isInteger(editIndex) && editIndex >= 0 && editIndex < state.ingredients.length) {
      state.ingredients[editIndex] = ingredient;
      delete form.dataset.editIndex;
      document.getElementById('sgSubmitButton').textContent = 'Tambahkan Bahan';
      document.getElementById('sgCancelEditButton').classList.add('hidden');
    } else {
      state.ingredients.push(ingredient);
    }
    resetIngredientForm(form);
    persistAndRender(state);
  }

  function exportCsv(state) {
    const result = calculate(state.ingredients, state.targets);
    const rows = [
      ['Ringkasan Gizi per porsi'],
      ['Zat gizi', 'Hasil', 'Satuan', 'Target', 'Kontribusi target (%)']
    ];
    NUTRIENTS.forEach(function(nutrient) {
      const target = Number(state.targets[nutrient.key]);
      rows.push([
        nutrient.label,
        formatAmount(result.totals[nutrient.key]),
        nutrient.unit,
        Number.isFinite(target) && target > 0 ? formatAmount(target) : '',
        result.percentages[nutrient.key] === null ? '' : formatAmount(result.percentages[nutrient.key])
      ]);
    });
    rows.push([], ['Bahan', 'Kategori', 'Gram per porsi'].concat(NUTRIENTS.map(function(nutrient) {
      return nutrient.label + ' per 100 g';
    })));
    state.ingredients.forEach(function(ingredient) {
      rows.push([ingredient.name, ingredient.category, ingredient.grams].concat(NUTRIENTS.map(function(nutrient) {
        return ingredient[nutrient.key + 'Per100'];
      })));
    });
    const csv = '\uFEFF' + rows.map(function(row) {
      return row.map(function(value) { return '"' + String(value === undefined ? '' : value).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kalkulator-akg-spas1.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  }

  let state = null;
  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;
    try {
      state = loadState();
    } catch (error) {
      state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      if (typeof window.showToast === 'function') window.showToast('Data SUPER GIZI tidak dapat dibaca: ' + error.message);
    }
    NUTRIENTS.forEach(function(nutrient) {
      const input = document.querySelector('[data-sg-target="' + nutrient.key + '"]');
      if (!input) return;
      input.value = state.targets[nutrient.key] === undefined ? '' : String(state.targets[nutrient.key]);
      input.addEventListener('input', function() {
        if (input.value.trim() === '') {
          input.setCustomValidity('');
          delete state.targets[nutrient.key];
        }
        else {
          const value = Number(input.value);
          if (!Number.isFinite(value) || value < 0) {
            input.setCustomValidity('Masukkan angka 0 atau lebih.');
            const status = document.getElementById('sgSaveStatus');
            if (status) status.textContent = 'Target ' + nutrient.label + ' tidak valid';
            return;
          }
          input.setCustomValidity('');
          state.targets[nutrient.key] = value;
        }
        persistAndRender(state);
      });
    });
    const form = document.getElementById('sgIngredientForm');
    if (form) form.addEventListener('submit', function(event) {
      event.preventDefault();
      addIngredient(state);
    });
    const rows = document.getElementById('sgIngredientRows');
    if (rows) rows.addEventListener('click', function(event) {
      const target = event.target.closest('[data-remove-ingredient], [data-edit-ingredient]');
      if (!target) return;
      const index = Number(target.dataset.removeIngredient || target.dataset.editIngredient);
      if (target.hasAttribute('data-edit-ingredient')) {
        const ingredient = state.ingredients[index];
        const form = document.getElementById('sgIngredientForm');
        if (!ingredient || !form) return;
        Object.keys(ingredient).forEach(function(key) {
          const input = form.elements.namedItem(key);
          if (input) input.value = String(ingredient[key]);
        });
        form.dataset.editIndex = String(index);
        document.getElementById('sgSubmitButton').textContent = 'Simpan Perubahan';
        document.getElementById('sgCancelEditButton').classList.remove('hidden');
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (!Number.isInteger(index) || index < 0 || index >= state.ingredients.length) return;
      const form = document.getElementById('sgIngredientForm');
      const editIndex = form && Number(form.dataset.editIndex);
      if (form && Number.isInteger(editIndex)) {
        if (editIndex === index) resetIngredientForm(form);
        else if (editIndex > index) form.dataset.editIndex = String(editIndex - 1);
      }
      state.ingredients.splice(index, 1);
      persistAndRender(state);
    });
    const cancelEditButton = document.getElementById('sgCancelEditButton');
    if (cancelEditButton) cancelEditButton.addEventListener('click', function() {
      const form = document.getElementById('sgIngredientForm');
      if (!form) return;
      resetIngredientForm(form);
    });
    const resetButton = document.getElementById('sgResetButton');
    if (resetButton) resetButton.addEventListener('click', function() {
      if (!window.confirm('Hapus semua bahan dan target AKG yang tersimpan di browser ini?')) return;
      state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      const form = document.getElementById('sgIngredientForm');
      if (form) resetIngredientForm(form);
      NUTRIENTS.forEach(function(nutrient) {
        const input = document.querySelector('[data-sg-target="' + nutrient.key + '"]');
        if (input) input.value = state.targets[nutrient.key] === undefined ? '' : String(state.targets[nutrient.key]);
      });
      persistAndRender(state);
    });
    const exportButton = document.getElementById('sgExportButton');
    if (exportButton) exportButton.addEventListener('click', function() { exportCsv(state); });
    renderSummary(state);
  }

  window.SuperGizi = { calculate: calculate, init: init, nutrients: NUTRIENTS };
})();
