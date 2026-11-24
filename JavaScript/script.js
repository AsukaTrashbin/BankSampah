/* =====================================================================
   script.js — Navbar (scrollspy, indikator geser) + Feedback
   Catatan: login.js dan auth-guard.js sengaja dipisah.
   ===================================================================== */

/* ---------- Navbar ---------- */
(function () {
  'use strict';

  var DESKTOP_QUERY = '(min-width: 992px)';
  var SCROLL_LOCK_MS = 900;

  var navbar = document.querySelector('.cb-navbar');
  var list = document.querySelector('.cb-nav');
  if (!navbar || !list) {
    return;
  }

  var links = Array.prototype.slice.call(list.querySelectorAll('.nav-link'));
  var desktop = window.matchMedia(DESKTOP_QUERY);
  var indicator = null;
  var hovering = false;
  var lockUntil = 0;
  var ticking = false;

  /* ---------- Indikator geser (desktop) ---------- */

  function createIndicator() {
    indicator = document.createElement('span');
    indicator.className = 'cb-nav-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    list.appendChild(indicator);
    list.classList.add('cb-has-indicator');
  }

  function currentActive() {
    return list.querySelector('.nav-link.active');
  }

  function moveIndicator(link, animate) {
    if (!indicator) {
      return;
    }
    if (!link || !desktop.matches) {
      indicator.style.opacity = '0';
      return;
    }

    var listRect = list.getBoundingClientRect();
    var linkRect = link.getBoundingClientRect();
    var pad = parseFloat(getComputedStyle(link).paddingLeft) || 0;
    var left = linkRect.left - listRect.left + pad;
    var top = linkRect.bottom - listRect.top - 3.6;

    if (animate === false) {
      indicator.classList.add('no-anim');
    }
    indicator.style.width = Math.max(linkRect.width - pad * 2, 0) + 'px';
    indicator.style.transform = 'translate(' + left + 'px,' + top + 'px)';
    indicator.style.opacity = '1';
    if (animate === false) {
      // paksa reflow supaya posisi awal tidak dianimasikan
      void indicator.offsetWidth;
      indicator.classList.remove('no-anim');
    }
  }

  function restoreIndicator(animate) {
    moveIndicator(currentActive(), animate);
  }

  /* ---------- Status aktif ---------- */

  function setActive(link) {
    links.forEach(function (item) {
      var on = item === link;
      item.classList.toggle('active', on);
      if (on) {
        item.setAttribute('aria-current', 'page');
      } else {
        item.removeAttribute('aria-current');
      }
    });
    if (!hovering) {
      restoreIndicator();
    }
  }

  /* ---------- Scrollspy ---------- */

  function buildTargets() {
    var targets = [];
    links.forEach(function (link) {
      var href = link.getAttribute('href') || '';
      if (href.charAt(0) !== '#' || href.length < 2) {
        return;
      }
      var id = href.slice(1);
      var el = document.getElementById(id);
      if (el) {
        targets.push({ id: id, el: el, link: link });
      }
    });
    return targets;
  }

  var targets = buildTargets();

  function targetTop(target) {
    // #home adalah navbar yang sticky, jadi dianggap berada di paling atas halaman
    if (target.id === 'home') {
      return 0;
    }
    return target.el.getBoundingClientRect().top + window.pageYOffset;
  }

  function updateSpy() {
    ticking = false;
    navbar.classList.toggle('is-scrolled', window.pageYOffset > 24);

    if (!targets.length || Date.now() < lockUntil) {
      return;
    }

    var probe = window.pageYOffset + navbar.offsetHeight + 40;
    var current = targets[0];
    var currentTop = -Infinity;

    targets.forEach(function (target) {
      var top = targetTop(target);
      if (top <= probe && top >= currentTop) {
        current = target;
        currentTop = top;
      }
    });

    if (current.link !== currentActive()) {
      setActive(current.link);
    }
  }

  function requestSpy() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateSpy);
    }
  }

  /* ---------- Event ---------- */

  function closeMobileMenu() {
    var menu = document.getElementById('cbNav');
    if (!menu || !menu.classList.contains('show') || !window.bootstrap) {
      return;
    }
    window.bootstrap.Collapse.getOrCreateInstance(menu).hide();
  }

  links.forEach(function (link) {
    link.addEventListener('mouseenter', function () {
      hovering = true;
      moveIndicator(link);
    });
    link.addEventListener('focus', function () {
      hovering = true;
      moveIndicator(link);
    });
    link.addEventListener('blur', function () {
      hovering = false;
      restoreIndicator();
    });

    link.addEventListener('click', function () {
      var href = link.getAttribute('href') || '';
      if (href.charAt(0) !== '#') {
        return;
      }
      // Tahan scrollspy selama scroll halus supaya menu tidak berkedip
      lockUntil = Date.now() + SCROLL_LOCK_MS;
      setActive(link);
      closeMobileMenu();
      window.setTimeout(requestSpy, SCROLL_LOCK_MS + 50);
    });
  });

  list.addEventListener('mouseleave', function () {
    hovering = false;
    restoreIndicator();
  });

  // Link kosong (href="#") jangan melempar halaman ke atas
  document.addEventListener('click', function (event) {
    var anchor = event.target.closest ? event.target.closest('a[href="#"]') : null;
    if (anchor) {
      event.preventDefault();
    }
  });

  window.addEventListener('scroll', requestSpy, { passive: true });
  window.addEventListener('resize', function () {
    restoreIndicator(false);
    requestSpy();
  });
  if (desktop.addEventListener) {
    desktop.addEventListener('change', function () {
      restoreIndicator(false);
    });
  }

  /* ---------- Init ---------- */

  createIndicator();
  updateSpy();
  restoreIndicator(false);

  // Hitung ulang setelah font & gambar selesai dimuat (lebar link bisa berubah)
  window.addEventListener('load', function () {
    restoreIndicator(false);
    requestSpy();
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      restoreIndicator(false);
    });
  }
})();

/* ---------- Feedback ---------- */
(function () {
  'use strict';

  var STORAGE_KEY = 'citybinFeedback';
  var USER_KEY = 'citybinUser';
  var MAX_ITEMS = 50;
  var NAME_MIN = 2;
  var MESSAGE_MIN = 5;
  var MESSAGE_MAX = 300;

  var MSG_NAME = 'Nama wajib diisi (minimal ' + NAME_MIN + ' karakter).';
  var MSG_STATUS = 'Pilih status Anda terlebih dahulu.';
  var MSG_MESSAGE = 'Komentar wajib diisi (minimal ' + MESSAGE_MIN + ' karakter).';
  var MSG_SUCCESS = 'Terima kasih! Feedback Anda sudah terkirim.';
  var MSG_NO_STORAGE = 'Feedback tampil, tetapi tidak dapat disimpan di browser ini.';

  var form = document.getElementById('feedbackForm');
  var listEl = document.getElementById('fbList');
  if (!form || !listEl) {
    return;
  }

  var emptyEl = document.getElementById('fbEmpty');
  var countEl = document.getElementById('fbCount');
  var counterEl = document.getElementById('fbCounter');
  var alertEl = document.getElementById('fbAlert');
  var nameInput = form.elements.name;
  var statusSelect = form.elements.status;
  var messageInput = form.elements.message;

  var memoryStore = [];
  var storageOk = true;
  var alertTimer = null;

  /* ---------- Penyimpanan ---------- */

  function readItems() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      var data = JSON.parse(raw);
      return Array.isArray(data) ? data.filter(isValidItem) : [];
    } catch (error) {
      console.error('Gagal membaca feedback:', error);
      storageOk = false;
      return memoryStore.slice();
    }
  }

  function writeItems(items) {
    memoryStore = items.slice();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      storageOk = true;
    } catch (error) {
      console.error('Gagal menyimpan feedback:', error);
      storageOk = false;
    }
  }

  function isValidItem(item) {
    return item &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      typeof item.status === 'string' &&
      typeof item.message === 'string' &&
      typeof item.createdAt === 'string';
  }

  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function getSessionName() {
    try {
      var raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
      var user = raw ? JSON.parse(raw) : null;
      return user && typeof user.name === 'string' ? user.name : '';
    } catch (error) {
      return '';
    }
  }

  /* ---------- Tampilan ---------- */

  function formatTime(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) {
      return '';
    }
    var diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) {
      return 'Baru saja';
    }
    if (diff < 3600) {
      return Math.floor(diff / 60) + ' menit lalu';
    }
    if (diff < 86400) {
      return Math.floor(diff / 3600) + ' jam lalu';
    }
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric'
    }).format(date);
  }

  function statusClass(status) {
    var key = status.toLowerCase();
    if (key === 'pelajar') {
      return 'cb-fb-badge-pelajar';
    }
    if (key === 'mahasiswa') {
      return 'cb-fb-badge-mahasiswa';
    }
    return 'cb-fb-badge-umum';
  }

  function buildItem(item) {
    var article = document.createElement('article');
    article.className = 'cb-fb-item';
    article.setAttribute('data-id', item.id);

    var avatar = document.createElement('span');
    avatar.className = 'cb-fb-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = item.name.trim().charAt(0).toUpperCase() || '?';

    var body = document.createElement('div');
    body.className = 'cb-fb-body';

    var meta = document.createElement('div');
    meta.className = 'cb-fb-meta';

    var name = document.createElement('strong');
    name.className = 'cb-fb-name';
    name.textContent = item.name;

    var badge = document.createElement('span');
    badge.className = 'cb-fb-badge ' + statusClass(item.status);
    badge.textContent = item.status;

    var time = document.createElement('time');
    time.className = 'cb-fb-time';
    time.setAttribute('datetime', item.createdAt);
    time.textContent = formatTime(item.createdAt);

    meta.appendChild(name);
    meta.appendChild(badge);
    meta.appendChild(time);

    var text = document.createElement('p');
    text.className = 'cb-fb-text';
    text.textContent = item.message;

    body.appendChild(meta);
    body.appendChild(text);

    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'cb-fb-remove';
    remove.setAttribute('data-remove', item.id);
    remove.setAttribute('aria-label', 'Hapus komentar dari ' + item.name);
    remove.innerHTML = '<i class="bi bi-trash3" aria-hidden="true"></i>';

    article.appendChild(avatar);
    article.appendChild(body);
    article.appendChild(remove);
    return article;
  }

  function render() {
    var items = storageOk ? readItems() : memoryStore.slice();

    Array.prototype.slice.call(listEl.querySelectorAll('.cb-fb-item')).forEach(function (node) {
      node.parentNode.removeChild(node);
    });

    items.forEach(function (item) {
      listEl.appendChild(buildItem(item));
    });

    if (emptyEl) {
      emptyEl.classList.toggle('d-none', items.length > 0);
    }
    if (countEl) {
      countEl.textContent = String(items.length);
    }
  }

  function updateCounter() {
    if (counterEl) {
      counterEl.textContent = messageInput.value.length + ' / ' + MESSAGE_MAX;
    }
  }

  function showAlert(message, type) {
    if (!alertEl) {
      return;
    }
    window.clearTimeout(alertTimer);
    alertEl.textContent = message;
    alertEl.className = 'cb-fb-alert cb-fb-alert-' + type;
    if (type === 'success') {
      alertTimer = window.setTimeout(hideAlert, 5000);
    }
  }

  function hideAlert() {
    if (!alertEl) {
      return;
    }
    alertEl.textContent = '';
    alertEl.className = 'cb-fb-alert d-none';
  }

  function markInvalid(field, invalid) {
    field.classList.toggle('is-invalid', invalid);
    if (invalid) {
      field.setAttribute('aria-invalid', 'true');
    } else {
      field.removeAttribute('aria-invalid');
    }
  }

  /* ---------- Aksi ---------- */

  function validate(values) {
    var problems = [];
    if (values.name.length < NAME_MIN) {
      problems.push({ field: nameInput, message: MSG_NAME });
    }
    if (!values.status) {
      problems.push({ field: statusSelect, message: MSG_STATUS });
    }
    if (values.message.length < MESSAGE_MIN) {
      problems.push({ field: messageInput, message: MSG_MESSAGE });
    }
    return problems;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    hideAlert();

    var values = {
      name: nameInput.value.trim().replace(/\s+/g, ' '),
      status: statusSelect.value,
      message: messageInput.value.trim()
    };

    [nameInput, statusSelect, messageInput].forEach(function (field) {
      markInvalid(field, false);
    });

    var problems = validate(values);
    if (problems.length) {
      problems.forEach(function (problem) {
        markInvalid(problem.field, true);
      });
      showAlert(problems[0].message, 'error');
      problems[0].field.focus();
      return;
    }

    var items = readItems();
    items.unshift({
      id: makeId(),
      name: values.name.slice(0, 40),
      status: values.status,
      message: values.message.slice(0, MESSAGE_MAX),
      createdAt: new Date().toISOString()
    });
    items = items.slice(0, MAX_ITEMS);
    writeItems(items);

    messageInput.value = '';
    updateCounter();
    render();
    showAlert(storageOk ? MSG_SUCCESS : MSG_NO_STORAGE, storageOk ? 'success' : 'error');
  });

  [nameInput, statusSelect, messageInput].forEach(function (field) {
    var eventName = field === statusSelect ? 'change' : 'input';
    field.addEventListener(eventName, function () {
      markInvalid(field, false);
    });
  });

  messageInput.addEventListener('input', updateCounter);

  listEl.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('[data-remove]') : null;
    if (!button) {
      return;
    }
    var id = button.getAttribute('data-remove');
    writeItems(readItems().filter(function (item) {
      return item.id !== id;
    }));
    render();
  });

  // Sinkron jika halaman dibuka di beberapa tab
  window.addEventListener('storage', function (event) {
    if (event.key === STORAGE_KEY) {
      render();
    }
  });

  /* ---------- Init ---------- */

  var sessionName = getSessionName();
  if (sessionName && !nameInput.value) {
    nameInput.value = sessionName.slice(0, 40);
  }

  updateCounter();
  render();
})();