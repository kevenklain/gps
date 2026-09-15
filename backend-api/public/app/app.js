(() => {
    const loginView = document.getElementById('loginView');
    if (!loginView) return;

    const ensureStylesheet = (href, id) => {
        if (document.getElementById(id)) return;
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    };

    ensureStylesheet(
        'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400,0,0',
        'login-fonts'
    );

    const ambulanceLogo = `
        <svg viewBox="0 0 84 70" aria-hidden="true" focusable="false">
            <g fill="none" stroke="#153a69" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 27h48c4.4 0 8 3.6 8 8v19H7V35c0-4.4 1.6-8 5-8z" fill="#fff"/>
                <path d="M18 16h31c4 0 6 2 6 6v5H14v-6c0-3.2 1.4-5 4-5z" fill="#fff"/>
                <path d="M14 27v14H7l6-14z" fill="#dff1ff"/>
                <path d="M20 27h18v14H20z" fill="#dff1ff"/>
                <path d="M40 27h14v14H40z" fill="#dff1ff"/>
                <path d="M7 43h61" stroke="#ef4e5b" stroke-width="5.2"/>
                <path d="M35 25v17M27 33.5h16" stroke="#1677ef" stroke-width="5.4"/>
                <path d="M23 11h8v5h-8zM42 11h8v5h-8z" fill="#ef4e5b" stroke="#153a69"/>
                <path d="M61 34h7v9h-7" fill="#dff1ff"/>
                <circle cx="20" cy="55" r="8" fill="#fff"/>
                <circle cx="20" cy="55" r="3.7" fill="#153a69" stroke="none"/>
                <circle cx="53" cy="55" r="8" fill="#fff"/>
                <circle cx="53" cy="55" r="3.7" fill="#153a69" stroke="none"/>
            </g>
        </svg>`;

    loginView.innerHTML = `
        <div class="login-map-art" aria-hidden="true">
            <span class="login-map-pin material-symbols-rounded">location_on</span>
        </div>

        <section class="login-reference-card" aria-labelledby="loginTitle">
            <div class="login-reference-brand">
                <span class="login-reference-logo">${ambulanceLogo}</span>
                <div class="login-reference-brand-copy">
                    <strong>Ambulâncias</strong>
                    <span>MVP</span>
                </div>
            </div>

            <header class="login-reference-header">
                <h1 id="loginTitle">Acessar painel</h1>
                <p>Entre para acompanhar a frota.</p>
            </header>

            <form id="loginForm" class="login-reference-form">
                <label class="login-reference-label" for="loginEmail">E-mail</label>
                <div class="login-reference-field">
                    <span class="material-symbols-rounded" aria-hidden="true">mail</span>
                    <input id="loginEmail" type="email" placeholder="seu@email.com" required autocomplete="username">
                </div>

                <label class="login-reference-label" for="loginSenha">Senha</label>
                <div class="login-reference-field">
                    <span class="material-symbols-rounded" aria-hidden="true">lock</span>
                    <input id="loginSenha" type="password" placeholder="Sua senha" required autocomplete="current-password">
                    <button id="togglePassword" class="login-reference-eye" type="button" aria-label="Mostrar senha">
                        <span class="material-symbols-rounded" aria-hidden="true">visibility</span>
                    </button>
                </div>

                <div class="login-reference-options">
                    <label class="login-reference-remember">
                        <input id="rememberLogin" type="checkbox" checked>
                        <span class="login-reference-checkmark" aria-hidden="true"></span>
                        <span>Manter-me conectado</span>
                    </label>
                    <button class="login-reference-forgot" type="button" disabled title="Recuperação de senha ainda não disponível">Esqueci minha senha</button>
                </div>

                <button class="login-reference-submit" type="submit">
                    <span class="material-symbols-rounded" aria-hidden="true">login</span>
                    <span>Entrar</span>
                </button>
            </form>

            <div class="login-reference-demo">
                <span class="login-reference-demo-icon material-symbols-rounded" aria-hidden="true">group</span>
                <div class="login-reference-demo-copy">
                    <strong>Acesso de demonstração</strong>
                    <div class="login-reference-demo-line">
                        <span>E-mail:</span>
                        <b>admin@ambulancias.local</b>
                        <span class="login-reference-demo-divider">|</span>
                        <span>Senha:</span>
                        <b>admin123</b>
                    </div>
                </div>
            </div>
        </section>

        <div class="login-reference-footer login-reference-footer-left">Ambulâncias MVP <span>•</span> Tecnologia para salvar vidas.</div>
        <div class="login-reference-footer login-reference-footer-right">Cidades mais seguras, sempre.</div>
    `;

    const passwordInput = document.getElementById('loginSenha');
    const togglePassword = document.getElementById('togglePassword');
    togglePassword?.addEventListener('click', () => {
        const hidden = passwordInput.type === 'password';
        passwordInput.type = hidden ? 'text' : 'password';
        togglePassword.setAttribute('aria-label', hidden ? 'Ocultar senha' : 'Mostrar senha');
        const icon = togglePassword.querySelector('.material-symbols-rounded');
        if (icon) icon.textContent = hidden ? 'visibility_off' : 'visibility';
    });

    const core = document.createElement('script');
    core.src = './app-core.js?v=20260915-login-ref';
    core.async = false;
    document.body.appendChild(core);
})();