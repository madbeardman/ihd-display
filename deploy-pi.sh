#!/bin/bash
set -e

PI_HOST="home-ihd"
PI_APP_DIR="~/ihd-display"
SERVICE_NAME="ihd-display"

echo "==> Syncing ihd-display to Pi..."
rsync -avz \
  --delete \
  --exclude .git \
  --exclude node_modules \
  --exclude deploy-pi.sh \
  ./ "${PI_HOST}:${PI_APP_DIR}"

echo "==> Restarting ihd-display service..."
ssh "${PI_HOST}" "
  sudo systemctl restart ${SERVICE_NAME}
"

echo "==> Checking service status..."
ssh "${PI_HOST}" "
  sudo systemctl status ${SERVICE_NAME} --no-pager
"

echo "==> Done."