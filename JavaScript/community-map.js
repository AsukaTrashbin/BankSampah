(function () {
  'use strict';

  var mapElement = document.getElementById('communityMap');
  var filters = document.getElementById('communityFilters');
  var citySelect = document.getElementById('location');
  var searchInput = document.getElementById('locationSearch');
  var resultsElement = document.getElementById('locationResults');
  var statusElement = document.getElementById('mapStatus');

  if (!mapElement || !filters || !citySelect || !searchInput || !resultsElement || !statusElement) {
    return;
  }

  if (!window.L) {
    statusElement.textContent = 'Peta tidak dapat dimuat. Periksa koneksi internet lalu muat ulang halaman.';
    console.error('Leaflet gagal dimuat; peta ruang publik tidak dapat diinisialisasi.');
    return;
  }

  var cityViews = {
    bandung: { center: [-6.9175, 107.6191], zoom: 12 },
    jakarta: { center: [-6.2, 106.8167], zoom: 12 },
    surabaya: { center: [-7.2575, 112.7521], zoom: 12 },
    yogyakarta: { center: [-7.7972, 110.3688], zoom: 13 }
  };
  var map = window.L.map(mapElement, { scrollWheelZoom: false });
  var initialView = cityViews[citySelect.value] || cityViews.bandung;
  var markers = window.L.featureGroup().addTo(map);
  var locations = [];

  map.setView(initialView.center, initialView.zoom);

  var tileLayer = window.L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · Tiles: <a href="https://www.openstreetmap.de/">OpenStreetMap.de</a>'
  });
  var tileNotice = document.createElement('p');
  tileNotice.className = 'cb-map-error';
  tileNotice.textContent = 'Peta dasar gagal dimuat. Periksa koneksi internet Anda.';
  tileNotice.hidden = true;
  mapElement.appendChild(tileNotice);
  tileLayer.on('tileerror', function () {
    tileNotice.hidden = false;
  });
  tileLayer.on('tileload', function () {
    tileNotice.hidden = true;
  });
  tileLayer.addTo(map);

  function normalize(value) {
    return value.toLocaleLowerCase('id-ID').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function isValidLocation(location) {
    return location
      && typeof location.id === 'string'
      && typeof location.name === 'string'
      && typeof location.cityId === 'string'
      && typeof location.city === 'string'
      && typeof location.region === 'string'
      && typeof location.area === 'string'
      && typeof location.type === 'string'
      && Number.isFinite(location.lat)
      && Number.isFinite(location.lng)
      && location.lat >= -90
      && location.lat <= 90
      && location.lng >= -180
      && location.lng <= 180
      && typeof location.sourceUrl === 'string'
      && location.sourceUrl.indexOf('https://www.openstreetmap.org/') === 0;
  }

  function makeSourceLink(location) {
    var link = document.createElement('a');
    link.className = 'cb-location-source';
    link.href = location.sourceUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Lihat di OpenStreetMap';
    return link;
  }

  function makePopup(location) {
    var content = document.createElement('div');
    var title = document.createElement('strong');
    var address = document.createElement('p');
    var type = document.createElement('p');

    title.textContent = location.name;
    address.textContent = location.area + ', ' + location.city + ', ' + location.region;
    type.textContent = location.type + ' · Tidak ada jadwal acara pada data ini.';
    content.appendChild(title);
    content.appendChild(address);
    content.appendChild(type);
    content.appendChild(makeSourceLink(location));
    return content;
  }

  function makeResultCard(location, marker) {
    var card = document.createElement('article');
    var title = document.createElement('h3');
    var focusButton = document.createElement('button');
    var address = document.createElement('p');
    var type = document.createElement('p');

    card.className = 'cb-location-card';
    focusButton.type = 'button';
    focusButton.textContent = location.name;
    focusButton.addEventListener('click', function () {
      map.setView(marker.getLatLng(), 16);
      marker.openPopup();
    });
    title.appendChild(focusButton);
    address.textContent = location.area + ', ' + location.city + ', ' + location.region;
    type.textContent = location.type + ' · Lokasi, bukan jadwal kegiatan.';
    card.appendChild(title);
    card.appendChild(address);
    card.appendChild(type);
    card.appendChild(makeSourceLink(location));
    return card;
  }

  function clearResults() {
    while (resultsElement.firstChild) {
      resultsElement.removeChild(resultsElement.firstChild);
    }
  }

  function renderLocations() {
    var cityId = citySelect.value;
    var query = normalize(searchInput.value.trim());
    var cityView = cityViews[cityId] || cityViews.bandung;
    var filteredLocations = locations.filter(function (location) {
      var searchableText = normalize([
        location.name,
        location.city,
        location.region,
        location.area,
        location.type
      ].join(' '));
      return location.cityId === cityId && searchableText.indexOf(query) !== -1;
    });

    markers.clearLayers();
    clearResults();

    filteredLocations.forEach(function (location) {
      var marker = window.L.marker([location.lat, location.lng], { title: location.name });
      marker.bindPopup(makePopup(location));
      marker.addTo(markers);
      resultsElement.appendChild(makeResultCard(location, marker));
    });

    if (filteredLocations.length > 0) {
      map.fitBounds(markers.getBounds().pad(0.18), { maxZoom: 15 });
      statusElement.textContent = 'Menampilkan ' + filteredLocations.length
        + ' lokasi ruang publik di ' + citySelect.options[citySelect.selectedIndex].text
        + '. Data lokasi dari OpenStreetMap; bukan daftar acara.';
    } else {
      map.setView(cityView.center, cityView.zoom);
      statusElement.textContent = 'Tidak ada lokasi yang cocok di '
        + citySelect.options[citySelect.selectedIndex].text
        + '. Coba kata pencarian lain atau pilih kota berbeda.';
      var emptyMessage = document.createElement('p');
      emptyMessage.className = 'cb-location-empty';
      emptyMessage.textContent = 'Tidak ada lokasi yang cocok dengan pencarian Anda.';
      resultsElement.appendChild(emptyMessage);
    }
  }

  filters.addEventListener('submit', function (event) {
    event.preventDefault();
    renderLocations();
  });
  citySelect.addEventListener('change', renderLocations);
  searchInput.addEventListener('input', renderLocations);

  fetch('Data/community-locations.json')
    .then(function (response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      return response.json();
    })
    .then(function (data) {
      if (!data || !Array.isArray(data.locations) || !data.locations.every(isValidLocation)) {
        throw new Error('Struktur atau koordinat data lokasi tidak valid.');
      }
      locations = data.locations;
      renderLocations();
    })
    .catch(function (error) {
      console.error('Gagal memuat data lokasi ruang publik:', error);
      statusElement.textContent = 'Data lokasi gagal dimuat. Jalankan situs melalui server web lokal, bukan file langsung.';
      clearResults();
    });
})();
