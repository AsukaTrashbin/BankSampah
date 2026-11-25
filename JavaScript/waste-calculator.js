(function () {
  'use strict';

  var RATE_PER_KG = 2000;
  var form = document.getElementById('wasteCalcForm');
  var weightInput = document.getElementById('wasteWeight');
  var categoryInputs = form ? Array.prototype.slice.call(form.querySelectorAll('input[name="wasteType"]')) : [];
  var valueOutput = document.getElementById('wasteCalcValue');
  var note = document.getElementById('wasteCalcNote');
  var error = document.getElementById('wasteCalcError');
  var b3Note = document.getElementById('wasteB3Note');

  if (!form || !weightInput || !categoryInputs.length || !valueOutput || !note || !error || !b3Note) {
    return;
  }

  var currencyFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  });
  var weightFormatter = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2
  });

  function showError(message, invalidField) {
    error.textContent = message;
    error.classList.toggle('d-none', !message);
    weightInput.classList.toggle('is-invalid', invalidField === 'weight');
    if (invalidField === 'weight') {
      weightInput.setAttribute('aria-invalid', 'true');
    } else {
      weightInput.removeAttribute('aria-invalid');
    }
    categoryInputs.forEach(function (input) {
      if (invalidField === 'type') {
        input.setAttribute('aria-invalid', 'true');
      } else {
        input.removeAttribute('aria-invalid');
      }
    });
  }

  function updateEstimate(showEmptyError) {
    var selectedType = form.querySelector('input[name="wasteType"]:checked');
    var rawWeight = weightInput.value.trim();

    if (!selectedType) {
      valueOutput.textContent = '—';
      note.textContent = 'Pilih jenis dan masukkan berat untuk mulai menghitung.';
      b3Note.classList.add('d-none');
      showError(showEmptyError ? 'Pilih jenis sampah terlebih dahulu.' : '', showEmptyError ? 'type' : '');
      return;
    }

    b3Note.classList.toggle('d-none', selectedType.value !== 'b3');
    if (!rawWeight) {
      valueOutput.textContent = '—';
      note.textContent = selectedType.dataset.label + ' dipilih. Masukkan berat untuk melihat estimasi.';
      showError(showEmptyError ? 'Masukkan berat sampah terlebih dahulu.' : '', showEmptyError ? 'weight' : '');
      return;
    }

    var weight = Number(rawWeight);
    if (!isFinite(weight) || weight <= 0) {
      valueOutput.textContent = '—';
      note.textContent = 'Berat harus lebih dari 0 kg.';
      showError('Masukkan berat sampah yang valid.', 'weight');
      return;
    }

    var estimate = weight * RATE_PER_KG;
    if (!isFinite(estimate)) {
      valueOutput.textContent = '—';
      note.textContent = 'Berat yang dimasukkan terlalu besar.';
      showError('Masukkan berat sampah yang lebih kecil.', 'weight');
      return;
    }

    showError('', '');
    valueOutput.textContent = currencyFormatter.format(estimate);
    note.textContent = selectedType.dataset.label + ' · ' +
      weightFormatter.format(weight) + ' kg × Rp 2.000/kg';
  }

  weightInput.addEventListener('input', function () {
    updateEstimate(false);
  });

  categoryInputs.forEach(function (input) {
    input.addEventListener('change', function () {
      updateEstimate(false);
    });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    updateEstimate(true);
  });
})();
