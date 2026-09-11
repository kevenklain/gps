# Lógica da API — explicada de forma simples

## Base PostgreSQL e administração visual

A arquitetura do ZIP de referência foi adaptada por migration, preservando os
cadastros e o histórico existentes. O pgAdmin se conecta ao mesmo PostgreSQL da
API por `postgres:5432`; o navegador acessa sua interface em `localhost:5050`.
Consulte [Banco e pgAdmin](BANCO_E_PGADMIN.md) para o mapeamento das práticas,
restrições, volumes, credenciais e instruções de uso visual.

## Observação sobre o ZIP analisado

O arquivo `php-habit-tracker-api-.zip` enviado continha somente diretórios vazios (por exemplo `app/`, `routes/`, `database/`) e nenhum arquivo PHP, `composer.json`, rota ou migration. Portanto não foi possível copiar ou auditar a lógica interna daquela API.

Este projeto foi construído do zero com uma organização pequena e didática, seguindo o fluxo solicitado para ambulâncias.

---

## As três tabelas de negócio

### `usuarios`

Representa quem entra no painel.

- `admin`: pode ver toda a frota e cadastrar usuários/dispositivos.
- `funcionario`: vê somente os dispositivos vinculados ao seu `id`.

A senha nunca é gravada em texto puro: usamos `Hash::make()`.

O login gera um token aleatório. O token aberto volta para o cliente; no PostgreSQL fica somente `SHA-256(token)`.

### `dispositivos`

Representa o tablet/celular instalado na ambulância e também guarda alguns dados do veículo.

Essa tabela guarda a **última posição conhecida**:

- latitude
- longitude
- velocidade
- precisão
- bateria
- última comunicação

Isso faz o painel carregar rapidamente sem procurar o último ponto dentro de milhares de registros históricos.

### `localizacoes`

É o histórico GPS.

Cada chamada do tablet para `POST /api/localizacoes` cria UMA nova linha nessa tabela.

---

## Fluxo completo

```text
ADMIN
  |
  | faz login
  v
POST /api/login
  |
  | recebe Bearer Token
  v
cadastra funcionário e dispositivo
  |
  | POST /api/dispositivos
  v
recebe DEVICE TOKEN
  |
  v
TABLET / EXPO
  |
  | X-Device-Token
  | latitude/longitude
  v
POST /api/localizacoes
  |
  +--> INSERT em localizacoes (histórico)
  |
  +--> UPDATE em dispositivos (posição atual)
  |
  v
PAINEL
GET /api/painel
```

---

## Por que há dois tokens?

### Token de usuário

Usado pelo painel:

```http
Authorization: Bearer TOKEN_DO_USUARIO
```

### Token do dispositivo

Usado pelo aplicativo Expo:

```http
X-Device-Token: TOKEN_DO_TABLET
```

Isso evita colocar email/senha de um funcionário dentro do tablet somente para enviar GPS.

---

## Status online/offline

Não existe uma coluna `status` fixa no banco.

A API calcula usando `ultima_comunicacao`:

- até 60 segundos: `online`
- até 5 minutos: `sem_comunicacao`
- acima de 5 minutos: `offline`

Isso é mais confiável do que gravar `status = online`, porque um tablet que desligou não consegue enviar uma atualização dizendo que ficou offline.

## Arquitetura e responsabilidades

| Camada | Arquivos | Responsabilidade |
| --- | --- | --- |
| Tela | `public/app/index.html`, `styles.css` | Estrutura dos formulários, menu, mapa e apresentação visual. |
| Comunicação do navegador | `public/app/app.js` | Escutar eventos, chamar `fetch`, interpretar JSON e atualizar a tela. |
| Rotas | `routes/api.php` | Associar método HTTP e URL ao controller e aos middlewares. |
| Autenticação | `AutenticarUsuarioPorToken` | Validar o hash do Bearer token e identificar o usuário. |
| Autorização | `ApenasAdministrador` e filtros dos controllers | Restringir operações administrativas e a frota visível. |
| Controllers | `app/Http/Controllers` | Receber requisições, validar entradas e devolver JSON. |
| Service de simulação | `app/Services/SimulacaoBrasilia.php` | Calcular posições fictícias e coordenar a gravação da simulação. |
| Models | `app/Models` | Mapear tabelas, converter tipos, definir relacionamentos e executar operações Eloquent. |
| Banco | PostgreSQL, configurado em `config/database.php` | Persistir cadastros, tokens em hash e histórico GPS. |
| Migrations e seeders | `database` | Criar a estrutura do banco e executar cargas explícitas de dados. |

O projeto usa controllers e models diretamente nos CRUDs existentes. A simulação
tem um service porque a mesma regra é chamada pela API e pelo seeder. Assim,
`SimulacaoController` conhece HTTP, enquanto `SimulacaoBrasilia` pode ser chamado
pelo Artisan sem criar uma requisição artificial.

Além das tabelas de negócio, `sessions` armazena sessões das rotas web do Laravel
e `migrations` registra quais migrations já foram executadas. A autenticação da
API usa os tokens de usuário e de dispositivo descritos acima.

## Comunicação do mapa: consulta de posições

```text
Usuário abre Mapa / seleciona uma ambulância / clica em Atualizar
  -> app.js: loadFleetMap()
  -> api('/dispositivos') envia GET /api/dispositivos + Bearer token
  -> routes/api.php
  -> AutenticarUsuarioPorToken identifica o usuário
  -> DispositivoController::index aplica o filtro de acesso
  -> Dispositivo consulta dispositivos e o relacionamento usuario no PostgreSQL
  <- JSON: { sucesso: true, dados: [...] }
  <- app.js seleciona todas ou uma dentre as ambulâncias autorizadas
  -> Leaflet desenha os marcadores e os detalhes
```

O navegador recebe as coordenadas da nossa API. Leaflet é a biblioteca de desenho;
as imagens cartográficas são carregadas separadamente do OpenStreetMap. Não há
chave de mapa configurada. Essa parte cartográfica precisa de internet.

A lista **Exibir no mapa** filtra a apresentação. Ela não modifica cadastros e
não substitui a autorização no servidor. Selecionar uma ambulância também não
restringe a simulação: as dez ambulâncias de exemplo continuam participando.

## Comunicação da simulação: gravação e leitura

```text
Administrador clica em Iniciar simulação em Brasília
  -> toggleMapSimulation() ativa o estado da simulação no navegador
  -> tickFleetMap()
  -> POST /api/simulacao/brasilia + Bearer token (sem coordenadas no corpo)
  -> usuario.token autentica; admin autoriza
  -> SimulacaoController::store
  -> SimulacaoBrasilia::atualizar
      -> inicia transação
      -> busca e bloqueia os dez identificadores DEMO-TABLET-01 a 10
      -> ignora dispositivo inexistente ou atualizado há menos de 4 segundos
      -> calcula coordenadas fictícias usando horário e centro do circuito
      -> Localizacao::create: INSERT no histórico
      -> Dispositivo::update: UPDATE da posição, comunicação e quilometragem
      -> confirma a transação (ou reverte tudo se houver erro)
  <- JSON: sucesso, atualizados e mensagem
  -> loadFleetMap() consulta GET /api/dispositivos
  -> redesenha os marcadores a partir dos dados persistidos
  -> agenda o próximo ciclo para 5 segundos depois da conclusão
```

Esse mecanismo é **polling**, com chamadas HTTP periódicas, sem WebSocket nem
worker permanente. O intervalo é de pelo menos 5 segundos, acrescido do tempo
das requisições. Com a simulação desligada, o mapa continua consultando posições,
mas não faz o POST de simulação. Ao sair do mapa, sair da conta ou fechar a aba,
os novos envios dessa tela cessam. Uma chamada já enviada pode terminar.

Os trajetos são circuitos matemáticos fictícios em Brasília e não seguem uma
malha viária. A velocidade e a bateria são valores de demonstração. A quilometragem
é incrementada com limite de 10 segundos por passo para não somar todo o período
em que a simulação ficou parada. Nomes, vínculos e tokens são preservados; os
dispositivos de exemplo processados são ativados.

`BrasiliaSeeder` chama o mesmo service diretamente pelo Artisan, sem HTTP.
Ele executa um passo e termina. Não mantém as ambulâncias em movimento sozinho.

## Consistência de horário e verificação

A conexão PostgreSQL usa `APP_TIMEZONE`, assim como o Laravel. Isso é necessário
porque o Eloquent envia datas sem offset ao gravar: o banco precisa interpretá-las
no mesmo fuso usado pela aplicação. A configuração não corrige retroativamente
horários de registros antigos.

`tests/simulacao_smoke.php` verifica as dez posições em Brasília, movimento,
status online, aumento de quilometragem, histórico e proteção contra duplicação.
O teste usa uma transação externa e reverte suas alterações ao terminar.

---

## Aplicativo móvel Expo (motorista)

O aplicativo móvel usa o mesmo cadastro de `usuarios` e `dispositivos` do painel web, sem precisar conhecer o token interno do dispositivo.

### Login e carregamento da ambulância

1. Tela de login envia `POST /api/login` com `email` e `senha`.
2. `AuthController` valida a senha e devolve um Bearer token.
3. O aplicativo salva o token no armazenamento seguro do aparelho.
4. O app chama `GET /api/mobile/contexto`.
5. `AutenticarUsuarioPorToken` identifica o motorista.
6. `MobileController` busca o primeiro `dispositivo` ativo vinculado ao `usuario_id` daquele motorista.
7. A tela mostra nome do motorista, nome da ambulância e status calculado pela última comunicação.

### Envio de localização

1. `expo-location` coleta GPS em primeiro e segundo plano.
2. A tarefa de background envia `POST /api/mobile/localizacoes` com Bearer token.
3. `MobileController` descobre a ambulância vinculada ao motorista.
4. `RegistrarLocalizacao` grava um ponto em `localizacoes` e atualiza latitude, longitude, velocidade, precisão e `ultima_comunicacao` em `dispositivos`.
5. O painel web continua consultando `dispositivos`, então passa a enxergar a nova posição automaticamente.

### Saída protegida

1. O motorista toca em **Sair da conta**.
2. O aplicativo abre uma confirmação pedindo novamente acesso e senha.
3. `POST /api/mobile/confirmar-saida` valida que as credenciais pertencem ao usuário atualmente autenticado.
4. Somente após a confirmação o app para a tarefa de localização, chama `POST /api/logout` e remove o token local.

> Observação de plataforma: o Android permite rastreamento em segundo plano por serviço de localização. Um *force stop* feito nas configurações do sistema operacional sempre interrompe os processos do aplicativo até ele ser aberto novamente; nenhum aplicativo comum consegue ignorar esse bloqueio do Android.
