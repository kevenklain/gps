(() => {
  const STORAGE_KEY = 'ambulancias_map_split_ratio';
  const DESKTOP_BREAKPOINT = 900;
  const HANDLE_WIDTH = 12;
  const MIN_MAP_WIDTH = 360;
  const MIN_LIST_WIDTH = 280;
  const DEFAULT_RATIO = 0.30;
  const MIN_RATIO = 0.20;
  const MAX_RATIO = 0.58;

  let splitRatio = Number(localStorage.getItem(STORAGE_KEY));
  if (!Number.isFinite(splitRatio)) splitRatio = DEFAULT_RATIO;
  splitRatio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, splitRatio));

  let resizeFrame = null;
  let resizeTimer = null;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function stage() {
    return document.querySelector('#mapPanel .map-reference-stage');
  }

  function invalidateMapSize() {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      // Leaflet escuta resize da janela e recalcula o canvas/tiles.
      window.dispatchEvent(new Event('resize'));
    });
  }

  function updatePresetState(ratio) {
    document.querySelectorAll('[data-map-split-preset]').forEach((button) => {
      const preset = Number(button.dataset.mapSplitPreset);
      button.classList.toggle('is-active', Math.abs(preset - ratio) < 0.025);
    });
  }

  function applySplitRatio(nextRatio, persist = true) {
    const container = stage();
    const handle = document.getElementById('mapSplitHandle');
    if (!container || window.innerWidth <= DESKTOP_BREAKPOINT) return;

    const width = container.clientWidth;
    if (!width) return;

    const maxListBySpace = Math.max(MIN_LIST_WIDTH, width - MIN_MAP_WIDTH - HANDLE_WIDTH);
    let ratio = clamp(Number(nextRatio) || DEFAULT_RATIO, MIN_RATIO, MAX_RATIO);
    let listWidth = clamp(width * ratio, MIN_LIST_WIDTH, maxListBySpace);

    // Recalcula a razão real após aplicar mínimos de mapa/lista.
    ratio = listWidth / width;
    splitRatio = ratio;

    container.style.setProperty('--map-list-width', `${Math.round(listWidth)}px`);
    container.dataset.splitRatio = String(ratio);

    if (handle) {
      const percent = Math.round(ratio * 100);
      handle.setAttribute('aria-valuenow', String(percent));
      handle.setAttribute('aria-valuetext', `Lista ${percent}% e mapa ${100 - percent}%`);
    }

    if (persist) localStorage.setItem(STORAGE_KEY, String(ratio));
    updatePresetState(ratio);
    invalidateMapSize();
  }

  function ratioFromPointer(clientX) {
    const container = stage();
    if (!container) return splitRatio;
    const rect = container.getBoundingClientRect();
    const listWidth = rect.right - clientX - HANDLE_WIDTH / 2;
    return listWidth / rect.width;
  }

  function mountSplitView() {
    const container = stage();
    const details = document.getElementById('mapDeviceDetails');
    if (!container || !details || document.getElementById('mapSplitHandle')) return;

    const handle = document.createElement('div');
    handle.id = 'mapSplitHandle';
    handle.className = 'map-split-handle';
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-label', 'Redimensionar mapa e lista de veículos');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-valuemin', String(Math.round(MIN_RATIO * 100)));
    handle.setAttribute('aria-valuemax', String(Math.round(MAX_RATIO * 100)));
    handle.tabIndex = 0;
    handle.innerHTML = `
      <div class="map-split-controls" aria-label="Tamanho do mapa e da lista">
        <button class="map-split-control" type="button" data-map-split-preset="0.22" title="Aumentar mapa" aria-label="Aumentar mapa">
          <span class="material-symbols-rounded" aria-hidden="true">map</span>
        </button>
        <button class="map-split-control" type="button" data-map-split-preset="0.50" title="Dividir meio a meio" aria-label="Dividir mapa e lista meio a meio">
          <span class="material-symbols-rounded" aria-hidden="true">splitscreen</span>
        </button>
        <button class="map-split-control" type="button" data-map-split-preset="0.56" title="Aumentar lista" aria-label="Aumentar lista de veículos">
          <span class="material-symbols-rounded" aria-hidden="true">view_sidebar</span>
        </button>
      </div>
      <span class="map-split-grip" aria-hidden="true">
        <span class="material-symbols-rounded">drag_indicator</span>
      </span>`;

    container.insertBefore(handle, details);

    handle.querySelectorAll('[data-map-split-preset]').forEach((button) => {
      button.addEventListener('pointerdown', (event) => event.stopPropagation());
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        applySplitRatio(Number(button.dataset.mapSplitPreset));
      });
    });

    let dragging = false;
    let pointerId = null;

    handle.addEventListener('pointerdown', (event) => {
      if (event.target.closest('.map-split-control')) return;
      if (window.innerWidth <= DESKTOP_BREAKPOINT) return;
      dragging = true;
      pointerId = event.pointerId;
      handle.setPointerCapture(pointerId);
      document.body.classList.add('map-split-resizing');
      event.preventDefault();
    });

    handle.addEventListener('pointermove', (event) => {
      if (!dragging || event.pointerId !== pointerId) return;
      applySplitRatio(ratioFromPointer(event.clientX), false);
    });

    const finishDrag = (event) => {
      if (!dragging || event.pointerId !== pointerId) return;
      dragging = false;
      document.body.classList.remove('map-split-resizing');
      try { handle.releasePointerCapture(pointerId); } catch (_) {}
      pointerId = null;
      localStorage.setItem(STORAGE_KEY, String(splitRatio));
      invalidateMapSize();
    };

    handle.addEventListener('pointerup', finishDrag);
    handle.addEventListener('pointercancel', finishDrag);

    handle.addEventListener('keydown', (event) => {
      if (window.innerWidth <= DESKTOP_BREAKPOINT) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        applySplitRatio(splitRatio + 0.03);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        applySplitRatio(splitRatio - 0.03);
      } else if (event.key === 'Home') {
        event.preventDefault();
        applySplitRatio(0.22);
      } else if (event.key === 'End') {
        event.preventDefault();
        applySplitRatio(0.56);
      }
    });

    applySplitRatio(splitRatio, false);
  }

  function handleWindowResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const container = stage();
      if (!container) return;
      if (window.innerWidth > DESKTOP_BREAKPOINT) {
        applySplitRatio(splitRatio, false);
      } else {
        container.style.removeProperty('--map-list-width');
      }
      invalidateMapSize();
    }, 100);
  }

  function init() {
    mountSplitView();
    window.addEventListener('resize', handleWindowResize, {passive: true});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once: true});
  } else {
    init();
  }
})();
