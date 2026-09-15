(() => {
  const $ = (id) => document.getElementById(id);
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

  function parseMapButton(button) {
    const raw = (button?.textContent || '').replace(' • Sem localização GPS', '').trim();
    const [left = '', statusRaw = 'Offline'] = raw.split(' — ');
    const separator = left.indexOf(' • ');
    const name = separator >= 0 ? left.slice(0, separator).trim() : left.trim();
    const plate = separator >= 0 ? left.slice(separator + 3).trim() : '-';
    return {
      name: name || 'Veículo',
      plate: plate || '-',
      status: statusKeyFromText(statusRaw),
      noLocation: (button?.textContent || '').includes('Sem localização GPS'),
    };
  }

  function updateMarkerIcons() {
    document.querySelectorAll('#fleetMap .ambulance-marker span').forEach((marker) => {
      const border = marker.style.borderColor;
      if (border) marker.style.color = border;
    });
  }

  function renderFleetList(buttons) {
    const panel = $('mapDeviceDetails');
    if (!panel) return;

    panel.className = 'map-fleet-list';
    const select = $('mapDeviceFilter');
    const selectedIndex = select && select.value !== 'all' ? Math.max(0, select.selectedIndex - 1) : -1;

    const rows = buttons.map((button, index) => {
      const device = parseMapButton(button);
      const label = statusLabel[device.status];
      const selected = index === selectedIndex ? ' is-selected' : '';
      const disabled = device.noLocation ? ' disabled' : '';
      return `
        <button class="map-fleet-row ${device.status}${selected}" type="button" data-map-device-index="${index}"${disabled}>
          <span class="map-fleet-vehicle-icon"><span class="material-symbols-rounded" aria-hidden="true">ambulance</span></span>
          <span class="map-fleet-vehicle-copy">
            <strong>${escapeHtml(device.name)}</strong>
            <small>${escapeHtml(device.plate)}</small>
          </span>
          <span class="map-fleet-status"><span class="map-fleet-status-dot"></span>${escapeHtml(label)}</span>
          <span class="map-fleet-arrow material-symbols-rounded" aria-hidden="true">chevron_right</span>
        </button>`;
    }).join('');

    panel.innerHTML = `
      <div class="map-fleet-list-header">
        <strong>Veículos da Frota</strong>
        <span>${buttons.length} ${buttons.length === 1 ? 'veículo' : 'veículos'}</span>
      </div>
      <div class="map-fleet-list-body">
        ${rows || '<div class="map-fleet-empty">Nenhum veículo disponível.</div>'}
      </div>`;

    panel.querySelectorAll('[data-map-device-index]').forEach((row) => {
      row.addEventListener('click', () => {
        const index = Number(row.dataset.mapDeviceIndex);
        const sourceButton = buttons[index];
        if (!sourceButton || sourceButton.disabled) return;
        sourceButton.click();
        window.setTimeout(syncMapReference, 320);
      });
    });
  }

  function syncMapReference() {
    const mapPage = $('mapaPage');
    if (!mapPage?.classList.contains('active')) return;

    const buttons = [...document.querySelectorAll('#mapDevices .map-device')];
    const counts = {online: 0, sem_comunicacao: 0, offline: 0, inativo: 0};
    buttons.forEach((button) => counts[statusKeyFromText(button.textContent || '')]++);

    if ($('mapStatOnline')) $('mapStatOnline').textContent = counts.online;
    if ($('mapStatWarning')) $('mapStatWarning').textContent = counts.sem_comunicacao;
    if ($('mapStatOffline')) $('mapStatOffline').textContent = counts.offline;
    if ($('mapStatInactive')) $('mapStatInactive').textContent = counts.inativo;
    if ($('mapCount')) $('mapCount').textContent = `${buttons.length} ${buttons.length === 1 ? 'ambulância' : 'ambulâncias'} no mapa`;

    if ($('mapLastUpdated')) {
      $('mapLastUpdated').textContent = new Date().toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    }

    updateMarkerIcons();
    renderFleetList(buttons);
  }

  function scheduleSync() {
    window.clearTimeout(syncTimer);
    syncMapReference();
    syncTimer = window.setTimeout(scheduleSync, 5000);
  }

  function init() {
    const mapPage = $('mapaPage');
    if (!mapPage) return;

    $('mapRefreshButton')?.addEventListener('click', () => {
      $('refreshButton')?.click();
      window.setTimeout(syncMapReference, 350);
    });

    $('mapMobileMenuButton')?.addEventListener('click', () => document.body.classList.toggle('map-sidebar-open'));
    $('sidebarBackdrop')?.addEventListener('click', () => document.body.classList.remove('map-sidebar-open'));
    document.querySelectorAll('#navigation [data-page]').forEach((button) => {
      button.addEventListener('click', () => document.body.classList.remove('map-sidebar-open'));
    });

    $('mapDeviceFilter')?.addEventListener('change', () => window.setTimeout(syncMapReference, 260));

    scheduleSync();
    window.addEventListener('beforeunload', () => window.clearTimeout(syncTimer), {once: true});
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init, {once: true});
})();
