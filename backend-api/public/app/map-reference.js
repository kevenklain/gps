(() => {
  const $ = (id) => document.getElementById(id);
  let syncTimer = null;
  let fleetListScrollTop = 0;
  let smartFilterDevices = [];
  let smartFilterLoadedAt = 0;
  let smartFilterLoading = null;

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const normalizeSearch = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

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

  function closeSmartFilter() {
    const filter = $('mapSmartFilter');
    const input = $('mapSmartSearch');
    if (!filter) return;
    filter.classList.remove('is-open');
    input?.setAttribute('aria-expanded', 'false');
  }

  async function loadSmartFilterDevices(force = false) {
    const now = Date.now();
    if (!force && smartFilterDevices.length && now - smartFilterLoadedAt < 30000) {
      return smartFilterDevices;
    }
    if (smartFilterLoading) return smartFilterLoading;

    const token = localStorage.getItem('ambulancias_token') || '';
    if (!token) return smartFilterDevices;

    smartFilterLoading = fetch('/api/dispositivos', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Não foi possível carregar os veículos do filtro.');
        const data = await response.json();
        smartFilterDevices = Array.isArray(data.dados) ? data.dados : [];
        smartFilterLoadedAt = Date.now();
        return smartFilterDevices;
      })
      .finally(() => {
        smartFilterLoading = null;
      });

    return smartFilterLoading;
  }

  function renderSmartFilterResults() {
    const dropdown = $('mapSmartFilterDropdown');
    const input = $('mapSmartSearch');
    if (!dropdown || !input) return;

    const term = normalizeSearch(input.value);
    const select = $('mapDeviceFilter');
    const selected = select?.value || 'all';

    const filtered = smartFilterDevices.filter((device) => {
      if (!term) return true;
      const haystack = normalizeSearch([
        device.nome,
        device.placa,
        device.modelo_veiculo,
        device.usuario?.nome,
      ].filter(Boolean).join(' '));
      return haystack.includes(term);
    });

    const allOption = `
      <button class="map-smart-option all ${selected === 'all' ? 'is-selected' : ''}" type="button" data-smart-device-id="all" role="option" aria-selected="${selected === 'all'}">
        <span class="map-smart-option-icon"><span class="material-symbols-rounded" aria-hidden="true">directions_car</span></span>
        <span class="map-smart-option-copy">
          <strong>Todos os veículos</strong>
          <small>Mostrar todos os ${smartFilterDevices.length} veículos da frota no mapa</small>
        </span>
        <span class="map-smart-option-chevron material-symbols-rounded" aria-hidden="true">chevron_right</span>
      </button>`;

    const rows = filtered.map((device) => {
      const responsible = device.usuario?.nome || 'Sem responsável';
      const plate = device.placa || 'Sem placa';
      const isSelected = String(device.id) === String(selected);
      return `
        <button class="map-smart-option ${isSelected ? 'is-selected' : ''}" type="button" data-smart-device-id="${escapeHtml(device.id)}" role="option" aria-selected="${isSelected}">
          <span class="map-smart-option-icon"><span class="material-symbols-rounded" aria-hidden="true">ambulance</span></span>
          <span class="map-smart-option-copy">
            <strong>${escapeHtml(device.nome || 'Veículo')}</strong>
            <small>${escapeHtml(plate)} &nbsp;•&nbsp; ${escapeHtml(responsible)}</small>
          </span>
          <span class="map-smart-option-chevron material-symbols-rounded" aria-hidden="true">chevron_right</span>
        </button>`;
    }).join('');

    dropdown.innerHTML = allOption + (rows || '<div class="map-smart-filter-state">Nenhum veículo encontrado.</div>');

    dropdown.querySelectorAll('[data-smart-device-id]').forEach((option) => {
      option.addEventListener('click', () => {
        const id = option.dataset.smartDeviceId;
        if (id === 'all') {
          input.value = '';
          showAllVehicles();
          closeSmartFilter();
          return;
        }

        const device = smartFilterDevices.find((item) => String(item.id) === String(id));
        if (device) input.value = device.nome || '';

        if (select) {
          select.value = String(id);
          select.dispatchEvent(new Event('change', {bubbles: true}));
        }
        closeSmartFilter();
      });
    });
  }

  async function openSmartFilter() {
    const filter = $('mapSmartFilter');
    const input = $('mapSmartSearch');
    const dropdown = $('mapSmartFilterDropdown');
    if (!filter || !input || !dropdown) return;

    filter.classList.add('is-open');
    input.setAttribute('aria-expanded', 'true');

    if (!smartFilterDevices.length || Date.now() - smartFilterLoadedAt > 30000) {
      dropdown.innerHTML = '<div class="map-smart-filter-state">Carregando veículos...</div>';
      try {
        await loadSmartFilterDevices();
      } catch (error) {
        dropdown.innerHTML = `<div class="map-smart-filter-state">${escapeHtml(error.message)}</div>`;
        return;
      }
    }

    renderSmartFilterResults();
  }

  function syncSmartFilterSelection() {
    const input = $('mapSmartSearch');
    const filter = $('mapSmartFilter');
    const select = $('mapDeviceFilter');
    if (!input || !filter || !select) return;
    if (filter.classList.contains('is-open') || document.activeElement === input) return;

    if (select.value === 'all') {
      input.value = '';
      return;
    }

    const selectedDevice = smartFilterDevices.find((device) => String(device.id) === String(select.value));
    if (selectedDevice) input.value = selectedDevice.nome || '';
  }

  function mountSmartFilter() {
    const tools = document.querySelector('#mapPanel .map-reference-tools');
    if (!tools || $('mapSmartFilter')) return;

    const filter = document.createElement('div');
    filter.id = 'mapSmartFilter';
    filter.className = 'map-smart-filter';
    filter.innerHTML = `
      <div class="map-smart-filter-control">
        <span class="map-smart-filter-search-icon material-symbols-rounded" aria-hidden="true">search</span>
        <input id="mapSmartSearch" type="search" placeholder="Buscar por veículo, placa ou motorista..." autocomplete="off" aria-autocomplete="list" aria-controls="mapSmartFilterDropdown" aria-expanded="false">
        <button id="mapSmartFilterToggle" class="map-smart-filter-toggle" type="button" aria-label="Abrir lista de veículos">
          <span class="material-symbols-rounded" aria-hidden="true">expand_more</span>
        </button>
      </div>
      <div id="mapSmartFilterDropdown" class="map-smart-filter-dropdown" role="listbox"></div>`;

    tools.appendChild(filter);

    const input = $('mapSmartSearch');
    input?.addEventListener('focus', openSmartFilter);
    input?.addEventListener('click', openSmartFilter);
    input?.addEventListener('input', () => {
      if (!filter.classList.contains('is-open')) openSmartFilter();
      else renderSmartFilterResults();
    });
    input?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeSmartFilter();
        input.blur();
      }
    });

    $('mapSmartFilterToggle')?.addEventListener('click', async () => {
      if (filter.classList.contains('is-open')) closeSmartFilter();
      else {
        await openSmartFilter();
        input?.focus();
      }
    });

    document.addEventListener('pointerdown', (event) => {
      if (!filter.contains(event.target)) closeSmartFilter();
    });
  }

  function showAllVehicles() {
    const select = $('mapDeviceFilter');
    if (select) select.value = 'all';

    const input = $('mapSmartSearch');
    if (input && document.activeElement !== input) input.value = '';

    const fitButton = $('mapFitButton');
    if (fitButton) {
      fitButton.click();
    } else if (select) {
      select.dispatchEvent(new Event('change', {bubbles: true}));
    }

    window.setTimeout(syncMapReference, 360);
  }

  function syncSimulationButton() {
    const button = $('mapSimulationButton');
    if (!button) return;

    const running = (button.textContent || '').includes('Parar');
    button.classList.add('map-simulation-toggle');
    button.classList.toggle('is-running', running);
    button.setAttribute('aria-pressed', running ? 'true' : 'false');
    button.title = running
      ? 'Parar a simulação da frota'
      : 'Iniciar uma simulação com a frota de teste em movimento';
    button.innerHTML = `
      <span class="material-symbols-rounded" aria-hidden="true">${running ? 'stop_circle' : 'play_circle'}</span>
      <span>${running ? 'Parar simulação' : 'Simular frota'}</span>`;

    const status = $('mapSimulationStatus');
    if (status) {
      status.textContent = running
        ? 'Simulação ativa: os veículos de teste recebem novas posições a cada 5 segundos.'
        : 'Simulação desligada. As posições exibidas vêm normalmente dos dispositivos.';
    }
  }

  function mountSimulationButton() {
    const button = $('mapSimulationButton');
    const actions = document.querySelector('#mapPanel .map-reference-actions');
    if (!button || !actions) return;

    if (button.parentElement !== actions) actions.appendChild(button);
    button.removeAttribute('aria-hidden');
    syncSimulationButton();

    if (button.dataset.simulationUiBound !== '1') {
      button.dataset.simulationUiBound = '1';
      button.addEventListener('click', () => {
        window.setTimeout(syncSimulationButton, 0);
      });
    }
  }

  function renderFleetList(buttons) {
    const panel = $('mapDeviceDetails');
    if (!panel) return;

    const previousBody = panel.querySelector('.map-fleet-list-body');
    if (previousBody) fleetListScrollTop = previousBody.scrollTop;

    const focusedIndex = document.activeElement?.dataset?.mapDeviceIndex ?? null;

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
      <div class="map-fleet-all-section">
        <button id="mapShowAllVehicles" class="map-show-all-vehicles" type="button">
          <span class="map-show-all-icon" aria-hidden="true">
            <span class="material-symbols-rounded">directions_car</span>
            <span class="material-symbols-rounded">directions_car</span>
          </span>
          <span class="map-show-all-copy">
            <strong>Ver todos os veículos</strong>
            <small>Mostrar todos no mapa</small>
          </span>
          <span class="map-show-all-arrow material-symbols-rounded" aria-hidden="true">chevron_right</span>
        </button>
        <div class="map-show-all-info">
          <span class="material-symbols-rounded" aria-hidden="true">info</span>
          <span>Clique para exibir todos os veículos da frota no mapa ao mesmo tempo.</span>
        </div>
      </div>
      <div class="map-fleet-list-header">
        <strong>Veículos da Frota</strong>
        <span>${buttons.length} ${buttons.length === 1 ? 'veículo' : 'veículos'}</span>
      </div>
      <div class="map-fleet-list-body">
        ${rows || '<div class="map-fleet-empty">Nenhum veículo disponível.</div>'}
      </div>`;

    const body = panel.querySelector('.map-fleet-list-body');
    if (body) {
      const maxScroll = Math.max(0, body.scrollHeight - body.clientHeight);
      body.scrollTop = Math.min(fleetListScrollTop, maxScroll);
      body.addEventListener('scroll', () => {
        fleetListScrollTop = body.scrollTop;
      }, {passive: true});
    }

    if (focusedIndex !== null) {
      const focusedRow = panel.querySelector(`[data-map-device-index="${focusedIndex}"]`);
      focusedRow?.focus({preventScroll: true});
    }

    $('mapShowAllVehicles')?.addEventListener('click', showAllVehicles);

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
    syncSimulationButton();
    renderFleetList(buttons);
    syncSmartFilterSelection();
  }

  function scheduleSync() {
    window.clearTimeout(syncTimer);
    syncMapReference();
    syncTimer = window.setTimeout(scheduleSync, 5000);
  }

  function init() {
    const mapPage = $('mapaPage');
    if (!mapPage) return;

    mountSimulationButton();
    mountSmartFilter();

    $('mapRefreshButton')?.addEventListener('click', () => {
      $('refreshButton')?.click();
      smartFilterLoadedAt = 0;
      window.setTimeout(syncMapReference, 350);
    });

    $('mapMobileMenuButton')?.addEventListener('click', () => document.body.classList.toggle('map-sidebar-open'));
    $('sidebarBackdrop')?.addEventListener('click', () => document.body.classList.remove('map-sidebar-open'));
    document.querySelectorAll('#navigation [data-page]').forEach((button) => {
      button.addEventListener('click', () => document.body.classList.remove('map-sidebar-open'));
    });

    $('mapDeviceFilter')?.addEventListener('change', () => window.setTimeout(() => {
      syncMapReference();
      syncSmartFilterSelection();
    }, 260));

    scheduleSync();
    window.addEventListener('beforeunload', () => window.clearTimeout(syncTimer), {once: true});
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init, {once: true});
})();
