#!/usr/bin/env bash
set -Eeuo pipefail

DOMAIN="${DOMAIN:-${1:-}}"
APP_PORT="${APP_PORT:-3100}"
ENABLE_CERTBOT="${ENABLE_CERTBOT:-0}"

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

[[ -n "${DOMAIN}" ]] || die "请提供域名：sudo DOMAIN=panel.example.com bash scripts/setup-nginx.sh"

if [[ "${EUID}" -ne 0 ]]; then
  die "配置 Nginx 需要 root 权限，请用 sudo 运行"
fi

if [[ -f /etc/os-release ]]; then
  # shellcheck disable=SC1091
  source /etc/os-release
else
  die "无法识别系统。脚本自动安装仅支持 Ubuntu/Debian。"
fi

if [[ "${ID:-}" != "ubuntu" && "${ID:-}" != "debian" ]]; then
  die "当前脚本自动安装仅支持 Ubuntu/Debian，请手动参考 deploy/nginx/server-panel.conf 配置。"
fi

apt-get update
apt-get install -y nginx

cat > /etc/nginx/sites-available/server-panel.conf <<EOF
server {
  listen 80;
  server_name ${DOMAIN};

  client_max_body_size 200m;

  location / {
    proxy_pass http://127.0.0.1:${APP_PORT};
    proxy_http_version 1.1;

    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;

    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";

    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
  }
}
EOF

ln -sfn /etc/nginx/sites-available/server-panel.conf /etc/nginx/sites-enabled/server-panel.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

if [[ "${ENABLE_CERTBOT}" == "1" ]]; then
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "${DOMAIN}"
fi

printf '\nNginx 反向代理已配置完成：http://%s\n' "${DOMAIN}"
if [[ "${ENABLE_CERTBOT}" != "1" ]]; then
  printf '如需自动 HTTPS，可运行：sudo ENABLE_CERTBOT=1 DOMAIN=%s bash scripts/setup-nginx.sh\n' "${DOMAIN}"
fi
