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

Manual Quick Steps (copy-paste)
--------------------------------

1) Install public key on preview host (run from your machine):

```bash
# replace deploy_user and preview.example.com
scp gha_deploy_key.pub deploy_user@preview.example.com:~
ssh deploy_user@preview.example.com 'mkdir -p ~/.ssh && chmod 700 ~/.ssh'
ssh deploy_user@preview.example.com 'cat ~/gha_deploy_key.pub >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && rm ~/gha_deploy_key.pub'
```

2) Print the private key (do NOT commit this anywhere):

```bash
./deploy/print_private_key.sh
# or
cat /app/gha_deploy_key
```

3) Add GitHub Actions secrets using `gh` (recommended). Replace values as needed.

```bash
REPO=shubhamforemergent2-design/Astra_AI
gh secret set DEPLOY_SSH_KEY --body "$(cat /path/to/gha_deploy_key)" --repo $REPO
gh secret set DEPLOY_HOST --body "preview.example.com" --repo $REPO
gh secret set DEPLOY_USER --body "deploy_user" --repo $REPO
gh secret set DEPLOY_PATH --body "/var/www/astra" --repo $REPO
gh secret set DEPLOY_RESTART_CMD --body "sudo systemctl restart nginx" --repo $REPO
```

If you prefer webhook mode, instead set these secrets:

```bash
gh secret set PREVIEW_WEBHOOK_URL --body "https://preview.example.com/preview-webhook" --repo $REPO
gh secret set PREVIEW_TOKEN --body "your-secret-token" --repo $REPO
```

4) Trigger a test deploy (push an empty commit):

```bash
git commit --allow-empty -m "ci: test preview deploy" && git push origin main
```

5) Verify

- Check the Actions run on GitHub (Actions → the workflow). For SSH deploy, verify files in `DEPLOY_PATH` on the preview host. For webhook mode, check the webhook server logs:

```bash
sudo journalctl -u astra-webhook -f
# or if you run manually
tail -f /var/log/syslog
```

If anything fails, copy the Actions log and I'll help diagnose it.
