FROM php:8.3-apache

# Übersicht (index.php) und statische Projektstände (tests/<datum>/)
COPY index.php /var/www/html/
COPY tests /var/www/html/tests

RUN rm -f /var/www/html/tests/.dockerignore /var/www/html/tests/.gitignore \
    && chown -R www-data:www-data /var/www/html

EXPOSE 80
