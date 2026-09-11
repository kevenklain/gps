const API_BASE = '/api';

const state = {
    token: localStorage.getItem('ambulancias_token') || '',
    user: null,
    users: [],
    devices: [],
    currentPage: 'dashboard',
};

const $ = (id) => document.getElementById(id);

const pageMeta = {
    dashboard: ['Visão geral', 'Resumo atual da frota'],
    mapa: ['Mapa', 'Localização das ambulâncias no mundo'],
    usuarios: ['Usuários', 'CRUD de administradores e funcionários'],
    dispositivos: ['Dispositivos', 'CRUD de tablets e ambulâncias'],
    localizacoes: ['Localizações', 'Histórico GPS por dispositivo'],
};

function showToast(message, type = 'success') {
    const toast = $('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.className = 'toast', 3500);
}

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

// Ponte HTTP entre as telas e o Laravel. Os caminhos recebidos sao relativos a
// /api; fetch envia JSON e o token de usuario em Authorization: Bearer.
// Os controllers devolvem JSON; esta funcao converte falhas HTTP em erros para a UI.
async function api(path, options = {}) {
    const headers = {
        Accept: 'application/json',
        ...(options.body ? {'Content-Type': 'application/json'} : {}),
        ...(options.headers || {}),
    };

    if (state.token && !headers.Authorization) {
        headers.Authorization = `Bearer ${state.token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {...options, headers});
    let data;
    try {
        data = await response.json();
    } catch {
        data = {sucesso: false, mensagem: `Resposta HTTP ${response.status} sem JSON.`};
    }

    if (response.status === 401 && path !== '/login') {
        logoutLocal();
        throw new Error(data.mensagem || 'Sessão expirada. Faça login novamente.');
    }

    if (!response.ok) {
        const validation = data.errors
            ? Object.values(data.errors).flat().join(' ')
            : '';
        throw new Error(validation || data.mensagem || data.message || `Erro HTTP ${response.status}`);
    }

    return data;
}

function setSession(token, user) {
    state.token = token;
    state.user = user;
    localStorage.setItem('ambulancias_token', token);
    renderSession();
}

function logoutLocal() {
    resetFleetMap();
    state.token = '';
    state.user = null;
    state.users = [];
    state.devices = [];
    localStorage.removeItem('ambulancias_token');
    $('appView').classList.add('hidden');
    $('loginView').classList.remove('hidden');
}

function renderSession() {
    const logged = Boolean(state.token && state.user);
    $('loginView').classList.toggle('hidden', logged);
    $('appView').classList.toggle('hidden', !logged);

    if (!logged) return;

    $('sidebarUserName').textContent = state.user.nome;
    $('sidebarUserType').textContent = state.user.tipo === 'admin' ? 'Administrador' : 'Funcionário';

    document.querySelectorAll('.admin-only').forEach(el => {
        el.classList.toggle('hidden', state.user.tipo !== 'admin');
    });

    if (state.user.tipo !== 'admin' && state.currentPage === 'usuarios') {
        navigateTo('dashboard');
    }
}

async function restoreSession() {
    if (!state.token) return renderSession();
    try {
        const data = await api('/me');
        state.user = data.usuario;
        renderSession();
        await loadPage(state.currentPage);
    } catch (error) {
        showToast(error.message, 'error');
        logoutLocal();
    }
}

async function login(event) {
    event.preventDefault();
    try {
        const data = await api('/login', {
            method: 'POST',
            body: JSON.stringify({
                email: $('loginEmail').value.trim(),
                senha: $('loginSenha').value,
            }),
        });
        setSession(data.token, data.usuario);
        showToast('Login realizado com sucesso.');
        await loadPage(state.currentPage);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function logout() {
    try {
        if (state.token) await api('/logout', {method: 'POST'});
    } catch (_) {
        // Mesmo se a API falhar, removemos a sessão local.
    }
    logoutLocal();
}

function navigateTo(page) {
    if (page !== 'mapa') stopMapSimulation();
    state.currentPage = page;
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    $(`${page}Page`).classList.add('active');
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');

    const [title, subtitle] = pageMeta[page];
    $('pageTitle').textContent = title;
    $('pageSubtitle').textContent = subtitle;
    loadPage(page).catch(error => showToast(error.message, 'error'));
}

async function loadPage(page) {
    if (page === 'mapa') return loadFleetMap();
    if (page === 'dashboard') return loadDashboard();
    if (page === 'usuarios') return loadUsers();
    if (page === 'dispositivos') return loadDevices();
    if (page === 'localizacoes') {
        await loadDevices();
        populateLocationDeviceSelect();
        if (state.devices.length) await loadLocations();
    }
}

// Estado visual do mapa fica no navegador. Posicoes e historico ficam no banco.
// fleetMapRequest identifica a consulta mais recente para descartar respostas
// atrasadas, inclusive respostas que chegaram depois de trocar a sessao.
let fleetMap = null;
let fleetMarkers = null;
let fleetMapRequest = 0;
let fleetMapTimer = null;
let mapSimulationRunning = false;
let mapSelectionChanged = false;
const mapStatus = {
    online: ['Online', '#128a55'],
    sem_comunicacao: ['Sem comunicação', '#b26a00'],
    offline: ['Offline', '#c62828'],
    inativo: ['Inativo', '#667085'],
};

function resetFleetMap() {
    stopMapSimulation();
    fleetMapRequest++;
    if (fleetMap) fleetMap.remove();
    fleetMap = null;
    fleetMarkers = null;
    $('mapDevices').replaceChildren();
    $('mapDeviceFilter').innerHTML = '<option value="all">Todas as ambulâncias</option>';
}

function stopMapSimulation() {
    // Nao existe um processo de simulacao permanente no servidor. Parar significa
    // deixar de agendar novos POSTs; uma requisicao ja enviada pode concluir.
    clearTimeout(fleetMapTimer);
    mapSimulationRunning = false;
    $('mapSimulationButton').textContent = 'Iniciar simulação em Brasília';
    $('mapSimulationStatus').textContent = 'Posições mais recentes atualizadas a cada 5 segundos enquanto o mapa estiver aberto.';
}

async function toggleMapSimulation() {
    if (mapSimulationRunning) {
        stopMapSimulation();
        await loadFleetMap();
        return;
    }
    if (state.user?.tipo !== 'admin') return;
    mapSimulationRunning = true;
    $('mapSimulationButton').textContent = 'Parar simulação';
    $('mapSimulationStatus').textContent = 'Simulação ativa: as 10 ambulâncias de exemplo circulam em trajetos fictícios em Brasília. Os pontos são gravados a cada 5 segundos. Ao sair do mapa, a simulação para.';
    await tickFleetMap();
}

async function tickFleetMap() {
    if (state.currentPage !== 'mapa' || !state.token) return;
    try {
        // Primeiro escreve: rota -> middlewares -> controller -> service -> banco.
        // O filtro visual de uma ambulancia nao altera o conjunto simulado pelo service.
        if (mapSimulationRunning) await api('/simulacao/brasilia', {method: 'POST'});
    } catch (error) {
        stopMapSimulation();
        showToast(error.message, 'error');
    }
    // Depois consulta o banco via GET para desenhar as posicoes recem-gravadas.
    if (state.currentPage === 'mapa' && state.token) await loadFleetMap();
}

function fitFleetMap() {
    if (!fleetMap) return;
    const bounds = fleetMarkers.getBounds();
    if (bounds.isValid()) fleetMap.fitBounds(bounds, {padding: [40, 40], maxZoom: 14});
    else fleetMap.setView([20, 0], 2);
}

function hasMapPosition(device) {
    return device.latitude != null && device.longitude != null &&
        String(device.latitude).trim() !== '' && String(device.longitude).trim() !== '' &&
        Number.isFinite(Number(device.latitude)) && Number.isFinite(Number(device.longitude)) &&
        Math.abs(Number(device.latitude)) <= 90 && Math.abs(Number(device.longitude)) <= 180;
}

async function loadFleetMap() {
    clearTimeout(fleetMapTimer);
    const request = ++fleetMapRequest;
    const token = state.token;
    $('mapSummary').textContent = 'Carregando ambulâncias...';
    $('mapError').classList.add('hidden');
    try {
        if (!window.L) throw new Error('Não foi possível carregar o mapa. Verifique sua conexão e recarregue a página.');
        if (!fleetMap) {
            // Leaflet desenha o mapa. OpenStreetMap fornece somente as imagens
            // cartograficas por HTTP; os dados da frota vem da nossa API Laravel.
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
        fleetMap.invalidateSize();
        // DispositivoController aplica a permissao de visibilidade no servidor:
        // admin recebe a frota inteira; funcionario recebe os seus dispositivos.
        const data = await api('/dispositivos');
        if (request !== fleetMapRequest || token !== state.token) return;
        const devices = data.dados;
        const select = $('mapDeviceFilter');
        let selected = select.value;
        if (selected !== 'all' && !devices.some(device => String(device.id) === selected)) selected = 'all';
        select.innerHTML = '<option value="all">Todas as ambulâncias</option>' + devices.map(device =>
            `<option value="${device.id}">${escapeHtml(device.nome)}</option>`).join('');
        select.value = selected;
        // Selecionar todas/uma filtra apenas os marcadores, sem modificar cadastros.
        const visible = devices.filter(device => selected === 'all' || String(device.id) === selected);
        const located = visible.filter(hasMapPosition);
        const firstLoad = fleetMarkers.getLayers().length === 0;
        fleetMarkers.clearLayers();
        $('mapDevices').replaceChildren();
        for (const device of devices) {
            const [label, color] = mapStatus[device.status] || mapStatus.offline;
            const button = document.createElement('button');
            button.className = 'map-device';
            button.type = 'button';
            button.textContent = `${device.nome} • ${device.placa || 'Sem placa'} — ${label}`;
            if (hasMapPosition(device) && (selected === 'all' || String(device.id) === selected)) {
                const marker = L.marker([Number(device.latitude), Number(device.longitude)], {
                    title: device.nome,
                    icon: L.divIcon({
                        className: 'ambulance-marker',
                        html: `<span style="border-color:${color}">🚑</span>`,
                        iconSize: [38, 38], iconAnchor: [19, 19],
                    }),
                }).bindPopup(`<strong>${escapeHtml(device.nome)}</strong><br>
                    Placa: ${escapeHtml(device.placa || '-')}<br>
                    Responsável: ${escapeHtml(device.usuario?.nome || '-')}<br>
                    Status: ${label}<br>
                    Velocidade: ${escapeHtml(device.velocidade ?? '-')} km/h<br>
                    Bateria: ${escapeHtml(device.bateria ?? '-')}%<br>
                    Última comunicação: ${escapeHtml(formatDate(device.ultima_comunicacao))}`)
                    .addTo(fleetMarkers);
                button.addEventListener('click', () => {
                    select.value = String(device.id);
                    mapSelectionChanged = true;
                    loadFleetMap();
                    fleetMap.setView(marker.getLatLng(), 15);
                    marker.openPopup();
                });
                if (selected !== 'all') marker.openPopup();
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
        if (!located.length && devices.length) $('mapSummary').textContent += ' Envie uma localização pelo tablet ou pelo Simular GPS.';
        if (firstLoad || mapSelectionChanged) fitFleetMap();
        mapSelectionChanged = false;
    } catch (error) {
        if (request !== fleetMapRequest) return;
        $('mapSummary').textContent = 'Não foi possível atualizar as posições. Os dados exibidos podem estar desatualizados.';
        $('mapError').textContent = error.message;
        $('mapError').classList.remove('hidden');
    } finally {
        // Polling: agenda a proxima consulta depois da resposta, sem WebSocket.
        // Com simulacao desligada o ciclo so consulta; ligada, escreve e consulta.
        if (request === fleetMapRequest && state.currentPage === 'mapa' && state.token) {
            fleetMapTimer = setTimeout(tickFleetMap, 5000);
        }
    }
}

async function loadDashboard() {
    const data = await api('/painel');
    $('statTotal').textContent = data.resumo.total;
    $('statOnline').textContent = data.resumo.online;
    $('statWarning').textContent = data.resumo.sem_comunicacao;
    $('statOffline').textContent = data.resumo.offline;

    $('dashboardDevicesBody').innerHTML = data.dispositivos.length
        ? data.dispositivos.map(device => `
            <tr>
                <td><strong>${escapeHtml(device.nome)}</strong><br><small class="muted">${escapeHtml(device.identificador)}</small></td>
                <td>${escapeHtml(device.placa || '-')}</td>
                <td><span class="badge ${escapeHtml(device.status)}">${escapeHtml(device.status)}</span></td>
                <td>${device.latitude && device.longitude ? `${escapeHtml(device.latitude)}, ${escapeHtml(device.longitude)}` : '-'}</td>
                <td>${device.velocidade ?? '-'}${device.velocidade != null ? ' km/h' : ''}</td>
                <td>${device.bateria ?? '-'}${device.bateria != null ? '%' : ''}</td>
                <td>${formatDate(device.ultima_comunicacao)}</td>
            </tr>`).join('')
        : '<tr><td colspan="7" class="empty">Nenhum dispositivo ativo cadastrado.</td></tr>';
}

async function loadUsers() {
    if (state.user.tipo !== 'admin') return;
    const data = await api('/usuarios');
    state.users = data.dados;
    renderUsers();
    populateDeviceUserSelect();
}

function renderUsers() {
    $('usersBody').innerHTML = state.users.length
        ? state.users.map(user => `
            <tr>
                <td>${user.id}</td>
                <td>${escapeHtml(user.nome)}</td>
                <td>${escapeHtml(user.email)}</td>
                <td><span class="badge ${escapeHtml(user.tipo)}">${escapeHtml(user.tipo)}</span></td>
                <td><span class="badge ${user.ativo ? 'ativo' : 'inativo'}">${user.ativo ? 'ativo' : 'inativo'}</span></td>
                <td class="actions">
                    <button class="btn small secondary" onclick="editUser(${user.id})">Editar</button>
                    <button class="btn small danger" onclick="deactivateUser(${user.id})">Desativar</button>
                </td>
            </tr>`).join('')
        : '<tr><td colspan="6" class="empty">Nenhum usuário cadastrado.</td></tr>';
}

function openUserDialog(user = null) {
    $('userForm').reset();
    $('userId').value = user?.id || '';
    $('userName').value = user?.nome || '';
    $('userEmail').value = user?.email || '';
    $('userPassword').value = '';
    $('userType').value = user?.tipo || 'funcionario';
    $('userActive').checked = user ? Boolean(user.ativo) : true;
    $('userDialogTitle').textContent = user ? 'Editar usuário' : 'Novo usuário';
    $('userPasswordHint').textContent = user ? 'deixe vazio para manter a senha atual' : 'mínimo 6 caracteres';
    $('userPassword').required = !user;
    $('userDialog').showModal();
}

window.editUser = (id) => {
    const user = state.users.find(item => item.id === id);
    if (user) openUserDialog(user);
};

window.deactivateUser = async (id) => {
    const user = state.users.find(item => item.id === id);
    if (!user || !confirm(`Desativar o usuário "${user.nome}"?`)) return;
    try {
        const data = await api(`/usuarios/${id}`, {method: 'DELETE'});
        showToast(data.mensagem);
        await loadUsers();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

async function saveUser(event) {
    event.preventDefault();
    const id = $('userId').value;
    const payload = {
        nome: $('userName').value.trim(),
        email: $('userEmail').value.trim(),
        tipo: $('userType').value,
        ativo: $('userActive').checked,
    };
    if ($('userPassword').value) payload.senha = $('userPassword').value;

    try {
        const data = await api(id ? `/usuarios/${id}` : '/usuarios', {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(payload),
        });
        $('userDialog').close();
        showToast(data.mensagem);
        await loadUsers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function loadDevices() {
    const data = await api('/dispositivos');
    state.devices = data.dados;
    renderDevices();
    populateLocationDeviceSelect();

    if (state.user.tipo === 'admin' && !state.users.length) {
        try { await loadUsers(); } catch (_) {}
    }
}

function renderDevices() {
    $('devicesBody').innerHTML = state.devices.length
        ? state.devices.map(device => `
            <tr>
                <td>${device.id}</td>
                <td>${escapeHtml(device.nome)}</td>
                <td>${escapeHtml(device.identificador)}</td>
                <td>${escapeHtml(device.placa || '-')}</td>
                <td>${escapeHtml(device.usuario?.nome || '-')}</td>
                <td>${escapeHtml(device.quilometragem || '0.00')}</td>
                <td><span class="badge ${escapeHtml(device.status)}">${escapeHtml(device.status)}</span></td>
                <td class="actions">
                    ${state.user.tipo === 'admin' ? `
                        <button class="btn small secondary" onclick="editDevice(${device.id})">Editar</button>
                        <button class="btn small secondary" onclick="regenerateDeviceToken(${device.id})">Novo token</button>
                        <button class="btn small danger" onclick="deactivateDevice(${device.id})">Desativar</button>
                    ` : ''}
                    <button class="btn small ghost" onclick="openDeviceLocations(${device.id})">Histórico</button>
                </td>
            </tr>`).join('')
        : '<tr><td colspan="8" class="empty">Nenhum dispositivo cadastrado.</td></tr>';
}

function populateDeviceUserSelect(selectedId = '') {
    const select = $('deviceUser');
    if (!select) return;
    const options = state.users
        .filter(user => user.ativo && user.tipo === 'funcionario')
        .map(user => `<option value="${user.id}" ${String(selectedId) === String(user.id) ? 'selected' : ''}>${escapeHtml(user.nome)} (${escapeHtml(user.email)})</option>`)
        .join('');
    select.innerHTML = `<option value="">Sem funcionário vinculado</option>${options}`;
}

async function openDeviceDialog(device = null) {
    if (state.user.tipo !== 'admin') return;
    if (!state.users.length) await loadUsers();

    $('deviceForm').reset();
    $('deviceId').value = device?.id || '';
    $('deviceName').value = device?.nome || '';
    $('deviceIdentifier').value = device?.identificador || '';
    $('devicePlate').value = device?.placa || '';
    $('deviceModel').value = device?.modelo_veiculo || '';
    $('deviceMileage').value = device?.quilometragem || 0;
    $('deviceActive').checked = device ? Boolean(device.ativo) : true;
    populateDeviceUserSelect(device?.usuario_id || '');
    $('deviceDialogTitle').textContent = device ? 'Editar dispositivo' : 'Novo dispositivo';
    $('deviceDialog').showModal();
}

window.editDevice = (id) => {
    const device = state.devices.find(item => item.id === id);
    if (device) openDeviceDialog(device);
};

async function saveDevice(event) {
    event.preventDefault();
    const id = $('deviceId').value;
    const payload = {
        nome: $('deviceName').value.trim(),
        identificador: $('deviceIdentifier').value.trim(),
        placa: $('devicePlate').value.trim() || null,
        modelo_veiculo: $('deviceModel').value.trim() || null,
        quilometragem: Number($('deviceMileage').value || 0),
        usuario_id: $('deviceUser').value ? Number($('deviceUser').value) : null,
        ativo: $('deviceActive').checked,
    };

    try {
        const data = await api(id ? `/dispositivos/${id}` : '/dispositivos', {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(payload),
        });
        $('deviceDialog').close();
        showToast(data.mensagem);
        if (data.device_token) showDeviceToken(data.device_token);
        await loadDevices();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

window.regenerateDeviceToken = async (id) => {
    if (!confirm('Gerar um novo token? O token antigo deixará de funcionar.')) return;
    try {
        const data = await api(`/dispositivos/${id}/gerar-token`, {method: 'POST'});
        showDeviceToken(data.device_token);
        showToast(data.mensagem);
    } catch (error) {
        showToast(error.message, 'error');
    }
};

window.deactivateDevice = async (id) => {
    const device = state.devices.find(item => item.id === id);
    if (!device || !confirm(`Desativar o dispositivo "${device.nome}"?`)) return;
    try {
        const data = await api(`/dispositivos/${id}`, {method: 'DELETE'});
        showToast(data.mensagem);
        await loadDevices();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

function showDeviceToken(token) {
    $('deviceTokenOutput').value = token;
    $('locationDeviceToken').value = token;
    $('tokenDialog').showModal();
}

function populateLocationDeviceSelect(selectedId = '') {
    const current = selectedId || $('locationDeviceSelect').value;
    $('locationDeviceSelect').innerHTML = state.devices.length
        ? state.devices.map(device => `<option value="${device.id}" ${String(current) === String(device.id) ? 'selected' : ''}>${escapeHtml(device.nome)} - ${escapeHtml(device.identificador)}</option>`).join('')
        : '<option value="">Nenhum dispositivo</option>';
}

window.openDeviceLocations = async (id) => {
    navigateTo('localizacoes');
    setTimeout(async () => {
        populateLocationDeviceSelect(id);
        await loadLocations();
    }, 0);
};

async function loadLocations() {
    const id = $('locationDeviceSelect').value;
    if (!id) {
        $('locationsBody').innerHTML = '<tr><td colspan="6" class="empty">Cadastre um dispositivo primeiro.</td></tr>';
        return;
    }

    try {
        const data = await api(`/dispositivos/${id}/localizacoes?limite=100`);
        $('locationsBody').innerHTML = data.dados.length
            ? data.dados.map(location => `
                <tr>
                    <td>${formatDate(location.registrado_em)}</td>
                    <td>${escapeHtml(location.latitude)}</td>
                    <td>${escapeHtml(location.longitude)}</td>
                    <td>${location.velocidade ?? '-'}${location.velocidade != null ? ' km/h' : ''}</td>
                    <td>${location.precisao_gps ?? '-'}${location.precisao_gps != null ? ' m' : ''}</td>
                    <td>${location.bateria ?? '-'}${location.bateria != null ? '%' : ''}</td>
                </tr>`).join('')
            : '<tr><td colspan="6" class="empty">Nenhuma localização enviada ainda.</td></tr>';
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function simulateLocation(event) {
    event.preventDefault();
    const token = $('locationDeviceToken').value.trim();
    const payload = {
        latitude: Number($('locationLatitude').value),
        longitude: Number($('locationLongitude').value),
        velocidade: Number($('locationSpeed').value || 0),
        precisao_gps: Number($('locationAccuracy').value || 0),
        bateria: Number($('locationBattery').value || 0),
        quilometragem: Number($('locationMileage').value || 0),
    };

    try {
        const data = await api('/localizacoes', {
            method: 'POST',
            headers: {'X-Device-Token': token, Authorization: ''},
            body: JSON.stringify(payload),
        });
        $('locationDialog').close();
        showToast(data.mensagem);
        await loadDevices();
        await loadDashboard();
        await loadLocations();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function bindEvents() {
    $('mapFitButton').addEventListener('click', () => {
        $('mapDeviceFilter').value = 'all';
        mapSelectionChanged = true;
        loadFleetMap();
    });
    $('mapDeviceFilter').addEventListener('change', () => {
        mapSelectionChanged = true;
        loadFleetMap();
    });
    $('mapSimulationButton').addEventListener('click', toggleMapSimulation);
    $('mapWorldButton').addEventListener('click', () => fleetMap?.setView([20, 0], 2));
    $('loginForm').addEventListener('submit', login);
    $('logoutButton').addEventListener('click', logout);
    $('refreshButton').addEventListener('click', () => loadPage(state.currentPage).catch(error => showToast(error.message, 'error')));
    $('newUserButton').addEventListener('click', () => openUserDialog());
    $('newDeviceButton').addEventListener('click', () => openDeviceDialog());
    $('userForm').addEventListener('submit', saveUser);
    $('deviceForm').addEventListener('submit', saveDevice);
    $('loadLocationsButton').addEventListener('click', loadLocations);
    $('simulateLocationButton').addEventListener('click', () => $('locationDialog').showModal());
    $('locationForm').addEventListener('submit', simulateLocation);
    $('copyTokenButton').addEventListener('click', async () => {
        await navigator.clipboard.writeText($('deviceTokenOutput').value);
        showToast('Token copiado.');
    });

    document.querySelectorAll('[data-page]').forEach(button => {
        button.addEventListener('click', () => navigateTo(button.dataset.page));
    });

    document.querySelectorAll('[data-close-dialog]').forEach(button => {
        button.addEventListener('click', () => $(button.dataset.closeDialog).close());
    });
}

bindEvents();
restoreSession();
