#!/usr/bin/env bash
set -euo pipefail

# Usage: run on preview host as root or with sudo
# This installs the webhook server into /opt/astra, creates a venv, installs deps,
# creates a systemd service, and starts it.

INSTALL_DIR=${1:-/opt/astra}
SERVICE_NAME=${2:-astra-webhook}
USER=${3:-www-data}

echo "Installing Astra preview webhook to ${INSTALL_DIR}"

mkdir -p "$INSTALL_DIR"
chown -R "$USER":"$USER" "$INSTALL_DIR" || true

echo "Copying repo files into ${INSTALL_DIR} (assumes you ran this inside repo)"
rsync -a --exclude .git ./ "$INSTALL_DIR/"

echo "Creating venv and installing Python deps"
python3 -m venv "$INSTALL_DIR/venv"
source "$INSTALL_DIR/venv/bin/activate"
pip install --upgrade pip
pip install flask

echo "Installing systemd service"
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}.service"
if [ -f "$SERVICE_PATH" ]; then
    echo "Backing up existing service to ${SERVICE_PATH}.bak"
    mv "$SERVICE_PATH" "${SERVICE_PATH}.bak"
fi
cp "$INSTALL_DIR/deploy/webhook.service" "$SERVICE_PATH"
sed -i "s|WorkingDirectory=.*|WorkingDirectory=${INSTALL_DIR}|" "$SERVICE_PATH"
sed -i "s|ExecStart=.*|ExecStart=${INSTALL_DIR}/venv/bin/python ${INSTALL_DIR}/deploy/webhook_server.py|" "$SERVICE_PATH"

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.service"

echo "Service ${SERVICE_NAME} installed and started. Check logs with: sudo journalctl -u ${SERVICE_NAME} -f"
