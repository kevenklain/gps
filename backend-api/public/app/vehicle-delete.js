(() => {
    const body = document.getElementById('devicesBody');
    if (!body) return;

    const showMessage = (message, type = 'success') => {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
            return;
        }
        if (type === 'error') window.alert(message);
    };

    const enhanceRows = () => {
        body.querySelectorAll('tr').forEach((row) => {
            const actions = row.querySelector('td.actions');
            if (!actions) return;

            // O botão Desativar só existe para administradores. Isso evita expor
            // a exclusão permanente para funcionários comuns.
            if (!actions.querySelector('[onclick^="deactivateDevice"]')) return;
            if (actions.querySelector('.delete-vehicle-button')) return;

            const id = row.children[0]?.textContent?.trim();
            const name = row.children[1]?.textContent?.trim() || 'este veículo';
            if (!id) return;

            const button = document.createElement('button');
            button.className = 'btn small danger delete-vehicle-button';
            button.type = 'button';
            button.dataset.vehicleId = id;
            button.dataset.vehicleName = name;
            button.textContent = 'Excluir';
            button.title = 'Excluir permanentemente o veículo e seu histórico GPS';
            actions.appendChild(button);
        });
    };

    body.addEventListener('click', async (event) => {
        const button = event.target.closest('.delete-vehicle-button');
        if (!button) return;

        const id = button.dataset.vehicleId;
        const name = button.dataset.vehicleName || 'este veículo';
        const confirmed = window.confirm(
            `Excluir permanentemente o veículo "${name}"?\n\n` +
            'Esta ação também apagará todo o histórico GPS associado e não poderá ser desfeita.'
        );
        if (!confirmed) return;

        const token = localStorage.getItem('ambulancias_token') || '';
        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = 'Excluindo...';

        try {
            const response = await fetch(`/api/dispositivos/${encodeURIComponent(id)}/excluir`, {
                method: 'DELETE',
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });

            let data = {};
            try {
                data = await response.json();
            } catch (_) {}

            if (!response.ok) {
                throw new Error(data.mensagem || data.message || `Erro HTTP ${response.status}`);
            }

            showMessage(data.mensagem || 'Veículo excluído permanentemente.');

            // Reutiliza o fluxo normal da aplicação para recarregar a lista e
            // manter state.devices sincronizado com o banco.
            document.getElementById('refreshButton')?.click();
        } catch (error) {
            button.disabled = false;
            button.textContent = originalText;
            showMessage(error.message || 'Não foi possível excluir o veículo.', 'error');
        }
    });

    // Observa apenas substituições diretas das linhas do tbody. O observer não
    // acompanha subárvores, portanto inserir o próprio botão não cria um loop.
    const observer = new MutationObserver(() => enhanceRows());
    observer.observe(body, {childList: true});

    enhanceRows();
})();
