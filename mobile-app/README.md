# Ambulância Monitoramento — Expo

Aplicativo móvel do motorista, adaptado a partir da arquitetura do projeto Expo base e conectado ao projeto Laravel `ambulancias-api`.

## Ambiente de desenvolvimento com Docker

O ambiente Node/npm/Expo pode rodar dentro do Docker enquanto o aplicativo continua sendo executado normalmente fora do container, no celular, emulador ou development build.

Versões fixadas para este projeto:

- Node.js `22.23.1`
- npm `10.9.8`
- Expo SDK `57`

Arquivos usados:

- `Dockerfile`: imagem com Node, npm, dependências e suporte ao tunnel do Expo.
- `docker-compose.yml`: sobe o Metro/Expo e mantém o código montado para hot reload.
- `.dockerignore`: reduz o contexto enviado ao Docker.
- `.nvmrc`: registra a mesma versão do Node para quem optar por executar fora do Docker.

### Subir o Expo pelo Docker

Na pasta `mobile-app`:

```bash
docker compose up --build
```

O container executa:

```bash
npx expo start --tunnel
```

Use o QR code exibido no terminal para abrir o aplicativo no celular. O modo `--tunnel` evita que o aparelho tente acessar diretamente o IP interno do container Docker.

Para encerrar:

```bash
docker compose down
```

Para executar novamente sem reconstruir a imagem:

```bash
docker compose up
```

Sempre que `package.json` ou `package-lock.json` mudar, reconstrua a imagem:

```bash
docker compose up --build
```

Para conferir as versões usadas dentro do container:

```bash
docker compose run --rm mobile node --version
docker compose run --rm mobile npm --version
```

O volume `node_modules` mantém as dependências Linux do container separadas das dependências eventualmente instaladas no computador host.

## O que o aplicativo faz

- Login com o mesmo funcionário cadastrado no painel web.
- Mostra apenas os dados necessários: motorista, ambulância e status (`Online`, `Sem comunicação`, `Offline`).
- Envia GPS para `POST /api/mobile/localizacoes`.
- Mantém uma tarefa de localização em segundo plano enquanto a sessão estiver ativa.
- No Android, usa foreground service com notificação persistente para aumentar a confiabilidade do rastreamento.
- O botão **Sair da conta** exige novamente acesso e senha antes de interromper o GPS e invalidar a sessão.
- O token de autenticação fica no `expo-secure-store`, não em texto aberto no código.

No navegador, usado para testar a interface, o token fica apenas em memória. Recarregar ou fechar a página exige novo login. Android e iOS continuam usando o SecureStore.

## 1. Configurar a API

Use a versão ajustada de `ambulancias-api`, que contém estas rotas novas:

- `GET /api/mobile/contexto`
- `POST /api/mobile/localizacoes`
- `POST /api/mobile/confirmar-saida`

O motorista precisa ser um usuário do tipo `funcionario` e ter uma ambulância/dispositivo ativo vinculado ao seu `usuario_id`.

## 2. Configurar o endereço da API

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

Em celular físico, troque `192.168.0.10` pelo IP do computador que executa o Docker/Laravel. Não use `localhost` no celular.

Exemplo:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.25:8000
```

Android Emulator pode acessar o host por:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
```

### Web e celular ao mesmo tempo

`EXPO_PUBLIC_API_URL` define a API para Android/iOS (IP do computador na mesma rede Wi-Fi).
Na web, o cliente usa automaticamente o protocolo e o host da página na porta `8000`:
abrindo pelo localhost, acessa a API no localhost; abrindo pelo IP, acessa a API nesse IP.
Para uma API hospedada ou porta diferente, preencha `EXPO_PUBLIC_WEB_API_URL` com sua URL completa.
Após alterar o `.env`, reinicie o Expo e recarregue o aplicativo.

## 3. Instalar dependências sem Docker

Se optar por executar o Expo diretamente no computador:

```bash
npm install
```

Este projeto usa Expo SDK 57 e adiciona:

- `expo-location`
- `expo-task-manager`
- `expo-secure-store`

Mantenha o `package-lock.json` no projeto. Para reinstalar exatamente as versões validadas, use `npm ci`. Não atualize apenas `expo` ou `expo-router` isoladamente: as bibliotecas nativas precisam acompanhar o SDK. Veja o [guia oficial de atualização do Expo](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).

## 4. Testar a interface sem Docker

```bash
npm run start
```

Após atualizar o SDK, inicie com `npx expo start --clear` e abra o novo QR code no Expo Go compatível com SDK 57.

A interface pode ser aberta no Expo, mas o rastreamento em segundo plano **não deve ser validado pelo Expo Go**. Para testar a funcionalidade real de background, use uma development build ou APK.

## 5. Gerar Android para teste real

Uma opção com EAS:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --profile development --platform android
```

Depois instale a development build no aparelho e execute o bundler com:

```bash
npx expo start --dev-client
```

## Limitação importante do sistema operacional

O app continua rastreando em segundo plano enquanto a sessão está ativa, dentro das regras do Android/iOS. Porém, se o usuário **forçar a parada** do aplicativo nas configurações do Android, o próprio sistema operacional interrompe os processos e a localização não pode continuar até o app ser aberto novamente. Em alguns fabricantes, remover o app da lista de recentes também pode encerrar o serviço.

## Fluxo do código

```text
src/app/login.tsx
  -> LoginScreen
  -> AmbulanceSessionProvider.login()
  -> POST /api/login
  -> GET /api/mobile/contexto
  -> SecureStore
  -> requestTrackingPermissions()
  -> startLocationUpdatesAsync()

background-location-task.ts
  -> recebe GPS do Expo
  -> lê Bearer token do SecureStore
  -> POST /api/mobile/localizacoes
  -> Laravel atualiza localizacoes + dispositivos
  -> painel web lê a nova posição

HomeScreen
  -> atualiza /api/mobile/contexto a cada 10 s
  -> mostra motorista, ambulância e status
  -> Sair da conta
  -> POST /api/mobile/confirmar-saida
  -> POST /api/logout
  -> stopLocationUpdatesAsync()
  -> apaga token local
```
