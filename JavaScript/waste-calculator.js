(function () {
  'use strict';

  var RATE_PER_KG = 2000;
  var WEIGHT_INCREMENT = 0.5;
  var form = document.getElementById('wasteCalcForm');
  var quantityInput = document.getElementById('wasteQuantity');
  var weightInput = document.getElementById('wasteWeight');
  var decreaseWeightButton = document.getElementById('wasteWeightDecrease');
  var increaseWeightButton = document.getElementById('wasteWeightIncrease');
  var categoryInputs = form ? Array.prototype.slice.call(form.querySelectorAll('input[name="wasteType"]')) : [];
  var rateOutput = document.getElementById('wasteCalcRate');
  var valueOutput = document.getElementById('wasteCalcValue');
  var note = document.getElementById('wasteCalcNote');
  var error = document.getElementById('wasteCalcError');
  var b3Note = document.getElementById('wasteB3Note');

  if (!form || !quantityInput || !weightInput || !categoryInputs.length || !rateOutput || !valueOutput || !note || !error || !b3Note) {
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
  var quantityFormatter = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0
  });

  function showError(message, invalidField) {
    error.textContent = message;
    error.classList.toggle('d-none', !message);
    quantityInput.classList.toggle('is-invalid', invalidField === 'quantity');
    weightInput.classList.toggle('is-invalid', invalidField === 'weight');
    if (invalidField === 'quantity') {
      quantityInput.setAttribute('aria-invalid', 'true');
    } else {
      quantityInput.removeAttribute('aria-invalid');
    }
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

  function clearEstimate() {
    rateOutput.textContent = '—';
    valueOutput.textContent = '—';
    note.textContent = 'Pilih jenis, masukkan jumlah dan berat, lalu tekan Hitung estimasi.';
    showError('', '');
  }

  function calculateEstimate() {
    var selectedType = form.querySelector('input[name="wasteType"]:checked');
    var rawQuantity = quantityInput.value.trim();
    var rawWeight = weightInput.value.trim();

    if (!selectedType) {
      b3Note.classList.add('d-none');
      clearEstimate();
      showError('Pilih jenis sampah terlebih dahulu.', 'type');
      return;
    }

    b3Note.classList.toggle('d-none', selectedType.value !== 'b3');
    if (!rawQuantity) {
      clearEstimate();
      showError('Masukkan jumlah sampah terlebih dahulu.', 'quantity');
      return;
    }

    var quantity = Number(rawQuantity);
    if (!isFinite(quantity) || quantity <= 0 || Math.floor(quantity) !== quantity) {
      clearEstimate();
      note.textContent = 'Jumlah sampah harus berupa bilangan bulat lebih dari 0.';
      showError('Masukkan jumlah sampah berupa bilangan bulat lebih dari 0.', 'quantity');
      return;
    }

    if (!rawWeight) {
      clearEstimate();
      showError('Masukkan berat total sampah terlebih dahulu.', 'weight');
      return;
    }

    var weight = Number(rawWeight);
    if (!isFinite(weight) || weight <= 0) {
      clearEstimate();
      note.textContent = 'Berat harus lebih dari 0 kg.';
      showError('Masukkan berat sampah yang valid.', 'weight');
      return;
    }

    var estimate = weight * RATE_PER_KG;
    if (!isFinite(estimate)) {
      clearEstimate();
      note.textContent = 'Berat yang dimasukkan terlalu besar.';
      showError('Masukkan berat sampah yang lebih kecil.', 'weight');
      return;
    }

    showError('', '');
    rateOutput.textContent = currencyFormatter.format(RATE_PER_KG);
    valueOutput.textContent = currencyFormatter.format(estimate);
    note.textContent = selectedType.dataset.label + ' · ' +
      quantityFormatter.format(quantity) + ' item · ' +
      weightFormatter.format(weight) + ' kg × Rp 2.000/kg';
  }

  quantityInput.addEventListener('input', function () {
    clearEstimate();
  });

  weightInput.addEventListener('input', function () {
    clearEstimate();
  });

  function adjustWeight(amount) {
    var currentWeight = Number(weightInput.value);
    if (!isFinite(currentWeight)) {
      currentWeight = 0;
    }

    var nextWeight = Math.max(0, Math.round((currentWeight + amount) * 100) / 100);
    weightInput.value = nextWeight ? String(nextWeight) : '';
    clearEstimate();
  }

  if (decreaseWeightButton && increaseWeightButton) {
    decreaseWeightButton.addEventListener('click', function () {
      adjustWeight(-WEIGHT_INCREMENT);
    });
    increaseWeightButton.addEventListener('click', function () {
      adjustWeight(WEIGHT_INCREMENT);
    });
  }

  categoryInputs.forEach(function (input) {
    input.addEventListener('change', function () {
      b3Note.classList.toggle('d-none', input.value !== 'b3');
      clearEstimate();
    });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    calculateEstimate();
  });
})();
