FROM node:22.23.1-bookworm-slim

WORKDIR /app

# Mantem o ambiente de desenvolvimento alinhado ao Expo SDK 57.
RUN npm install --global npm@10.9.8 @expo/ngrok@4.1.3

# Copiamos primeiro apenas os manifests para aproveitar o cache do Docker.
COPY package.json package-lock.json ./

# Instala exatamente as dependencias registradas no package-lock.json.
RUN npm ci

# O restante do codigo sera sobrescrito pelo bind mount no desenvolvimento,
# mas manter a copia aqui permite que a imagem tambem funcione isoladamente.
COPY . .

EXPOSE 8081

# O tunnel evita que o celular tente acessar o IP interno do container.
CMD ["npx", "expo", "start", "--tunnel"]
