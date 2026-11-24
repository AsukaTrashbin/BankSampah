(function () {
  'use strict';

  var RATE_PER_KG = 2000;
  var form = document.getElementById('wasteCalcForm');
  var weightInput = document.getElementById('wasteWeight');
  var valueOutput = document.getElementById('wasteCalcValue');
  var note = document.getElementById('wasteCalcNote');
  var error = document.getElementById('wasteCalcError');

  if (!form || !weightInput || !valueOutput || !note || !error) {
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

  function showError(message) {
    error.textContent = message;
    error.classList.toggle('d-none', !message);
    weightInput.classList.toggle('is-invalid', Boolean(message));
    if (message) {
      weightInput.setAttribute('aria-invalid', 'true');
    } else {
      weightInput.removeAttribute('aria-invalid');
    }
  }

  function updateEstimate(showEmptyError) {
    var rawWeight = weightInput.value.trim();
    if (!rawWeight) {
      valueOutput.textContent = '—';
      note.textContent = 'Masukkan berat untuk mulai menghitung.';
      showError(showEmptyError ? 'Masukkan berat sampah terlebih dahulu.' : '');
      return;
    }

    var weight = Number(rawWeight);
    if (!isFinite(weight) || weight <= 0) {
      valueOutput.textContent = '—';
      note.textContent = 'Berat harus lebih dari 0 kg.';
      showError('Masukkan berat sampah yang valid.');
      return;
    }

    var estimate = weight * RATE_PER_KG;
    if (!isFinite(estimate)) {
      valueOutput.textContent = '—';
      note.textContent = 'Berat yang dimasukkan terlalu besar.';
      showError('Masukkan berat sampah yang lebih kecil.');
      return;
    }

    showError('');
    valueOutput.textContent = currencyFormatter.format(estimate);
    note.textContent = weightFormatter.format(weight) + ' kg × Rp 2.000/kg';
  }

  weightInput.addEventListener('input', function () {
    updateEstimate(false);
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    updateEstimate(true);
  });
})();
