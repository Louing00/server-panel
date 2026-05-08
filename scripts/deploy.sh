#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="server-panel"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
COMPOSE_CMD=()

log() {
  printf '\n[%s] %s\n' "$APP_NAME" "$*"
}

die() {
  printf '\n[%s] ERROR: %s\n' "$APP_NAME" "$*" >&2
  exit 1
}

rand_base64() {
  openssl rand -base64 "$1" | tr -d '\n'
}

rand_hex() {
  openssl rand -hex "$1" | tr -d '\n'
}

ensure_command() {
  command -v "$1" >/dev/null 2>&1
}

install_docker_if_needed() {
  if ensure_command docker && docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
    return
  fi

  if ensure_command docker-compose; then
    COMPOSE_CMD=(docker-compose)
    return
  fi

  log "Docker 或 Docker Compose 未检测到，尝试安装 Docker Engine"
  if [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    source /etc/os-release
  else
    die "无法识别系统。请先安装 Docker Engine 和 Docker Compose Plugin 后重试。"
  fi

  if [[ "${ID:-}" != "ubuntu" && "${ID:-}" != "debian" ]]; then
    die "当前脚本自动安装仅支持 Ubuntu/Debian。请先安装 Docker 后重试。"
  fi

  if [[ "${EUID}" -ne 0 ]]; then
    die "安装 Docker 需要 root 权限。请用 sudo 运行：sudo bash scripts/deploy.sh"
  fi

  apt-get update
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  COMPOSE_CMD=(docker compose)
}

ensure_env() {
  if [[ -f "${ENV_FILE}" ]]; then
    log ".env 已存在，沿用当前配置"
    return
  fi

  log "生成生产环境 .env"
  cat > "${ENV_FILE}" <<EOF
APP_PORT=${APP_PORT:-3000}
COMPOSE_PROJECT_NAME=server-panel
POSTGRES_USER=panel
POSTGRES_PASSWORD=$(rand_hex 24)
POSTGRES_DB=panel
JWT_SECRET=$(rand_base64 48)
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
APP_MASTER_KEY=$(rand_base64 32)
ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-$(rand_base64 18)}
SSH_CONNECT_TIMEOUT_MS=10000
SSH_IDLE_TIMEOUT_MS=1800000
MAX_UPLOAD_SIZE_MB=200
EOF
  chmod 600 "${ENV_FILE}"
  log "已生成 .env；默认管理员密码见文件中的 ADMIN_PASSWORD"
}

load_env() {
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
}

compose() {
  "${COMPOSE_CMD[@]}" --env-file "${ENV_FILE}" -p "${COMPOSE_PROJECT_NAME:-server-panel}" "$@"
}

main() {
  cd "${ROOT_DIR}"

  ensure_command openssl || die "缺少 openssl，请先安装后重试"
  install_docker_if_needed
  ensure_env
  load_env

  log "拉取/构建镜像并启动服务"
  compose up -d --build

  log "等待数据库就绪"
  for _ in $(seq 1 60); do
    if compose exec -T postgres pg_isready -U "${POSTGRES_USER:-panel}" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done

  log "执行数据库迁移"
  compose exec -T app corepack pnpm --filter @server-panel/server prisma migrate deploy

  log "初始化默认管理员"
  compose exec -T app corepack pnpm --filter @server-panel/server seed

  log "部署完成"
  compose ps
  printf '\n访问地址: http://<服务器IP>:%s\n' "$(grep '^APP_PORT=' "${ENV_FILE}" | cut -d= -f2)"
  printf '管理员用户: %s\n' "$(grep '^ADMIN_USERNAME=' "${ENV_FILE}" | cut -d= -f2)"
  printf '管理员密码: 请查看服务器上的 %s\n' "${ENV_FILE}"
}

main "$@"
