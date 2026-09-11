FROM php:8.4-cli

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        unzip \
        libpq-dev \
        postgresql-client \
    && docker-php-ext-install pdo_pgsql \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

COPY composer.json ./

# O lock nao esta incluido para manter o exemplo curto.
# O ^13.17 limita as dependencias a versao 13 do Laravel.
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --no-scripts \
    --optimize-autoloader

COPY . .

RUN mkdir -p \
      storage/logs \
      storage/framework/cache/data \
      storage/framework/sessions \
      storage/framework/views \
      bootstrap/cache \
    && chmod -R 777 storage bootstrap/cache \
    && chmod +x docker/entrypoint.sh artisan

EXPOSE 8000

ENTRYPOINT ["sh", "/var/www/docker/entrypoint.sh"]
