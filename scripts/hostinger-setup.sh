#!/usr/bin/env bash
set -euo pipefail

# JAAD CLOUD Hostinger VPS bootstrap helper.
# Run as root or with sudo on a fresh Ubuntu VPS.
#
# Required environment overrides:
#   DOMAIN=pos.example.com EMAIL=admin@example.com bash scripts/hostinger-setup.sh

APP_DIR="${APP_DIR:-/var/www/posjad}"
DOMAIN="${DOMAIN:-jaad-cloud.example.com}"
EMAIL="${EMAIL:-admin@example.com}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
API_PORT="${API_PORT:-8080}"

echo "==> Updating system packages"
apt-get update
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg git rsync nginx ufw build-essential

if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "==> Creating deploy user: $DEPLOY_USER"
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
  usermod -aG sudo "$DEPLOY_USER"
fi

echo "==> Installing Node.js 22.x"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
node --version
npm --version

echo "==> Installing PM2"
npm install -g pm2
pm2 startup systemd -u "$DEPLOY_USER" --hp "/home/$DEPLOY_USER" || true

echo "==> Installing Docker and Docker Compose plugin"
install -m 0755 -d /etc/apt/keyrings
rm -f /etc/apt/keyrings/docker.gpg
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker "$DEPLOY_USER" || true

echo "==> Preparing application directory"
mkdir -p "$APP_DIR"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

echo "==> Writing Nginx reverse proxy"
cat > /etc/nginx/sites-available/jaad-cloud <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 25m;

    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
        proxy_pass http://127.0.0.1:${FRONTEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX

ln -sfn /etc/nginx/sites-available/jaad-cloud /etc/nginx/sites-enabled/jaad-cloud
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "==> Configuring firewall"
ufw allow OpenSSH
ufw allow "Nginx Full"
ufw --force enable

echo "==> Optional TLS setup"
echo "Install certbot after DNS points to this VPS:"
echo "  apt-get install -y certbot python3-certbot-nginx"
echo "  certbot --nginx -d ${DOMAIN} --email ${EMAIL} --agree-tos --no-eff-email"

echo "==> Manual production secret files to create"
echo "  ${APP_DIR}/.env.production"
echo "  ${APP_DIR}/server/.env"
echo "Never commit these files. Configure GitHub Actions secrets: HOST, USERNAME, PORT, SSH_KEY."
