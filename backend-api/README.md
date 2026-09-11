# Ambulâncias MVP — Laravel + PostgreSQL + Frontend HTML/CSS/JS

MVP didático para gestão de tablets/dispositivos instalados em ambulâncias.

## O que existe neste projeto

- Laravel API
- PostgreSQL 17
- Docker Compose
- Adminer
- Frontend em HTML + CSS + JavaScript puro
- CRUD de usuários
- CRUD de dispositivos/ambulâncias
- Histórico de localizações GPS
- Simulador web de envio de GPS
- Collection e Environment do Postman

## Regra principal

A tabela `dispositivos` guarda a **última posição conhecida** para consultas rápidas do painel.

A tabela `localizacoes` guarda o **histórico de posições**.

```text
Tablet / Expo
    |
    | POST /api/localizacoes
    | X-Device-Token
    v
Laravel API
    |
    +--> INSERT localizacoes   (histórico)
    |
    +--> UPDATE dispositivos   (posição atual)
    v
PostgreSQL
```

---

# 1. Rodar com Docker

Abra um terminal na pasta do projeto:

Na primeira instalação, copie `.env.example` para `.env` e configure as senhas
de PostgreSQL e pgAdmin antes de iniciar o Docker.

```powershell
docker compose up --build
```

Ou em segundo plano:

```powershell
docker compose up -d --build
```

Ver containers:

```powershell
docker compose ps
```

Ver logs:

```powershell
docker compose logs -f api
```

Parar:

```powershell
docker compose down
```

Reset completo do banco (APAGA OS DADOS):

```powershell
docker compose down -v
docker compose up --build
```

---

# 2. Abrir o frontend

Abra no navegador:

```text
http://localhost:8000
```

ou diretamente:

```text
http://localhost:8000/app/index.html
```

Login inicial:

```text
E-mail: admin@ambulancias.local
Senha: admin123
```

O frontend usa `fetch()` para consumir a API no mesmo servidor.

Depois do login, o token Bearer é guardado no `localStorage` do navegador.

---

# 3. O que testar no frontend

## Visão geral

Mostra:

- total de ambulâncias/dispositivos
- online
- sem comunicação
- offline
- última posição
- velocidade
- bateria

## Mapa e simulação em Brasília

No menu **Mapa**, escolha **Todas as ambulâncias** ou uma ambulância em
**Exibir no mapa**. Também é possível selecionar pela lista lateral.
**Ver todas** restaura a frota inteira; **Mapa mundial** afasta o zoom.

As posições são consultadas a cada 5 segundos enquanto o mapa estiver aberto.
Como administrador, clique em **Iniciar simulação em Brasília** para movimentar
os 10 dispositivos `DEMO-TABLET-01` a `DEMO-TABLET-10`. A simulação grava pontos
no histórico, atualiza a última posição e incrementa a quilometragem. Os trajetos
são fictícios e não seguem necessariamente as ruas. Clique em **Parar simulação**
ou saia da tela para interromper os envios. Outros dispositivos não são alterados.

Para posicionar os cadastros de exemplo inicialmente:

```powershell
docker compose exec api php artisan db:seed --class=BrasiliaSeeder --force
```

Verificação da simulação, com rollback dos dados do teste:

```powershell
docker compose exec api php tests/simulacao_smoke.php
```

## Usuários

Administrador pode:

- criar
- listar
- editar
- desativar
- reativar editando o registro

Tipos:

- `admin`
- `funcionario`

## Dispositivos

Administrador pode:

- criar
- listar
- editar
- desativar
- reativar
- gerar novo token do tablet

Ao criar um dispositivo, o token aberto aparece **uma única vez**. Copie esse token.

## Localizações

É possível:

- selecionar um dispositivo
- consultar o histórico GPS
- simular um envio do tablet pelo navegador

Para simular, use o `device_token` recebido ao criar ou regenerar um dispositivo.

---

# 4. Adminer / PostgreSQL pelo navegador

O **pgAdmin** também está disponível em [http://localhost:5050](http://localhost:5050).
Use o email e a senha `PGADMIN_DEFAULT_*` do `.env`. A conexão com o PostgreSQL
já vem cadastrada e pede `DB_PASSWORD` ao conectar.

Veja a [adaptação do banco e o guia visual do pgAdmin](docs/BANCO_E_PGADMIN.md).

Abra:

```text
http://localhost:8080
```

Use:

```text
Sistema: PostgreSQL
Servidor: postgres
Usuário: ambulancias
Senha: ambulancias123
Base: ambulancias
```

Tabelas principais:

- `usuarios`
- `dispositivos`
- `localizacoes`

---

# 5. API

Base URL:

```text
http://localhost:8000/api
```

## Públicas

```text
GET  /api/health
POST /api/login
POST /api/localizacoes
```

`POST /api/localizacoes` usa:

```text
X-Device-Token: TOKEN_DO_TABLET
```

## Usuário autenticado

```text
GET  /api/me
POST /api/logout
GET  /api/painel
GET  /api/dispositivos
GET  /api/dispositivos/{id}
GET  /api/dispositivos/{id}/localizacoes
```

Cabeçalho:

```text
Authorization: Bearer TOKEN_DO_USUARIO
```

## Somente administrador

```text
GET    /api/usuarios
POST   /api/usuarios
GET    /api/usuarios/{id}
PUT    /api/usuarios/{id}
DELETE /api/usuarios/{id}

POST   /api/dispositivos
PUT    /api/dispositivos/{id}
DELETE /api/dispositivos/{id}
POST   /api/dispositivos/{id}/gerar-token
```

---

# 6. Postman

Arquivos:

```text
postman/Ambulancias-MVP.postman_collection.json
postman/Ambulancias-MVP-Local.postman_environment.json
```

Importe os dois no Postman e selecione o environment **Ambulancias MVP - Local**.

Fluxo recomendado:

```text
Health
  -> Login
  -> Criar funcionário
  -> Criar dispositivo
  -> Enviar GPS
  -> Consultar histórico
  -> Consultar painel
```

A collection salva automaticamente os tokens e IDs usados nos próximos requests.

---

# 7. Estrutura simplificada

```text
ambulancias-api/
├── app/
│   ├── Http/Controllers/
│   ├── Http/Middleware/
│   └── Models/
├── database/
│   ├── migrations/
│   └── seeders/
├── public/
│   └── app/
│       ├── index.html
│       ├── styles.css
│       └── app.js
├── routes/
│   ├── api.php
│   └── web.php
├── postman/
│   ├── Ambulancias-MVP.postman_collection.json
│   ├── Ambulancias-MVP-Local.postman_environment.json
│   └── README.md
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Observação de segurança

`admin123` e as credenciais do PostgreSQL são apenas para desenvolvimento local. Antes de publicar o sistema, troque todas as senhas e segredos.

## Integração com o aplicativo Expo

Esta versão da API inclui um fluxo específico para o aplicativo do motorista, mantendo as rotas existentes do painel web.

### Rotas do app

```text
POST /api/login
GET  /api/mobile/contexto
POST /api/mobile/localizacoes
POST /api/mobile/confirmar-saida
POST /api/logout
```

O motorista usa um usuário do tipo `funcionario`. A ambulância é identificada pelo `dispositivo` ativo cujo `usuario_id` aponta para esse funcionário.

O app não precisa receber nem armazenar o `device_token` administrativo. Depois do login, o Bearer token identifica o motorista e a API resolve automaticamente qual ambulância receberá o ponto de GPS.

### Teste rápido

Depois de subir a API e criar/vincular um funcionário a uma ambulância:

```bash
curl -X POST http://localhost:8000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"usuario01@ambulancias.local","senha":"Teste123!"}'
```

Use o token retornado em:

```bash
curl http://localhost:8000/api/mobile/contexto \
  -H 'Authorization: Bearer SEU_TOKEN'
```

E para simular uma posição do aplicativo:

```bash
curl -X POST http://localhost:8000/api/mobile/localizacoes \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"latitude":-15.793889,"longitude":-47.882778,"velocidade":42,"precisao_gps":8}'
```
