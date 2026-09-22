#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${HYPERDATA_ROOT:-/home/deploy/hyperdata}"
SOURCE_ROOT="$ROOT/src"
BACKEND="$SOURCE_ROOT/hyperdata-backend"
FRONTEND="$SOURCE_ROOT/hyperdata-frontend"
NOTIFICATION="$SOURCE_ROOT/hyperdata-notification-service"
COMPOSE_FILE="$BACKEND/deploy/docker-compose.production.yml"
ENV_FILE="$ROOT/secrets/compose.env"
SERVICE="${1:-all}"

if [[ "$(id -un)" != "deploy" ]]; then
  echo "Run this script as deploy, not as root." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing $COMPOSE_FILE" >&2
  exit 1
fi

mkdir -p "$ROOT/run"
exec 9>"$ROOT/run/deploy.lock"
flock -n 9 || { echo "Another Hyperdata deployment is running." >&2; exit 1; }

git_update() {
  local repository="$1"
  [[ -d "$repository/.git" ]] || {
    echo "Missing Git repository: $repository" >&2
    exit 1
  }
  git -C "$repository" diff --quiet || {
    echo "Working tree is dirty: $repository" >&2
    exit 1
  }
  git -C "$repository" diff --cached --quiet || {
    echo "Index is dirty: $repository" >&2
    exit 1
  }
  git -C "$repository" fetch --no-tags origin main
  git -C "$repository" checkout --quiet main
  git -C "$repository" pull --ff-only origin main
}

git_update "$BACKEND"
git_update "$FRONTEND"
git_update "$NOTIFICATION"

if ! docker network inspect hyperdata_internal >/dev/null 2>&1; then
  docker network create --driver bridge hyperdata_internal >/dev/null
fi

COMPOSE=(docker compose --project-name hyperdata --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
"${COMPOSE[@]}" config --quiet

case "$SERVICE" in
  backend)
    "${COMPOSE[@]}" up -d --build backend notification frontend
    ;;
  frontend)
    "${COMPOSE[@]}" up -d --build frontend
    ;;
  notification)
    "${COMPOSE[@]}" up -d --build notification
    ;;
  all)
    "${COMPOSE[@]}" up -d --build
    ;;
  *)
    echo "Usage: $0 {backend|frontend|notification|all}" >&2
    exit 2
    ;;
esac

for service in backend notification frontend; do
  container=$("${COMPOSE[@]}" ps -q "$service")
  for attempt in $(seq 1 60); do
    status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}starting{{end}}' "$container")
    if [[ "$status" == "healthy" ]]; then
      break
    fi
    if [[ "$attempt" == 60 ]]; then
      echo "$service did not become healthy" >&2
      "${COMPOSE[@]}" logs --tail=100 "$service" >&2 || true
      exit 1
    fi
    sleep 5
  done
done

"${COMPOSE[@]}" ps
echo "Backend:       $(git -C "$BACKEND" rev-parse --short HEAD)"
echo "Frontend:      $(git -C "$FRONTEND" rev-parse --short HEAD)"
echo "Notification:  $(git -C "$NOTIFICATION" rev-parse --short HEAD)"
