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

    loginView.innerHTML = `
        <div class="login-map-art" aria-hidden="true">
            <span class="login-map-pin material-symbols-rounded">location_on</span>
        </div>

        <section class="login-reference-card" aria-labelledby="loginTitle">
            <div class="login-reference-brand login-reference-brand-localiza">
                <img class="login-localizafrota-logo" src="./localizafrota-logo.png?v=20260915-2" alt="LocalizaFrota">
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