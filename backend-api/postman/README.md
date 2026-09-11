# Postman - Ambulâncias MVP

Importe os dois arquivos:

1. `Ambulancias-MVP.postman_collection.json`
2. `Ambulancias-MVP-Local.postman_environment.json`

Selecione o environment **Ambulancias MVP - Local**.

## Ordem recomendada para um teste completo

1. `00 - Saúde > Health check`
2. `01 - Autenticação > Login administrador`
3. `02 - Usuários > Criar funcionário`
4. `03 - Dispositivos > Criar dispositivo`
5. `04 - Localizações GPS > Enviar localização do tablet`
6. `04 - Localizações GPS > Histórico do dispositivo`
7. `05 - Painel > Resumo do painel`

Os scripts da collection salvam automaticamente:

- `auth_token`
- `usuario_id`
- `dispositivo_id`
- `device_token`

Assim você não precisa copiar IDs e tokens manualmente durante o fluxo principal.
