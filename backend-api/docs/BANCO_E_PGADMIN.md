# Banco de ambulâncias e pgAdmin

## Adaptação da base enviada

O ZIP `postgresql-DB (2).zip` contém um exemplo de biblioteca. Usamos sua estrutura
como referência de arquitetura para o domínio de ambulâncias. Não importamos
autores, livros ou empréstimos e não executamos seus scripts de inicialização.

| Princípio da base | Aplicação no projeto |
| --- | --- |
| Separação de estrutura, índices e dados de exemplo | Migrations versionam schema e índices. Seeders criam os exemplos explicitamente. |
| IDs numéricos e relacionamentos explícitos | `usuarios.id`, `dispositivos.usuario_id`, `localizacoes.dispositivo_id`. |
| Integridade também no banco | FKs, UNIQUE, CHECK para coordenadas, bateria, velocidade, quilometragem, perfis e hashes. |
| Índices orientados a consultas | Índice em `dispositivos.usuario_id` para o mapa do funcionário. Índice composto de histórico já existente. |
| Proteção de registros relacionados | Exclusão física de dispositivo com histórico agora falha com RESTRICT. Desativação pela API continua funcionando. |
| Datas com fuso | TIMESTAMPTZ e fuso da conexão igual ao Laravel. Cadastros têm datas obrigatórias e DEFAULT CURRENT_TIMESTAMP. |
| Regras visíveis na aplicação | Controllers/services coordenam as operações. Não adicionamos triggers ou procedures. |
| Configuração externa | Credenciais do PostgreSQL e pgAdmin vêm do `.env`. |

Os IDs existentes usam BIGINT com sequência (`bigIncrements`), compatível com o
Eloquent. Mantivemos essas sequências para preservar a estrutura em uso, em vez de
recriar as chaves como IDENTITY. Índices UNIQUE já existem para email, identificador
e tokens, por isso não criamos índices duplicados. A aplicação não tem uma regra
análoga a “um empréstimo aberto por exemplar”, então não copiamos aquele índice
parcial de biblioteca sem uma necessidade no domínio.

A posição atual em `dispositivos` é uma duplicação intencional para leitura rápida.
`localizacoes` mantém o histórico completo. API e simulador gravam as duas partes
na mesma transação. Os históricos anteriores continuam preservados.

## Aplicação e backup

Em instalações novas, copie `.env.example` para `.env` e configure as senhas antes
de executar `docker compose up -d --build`. Em instalações existentes, mantenha o
`.env` e apenas acrescente as variáveis novas do pgAdmin.

A migration `2026_09_10_000005_aprimorar_integridade_e_indices_do_banco` adapta o
banco existente sem recriar tabelas nem apagar dados. Se houver dados legados
incompatíveis, como timestamps nulos, a migration falha e a transação reverte as
mudanças. Corrija os registros conscientemente antes de tentar novamente.

```powershell
docker compose exec api php artisan migrate --force
docker compose up -d pgadmin
```

O backup anterior à adaptação fica em `backups/ambulancias-antes-adaptacao-20260910.dump`.
É um arquivo no formato custom do `pg_dump`, restaurável pelo pgAdmin/pg_restore.
Ele contém os dados do projeto e fica fora do Git. Não use `docker compose down -v`
para aplicar migrations: essa opção remove os volumes e os dados.

## Abrir o pgAdmin

1. Acesse **http://localhost:5050**.
2. Entre com `PGADMIN_DEFAULT_EMAIL` e `PGADMIN_DEFAULT_PASSWORD` do `.env`.
3. Expanda **Servers > Projeto Ambulancias > Ambulancias - PostgreSQL local**.
4. Quando pedir a senha do servidor, use `DB_PASSWORD` do `.env`.
5. Abra **Databases > ambulancias > Schemas > public > Tables**.
6. Clique com o botão direito numa tabela e use **View/Edit Data > All Rows**.
7. Para executar SQL, selecione o banco e abra **Query Tool**.

O login do pgAdmin é separado da senha do PostgreSQL e do login da API.
O servidor vem pré-cadastrado, mas a senha do banco não fica no arquivo JSON.

Se precisar cadastrar a conexão manualmente:

| Campo | Valor local |
| --- | --- |
| Host | `postgres` |
| Porta interna | `5432` |
| Maintenance database | `ambulancias` |
| Username | `ambulancias` |
| Password | `DB_PASSWORD` do `.env` |

Dentro do Docker, `localhost` seria o próprio pgAdmin. O nome `postgres` resolve
para o serviço do banco. Se mudar banco/usuário, ajuste também a conexão salva
no pgAdmin ou `docker/pgadmin/servers.json` para instalações novas.

As variáveis `PGADMIN_DEFAULT_*` criam o primeiro usuário apenas no primeiro uso
do volume. Depois disso, alterar o `.env` não troca a senha de uma conta existente.
O mesmo vale para `POSTGRES_*`: mudar a senha no `.env` não altera o usuário que
já existe no volume PostgreSQL. Faça a alteração no servidor de forma coordenada.

## Comunicação e persistência

```text
Navegador do gestor -> localhost:8000 -> Laravel -> postgres:5432 -> banco ambulancias
Navegador do administrador -> localhost:5050 -> pgAdmin -> postgres:5432 -> mesmo banco
```

`postgres_data` guarda o banco. `pgadmin_data` guarda contas e preferências do
pgAdmin. O pgAdmin fica exposto somente em 127.0.0.1 na porta configurável
`PGADMIN_PORT`. O Adminer anterior continua disponível na porta 8080.

Edições pelo pgAdmin passam pelas restrições do PostgreSQL, mas não executam
controllers/services do Laravel. Para registrar GPS e manter histórico e posição
atual sincronizados, use a API ou o simulador. Ao editar cadastros por SQL,
atualize também `updated_at`; o DEFAULT preenche apenas a inserção.

## Verificações

```powershell
docker compose exec api php tests/banco_integridade_smoke.php
docker compose exec api php tests/simulacao_smoke.php
```

O primeiro teste tenta operações inválidas diretamente no banco para verificar
que as constraints as rejeitam. As linhas de teste são revertidas ao terminar.
Sequências podem avançar mesmo com rollback, o que é normal no PostgreSQL.

Referência do container e persistência do pgAdmin:
[documentação oficial](https://www.pgadmin.org/docs/pgadmin4/9.17/container_deployment.html).
