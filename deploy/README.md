Preview webhook and SSH deploy instructions
=========================================

1) Using the webhook server (recommended if you don't want to share SSH keys)

- Copy `webhook_server.py` to your preview host (e.g., `/opt/astra/webhook_server.py`).
- Install Python and dependencies (prefer venv):

```bash
sudo apt update && sudo apt install -y python3-venv python3-pip git yarn
cd /opt/astra
python3 -m venv venv
source venv/bin/activate
pip install flask
```

- Configure environment variables (example):

```bash
export PREVIEW_TOKEN="your-secret-token"
export APP_DIR="/var/www/astra"
export PREVIEW_RESTART_CMD="sudo systemctl restart nginx"  # optional
```

- Run the server (behind systemd or reverse proxy in production):

```bash
source venv/bin/activate
python webhook_server.py
```

- Add the webhook URL to GitHub Actions secret `PREVIEW_WEBHOOK_URL`, and `PREVIEW_TOKEN` if used.

2) Using SSH deploy (alternative)

- Generate key locally (already created in workspace as `/app/gha_deploy_key` and `/app/gha_deploy_key.pub`).
- Copy the public key to the preview server's deploy user `~/.ssh/authorized_keys`.
- Add `DEPLOY_SSH_KEY` secret in GitHub (paste private key contents of `gha_deploy_key`). Also add `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`, and optionally `DEPLOY_RESTART_CMD`.

3) Security notes

- Use a dedicated deploy user with minimal rights.
- Protect webhook with a token and use HTTPS (reverse proxy / TLS).
