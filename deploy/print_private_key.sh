#!/usr/bin/env bash
set -euo pipefail

KEY_PATH="/app/gha_deploy_key"
if [ ! -f "$KEY_PATH" ]; then
  echo "Private key not found at $KEY_PATH"
  exit 1
fi

echo "----- BEGIN PRIVATE KEY (copy entire contents to GitHub secret DEPLOY_SSH_KEY) -----"
cat "$KEY_PATH"
echo "----- END PRIVATE KEY -----"
