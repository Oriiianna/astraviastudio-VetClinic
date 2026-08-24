FROM php:8.2-apache

# 1. Habilitar mod_rewrite para Slim
RUN a2enmod rewrite

# 2. Instalar librerías del sistema y extensiones de PHP requeridas por tu proyecto
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    libzip-dev \
    libpq-dev \
    && docker-php-ext-install pdo pdo_mysql zip

# 3. Instalar Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# 4. Definir directorio de trabajo y copiar el código
WORKDIR /var/www/html
COPY . .

# 5. Configurar Apache para Slim 4 (DocumentRoot apuntando a public/)
ENV APACHE_DOCUMENT_ROOT /var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/conf-available/*.conf

# 6. Instalar dependencias con Composer (agregando --ignore-platform-reqs por si falta alguna extensión menor)
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --ignore-platform-reqs

EXPOSE 80