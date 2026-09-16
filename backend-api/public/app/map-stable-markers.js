(() => {
  const markerCache = new Map();
  let markerGroupRef = null;
  let installAttempts = 0;

  function installStaticMarkerStyles() {
    if (document.getElementById('map-stable-marker-styles')) return;
    const style = document.createElement('style');
    style.id = 'map-stable-marker-styles';
    style.textContent = `
      #mapPanel .ambulance-marker,
      #mapPanel .ambulance-marker span,
      #mapPanel .ambulance-marker span::before {
        animation: none !important;
        transition: none !important;
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function markerIcon(color) {
    return L.divIcon({
      className: 'ambulance-marker',
      html: `<span style="border-color:${color};color:${color}">🚑</span>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });
  }

  function popupHtml(device, label) {
    return `<strong>${escapeHtml(device.nome)}</strong><br>
      Placa: ${escapeHtml(device.placa || '-')}<br>
      Responsável: ${escapeHtml(device.usuario?.nome || '-')}<br>
      Status: ${label}<br>
      Velocidade: ${escapeHtml(device.velocidade ?? '-')} km/h<br>
      Bateria: ${escapeHtml(device.bateria ?? '-')}%<br>
      Última comunicação: ${escapeHtml(formatDate(device.ultima_comunicacao))}`;
  }

  function applyMarkerColor(marker, color) {
    if (marker.__statusColor === color) return;
    marker.__statusColor = color;
    const element = marker.getElement();
    const badge = element?.querySelector('span');
    if (badge) {
      badge.style.borderColor = color;
      badge.style.color = color;
    }
  }

  function ensureMarker(device, label, color) {
    const id = String(device.id);
    const latLng = [Number(device.latitude), Number(device.longitude)];
    let marker = markerCache.get(id);

    if (!marker) {
      marker = L.marker(latLng, {
        title: device.nome,
        icon: markerIcon(color),
      }).bindPopup(popupHtml(device, label));
      marker.__statusColor = color;
      markerCache.set(id, marker);
    } else {
      marker.setLatLng(latLng);
      marker.options.title = device.nome;
      if (marker.getPopup()) marker.setPopupContent(popupHtml(device, label));
      else marker.bindPopup(popupHtml(device, label));
      applyMarkerColor(marker, color);
    }

    if (!fleetMarkers.hasLayer(marker)) marker.addTo(fleetMarkers);
    window.requestAnimationFrame(() => applyMarkerColor(marker, color));
    return marker;
  }

  function syncMarkerCacheGroup() {
    if (markerGroupRef === fleetMarkers) return;
    markerCache.clear();
    markerGroupRef = fleetMarkers;
  }

  function installStableLoader() {
    installAttempts += 1;

    if (
      typeof loadFleetMap !== 'function' ||
      typeof api !== 'function' ||
      typeof L === 'undefined'
    ) {
      if (installAttempts < 200) window.setTimeout(installStableLoader, 50);
      return;
    }

    installStaticMarkerStyles();

    loadFleetMap = async function loadFleetMapStable() {
      clearTimeout(fleetMapTimer);
      const request = ++fleetMapRequest;
      const token = state.token;
      $('mapSummary').textContent = 'Carregando ambulâncias...';
      $('mapError').classList.add('hidden');

      try {
        if (!window.L) throw new Error('Não foi possível carregar o mapa. Verifique sua conexão e recarregue a página.');

        if (!fleetMap) {
          fleetMap = L.map('fleetMap').setView([20, 0], 2);
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }).on('tileerror', () => {
            $('mapError').textContent = 'Não foi possível carregar parte do mapa. Verifique sua conexão com a internet.';
            $('mapError').classList.remove('hidden');
          }).addTo(fleetMap);
          fleetMarkers = L.featureGroup().addTo(fleetMap);
        }

        syncMarkerCacheGroup();
        fleetMap.invalidateSize();

        const data = await api('/dispositivos');
        if (request !== fleetMapRequest || token !== state.token) return;

        const devices = data.dados;
        const select = $('mapDeviceFilter');
        let selected = select.value;
        if (selected !== 'all' && !devices.some(device => String(device.id) === selected)) selected = 'all';

        select.innerHTML = '<option value="all">Todas as ambulâncias</option>' + devices.map(device =>
          `<option value="${device.id}">${escapeHtml(device.nome)}</option>`).join('');
        select.value = selected;

        const visible = devices.filter(device => selected === 'all' || String(device.id) === selected);
        const located = visible.filter(hasMapPosition);
        const firstLoad = fleetMarkers.getLayers().length === 0;
        const existingIds = new Set(devices.map(device => String(device.id)));
        const visibleLocatedIds = new Set(located.map(device => String(device.id)));

        for (const [id, marker] of markerCache.entries()) {
          if (!existingIds.has(id)) {
            if (fleetMarkers.hasLayer(marker)) fleetMarkers.removeLayer(marker);
            markerCache.delete(id);
          } else if (!visibleLocatedIds.has(id) && fleetMarkers.hasLayer(marker)) {
            fleetMarkers.removeLayer(marker);
          }
        }

        $('mapDevices').replaceChildren();

        for (const device of devices) {
          const [label, color] = mapStatus[device.status] || mapStatus.offline;
          const button = document.createElement('button');
          button.className = 'map-device';
          button.type = 'button';
          button.textContent = `${device.nome} • ${device.placa || 'Sem placa'} — ${label}`;

          if (hasMapPosition(device) && (selected === 'all' || String(device.id) === selected)) {
            const marker = ensureMarker(device, label, color);

            button.addEventListener('click', async () => {
              select.value = String(device.id);
              mapSelectionChanged = true;
              await loadFleetMap();
              const currentMarker = markerCache.get(String(device.id));
              if (currentMarker) {
                fleetMap.setView(currentMarker.getLatLng(), 15);
                currentMarker.openPopup();
              }
            });

            if (selected !== 'all' && !marker.isPopupOpen()) marker.openPopup();
          } else if (hasMapPosition(device)) {
            button.addEventListener('click', () => {
              select.value = String(device.id);
              mapSelectionChanged = true;
              loadFleetMap();
            });
          } else {
            button.disabled = true;
            button.textContent += ' • Sem localização GPS';
          }

          $('mapDevices').append(button);
        }

        $('mapSummary').textContent = devices.length
          ? `${located.length} de ${visible.length} ambulâncias selecionadas no mapa. ${visible.length - located.length} sem localização GPS. Atualizado às ${new Date().toLocaleTimeString('pt-BR')}.`
          : 'Nenhuma ambulância disponível para este usuário.';

        if (!located.length && devices.length) {
          $('mapSummary').textContent += ' Envie uma localização pelo tablet ou pelo Simular GPS.';
        }

        if (firstLoad || mapSelectionChanged) fitFleetMap();
        mapSelectionChanged = false;
      } catch (error) {
        if (request !== fleetMapRequest) return;
        $('mapSummary').textContent = 'Não foi possível atualizar as posições. Os dados exibidos podem estar desatualizados.';
        $('mapError').textContent = error.message;
        $('mapError').classList.remove('hidden');
      } finally {
        if (request === fleetMapRequest && state.currentPage === 'mapa' && state.token) {
          fleetMapTimer = setTimeout(tickFleetMap, 5000);
        }
      }
    };
  }

  installStableLoader();
})();
