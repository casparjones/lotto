FROM dunglas/frankenphp:1-php8.5-alpine

# Plain HTTP auf Port 80 (TLS übernimmt ggf. ein vorgeschalteter Proxy).
# Ohne diese Angabe würde FrankenPHP/Caddy auf localhost:443 mit eigenem Zertifikat lauschen.
ENV SERVER_NAME=":80"

# Übersicht (index.php), PHP-Info zum Testen und statische Projektstände (tests/<name>/)
# FrankenPHP liefert standardmäßig /app/public aus.
COPY Caddyfile /etc/frankenphp/Caddyfile
COPY index.php info.php /app/public/
COPY tests /app/public/tests

RUN rm -f /app/public/tests/.dockerignore /app/public/tests/.gitignore

EXPOSE 80
