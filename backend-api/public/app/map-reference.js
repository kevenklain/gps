(() => {
  const $ = (id) => document.getElementById(id);
  let detailDismissed = false;
  let syncTimer = null;

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const statusKeyFromText = (text) => {
    if (text.includes('Sem comunicação')) return 'sem_comunicacao';
    if (text.includes('Offline')) return 'offline';
    if (text.includes('Inativo')) return 'inativo';
    return 'online';
  };

  const statusLabel = {
    online: 'Online',
    sem_comunicacao: 'Sem comunicação',
    offline: 'Offline',
    inativo: 'Inativo',
  };

  const statusColor = {
    online: '#16a05d',
    sem_comunicacao: '#f4b719',
    offline: '#e02e3e',
    inativo: '#8796aa',
  };

  function parseMapButton(button) {
    const raw = (button?.textContent || '').replace(' • Sem localização GPS', '').trim();
    const [left = '', statusRaw = 'Offline'] = raw.split(' — ');
    const separator = left.indexOf(' • ');
    const name = separator >= 0 ? left.slice(0, separator).trim() : left.trim();
    const plate = separator >= 0 ? left.slice(separator + 3).trim() : '-';
    const status = statusKeyFromText(statusRaw);
    return {name: name || 'Veículo', plate: plate || '-', status};
  }

  function parsePopup() {
    const popup = document.querySelector('#fleetMap .leaflet-popup-content');
    if (!popup) return {};
    const text = popup.textContent || '';
    const read = (label) => {
      const match = text.match(new RegExp(`${label}:\\s*([^\\n]+)`));
      return match?.[1]?.trim() || '-';
    };
    return {
      responsible: read('Responsável'),
      speed: read('Velocidade'),
      battery: read('Bateria'),
      lastCommunication: read('Última comunicação'),
    };
  }

  function findReferenceDevice(buttons) {
    const select = $('mapDeviceFilter');
    if (!buttons.length) return null;
    if (select && select.value !== 'all') {
      const index = Math.max(0, select.selectedIndex - 1);
      return buttons[index] || buttons[0];
    }
    return buttons.find((button) => (button.textContent || '').includes('Offline')) || buttons[0];
  }

  function renderDetails(buttons) {
    const panel = $('mapDeviceDetails');
    if (!panel || detailDismissed) return;

    const button = findReferenceDevice(buttons);
    if (!button) {
      panel.classList.add('is-hidden');
      return;
    }

    const device = parseMapButton(button);
    const popup = $('mapDeviceFilter')?.value !== 'all' ? parsePopup() : {};
    const label = statusLabel[device.status];
    const color = statusColor[device.status];

    panel.innerHTML = `
      <div class="map-device-detail-header">
        <div class="map-device-detail-avatar"><span class="material-symbols-rounded">ambulance</span></div>
        <div class="map-device-detail-title">
          <strong>${escapeHtml(device.name)}</strong>
          <span class="map-detail-status ${device.status}">${escapeHtml(label)}</span>
        </div>
        <button class="map-device-detail-close" id="mapDeviceDetailClose" type="button" aria-label="Fechar detalhes">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>
      <div class="map-device-detail-rows">
        <div class="map-detail-row"><span class="material-symbols-rounded">directions_car</span><span>Placa</span><strong>${escapeHtml(device.plate)}</strong></div>
        <div class="map-detail-row"><span class="material-symbols-rounded">person</span><span>Responsável</span><strong>${escapeHtml(popup.responsible || '-')}</strong></div>
        <div class="map-detail-row"><span class="material-symbols-rounded">schedule</span><span>Status</span><strong class="map-detail-value-status"><span class="map-detail-mini-dot" style="background:${color}"></span>${escapeHtml(label)}</strong></div>
        <div class="map-detail-row"><span class="material-symbols-rounded">speed</span><span>Velocidade</span><strong>${escapeHtml(popup.speed || '- km/h')}</strong></div>
        <div class="map-detail-row"><span class="material-symbols-rounded">battery_full</span><span>Bateria</span><strong>${escapeHtml(popup.battery || '-')}</strong></div>
        <div class="map-detail-row"><span class="material-symbols-rounded">schedule</span><span>Última comunicação</span><strong>${escapeHtml(popup.lastCommunication || '-')}</strong></div>
      </div>
      <button class="map-device-details-button" id="mapOpenVehicleDetails" type="button">
        <span>Ver detalhes do veículo</span><span class="material-symbols-rounded">arrow_forward</span>
      </button>`;

    panel.classList.remove('is-hidden');
    $('mapDeviceDetailClose')?.addEventListener('click', () => {
      detailDismissed = true;
      panel.classList.add('is-hidden');
    });
    $('mapOpenVehicleDetails')?.addEventListener('click', () => {
      document.querySelector('[data-page="dispositivos"]')?.click();
    });
  }

  function updateMarkerIcons() {
    document.querySelectorAll('#fleetMap .ambulance-marker span').forEach((marker) => {
      const border = marker.style.borderColor;
      if (border) marker.style.color = border;
    });
  }

  function syncMapReference() {
    const buttons = [...document.querySelectorAll('#mapDevices .map-device')];
    const counts = {online: 0, sem_comunicacao: 0, offline: 0, inativo: 0};
    buttons.forEach((button) => counts[statusKeyFromText(button.textContent || '')]++);

    if ($('mapStatOnline')) $('mapStatOnline').textContent = counts.online;
    if ($('mapStatWarning')) $('mapStatWarning').textContent = counts.sem_comunicacao;
    if ($('mapStatOffline')) $('mapStatOffline').textContent = counts.offline;
    if ($('mapStatInactive')) $('mapStatInactive').textContent = counts.inativo;
    if ($('mapCount')) $('mapCount').textContent = `${buttons.length} ambulâncias no mapa`;

    const now = new Date();
    if ($('mapLastUpdated')) {
      $('mapLastUpdated').textContent = now.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    }

    updateMarkerIcons();
    renderDetails(buttons);
  }

  function selectFirstSearchMatch() {
    const query = ($('mapSearch')?.value || '').trim().toLocaleLowerCase('pt-BR');
    if (!query) return;
    const buttons = [...document.querySelectorAll('#mapDevices .map-device')];
    const index = buttons.findIndex((button) => (button.textContent || '').toLocaleLowerCase('pt-BR').includes(query));
    const select = $('mapDeviceFilter');
    if (index < 0 || !select?.options[index + 1]) return;
    detailDismissed = false;
    select.selectedIndex = index + 1;
    select.dispatchEvent(new Event('change', {bubbles: true}));
    window.setTimeout(syncMapReference, 300);
  }

  function init() {
    const mapPage = $('mapaPage');
    if (!mapPage) return;

    $('mapRefreshButton')?.addEventListener('click', () => {
      $('refreshButton')?.click();
      window.setTimeout(syncMapReference, 350);
    });

    $('mapFilterButton')?.addEventListener('click', () => $('mapDeviceFilter')?.focus());

    $('mapSearch')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        selectFirstSearchMatch();
      }
    });

    $('mapSearch')?.addEventListener('change', selectFirstSearchMatch);

    $('mapDeviceFilter')?.addEventListener('change', () => {
      detailDismissed = false;
      window.setTimeout(syncMapReference, 250);
    });

    $('mapMobileMenuButton')?.addEventListener('click', () => document.body.classList.toggle('map-sidebar-open'));
    $('sidebarBackdrop')?.addEventListener('click', () => document.body.classList.remove('map-sidebar-open'));
    document.querySelectorAll('#navigation [data-page]').forEach((button) => {
      button.addEventListener('click', () => document.body.classList.remove('map-sidebar-open'));
    });

    syncMapReference();
    syncTimer = window.setInterval(syncMapReference, 5000);

    window.addEventListener('beforeunload', () => {
      if (syncTimer) window.clearInterval(syncTimer);
    }, {once: true});
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init, {once: true});
})();