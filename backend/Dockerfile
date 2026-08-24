# PHP 8.2 CLI
FROM php:8.2-cli

# Instalar extensiones necesarias para MySQL/PDO
RUN docker-php-ext-install pdo pdo_mysql

# Directorio de trabajo
WORKDIR /var/www/html

# Instalar Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Copiar primero los archivos de Composer para aprovechar la caché de Docker
COPY composer.json composer.lock* ./

# Instalar dependencias de producción
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader

# Copiar el resto del backend
COPY . .

# Crear directorios necesarios para la aplicación
RUN mkdir -p \
    storage/adjuntos \
    public/uploads \
    var/cache \
    logs

# Dar permisos de escritura a los directorios que utiliza la aplicación
RUN chmod -R 775 storage var logs public/uploads

# Render utilizará el puerto definido en $PORT
EXPOSE 10000

# Iniciar el servidor PHP con Slim como front controller
CMD ["sh", "-c", "php -S 0.0.0.0:${PORT:-10000} -t public public/index.php"]