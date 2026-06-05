#!/usr/bin/env python3
"""Simple preview webhook receiver.

Usage: run this on the preview host (behind a reverse proxy or firewall) and configure
GitHub Actions `PREVIEW_WEBHOOK_URL` to point to its endpoint.

It expects a POST with JSON payload and an optional `Authorization: Bearer <token>` header.
"""
from flask import Flask, request, jsonify
import os
import subprocess
import hmac
import hashlib

app = Flask(__name__)

# Optional token to verify incoming requests
WEBHOOK_TOKEN = os.environ.get("PREVIEW_TOKEN")


def run_cmd(cmd, cwd=None):
    print("Running:", cmd)
    res = subprocess.run(cmd, shell=True, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return res.returncode, res.stdout.decode()


@app.route("/preview-webhook", methods=["POST"])  # change path if needed
def preview_webhook():
    if WEBHOOK_TOKEN:
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer ") or auth.split(None, 1)[1].strip() != WEBHOOK_TOKEN:
            return jsonify({"error": "unauthorized"}), 401

    payload = request.get_json(silent=True) or {}
    # Minimal validation
    repo = payload.get("repository")
    ref = payload.get("ref")
    sha = payload.get("sha")
    print("Webhook received:", repo, ref, sha)

    # Replace these with real paths on the preview host
    APP_DIR = os.environ.get("APP_DIR", "/var/www/astra")

    # Pull latest
    code, out = run_cmd("git fetch origin main && git reset --hard origin/main", cwd=APP_DIR)
    print(out)

    # Build frontend
    code, out = run_cmd("/usr/bin/env yarn install --frozen-lockfile || /usr/bin/env npm ci", cwd=os.path.join(APP_DIR, "frontend"))
    print(out)
    code, out = run_cmd("/usr/bin/env yarn build || /usr/bin/env npm run build", cwd=os.path.join(APP_DIR, "frontend"))
    print(out)

    # Optional backend restart
    restart_cmd = os.environ.get("PREVIEW_RESTART_CMD")
    if restart_cmd:
        code, out = run_cmd(restart_cmd, cwd=APP_DIR)
        print(out)

    return jsonify({"status": "ok"})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
