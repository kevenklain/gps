#!/usr/bin/env sh
set -e

cd /var/www

# Em desenvolvimento, o bind mount pode esconder o vendor criado na imagem.
# Se isso acontecer, instalamos as dependencias automaticamente no volume vendor_data.
if [ ! -f vendor/autoload.php ]; then
    echo "Dependencias PHP nao encontradas. Executando composer install..."
    composer install --no-dev --no-interaction --prefer-dist --no-scripts --optimize-autoloader
fi

if [ ! -f .env ]; then
    cp .env.example .env
fi

mkdir -p \
    storage/logs \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    bootstrap/cache

chmod -R 777 storage bootstrap/cache || true

# Gera APP_KEY apenas se ainda nao existir.
if ! grep -Eq '^APP_KEY=base64:.+' .env; then
    php artisan key:generate --force
fi

echo "Aguardando PostgreSQL em ${DB_HOST:-postgres}:${DB_PORT:-5432}..."
until pg_isready \
    -h "${DB_HOST:-postgres}" \
    -p "${DB_PORT:-5432}" \
    -U "${DB_USERNAME:-ambulancias}" \
    -d "${DB_DATABASE:-ambulancias}" >/dev/null 2>&1; do
    sleep 2
done

echo "PostgreSQL disponivel. Executando migrations..."
php artisan migrate --force

# Idempotente: updateOrCreate evita duplicar o admin.
echo "Garantindo usuario administrador inicial..."
php artisan db:seed --force

echo "API pronta em http://0.0.0.0:8000"
exec php artisan serve --host=0.0.0.0 --port=8000
