Preview auto-deploy setup
=========================

This repository includes a GitHub Actions workflow that builds the frontend on every push to `main` and notifies a preview webhook so your preview environment can pull the latest changes.

Workflow file:

- `.github/workflows/deploy-preview.yml`

How to enable automatic preview updates
--------------------------------------

1. Create a webhook endpoint on your preview host that accepts a POST request with a small JSON payload. The payload sent by the workflow is:

   ```json
   {"repository":"owner/repo","ref":"refs/heads/main","sha":"<commit-sha>"}
   ```

   The preview host can use this to trigger a `git pull` and rebuild the site.

2. In your GitHub repository settings, add a repository secret named `PREVIEW_WEBHOOK_URL` with the full URL of the webhook endpoint.

   Optionally, add `PREVIEW_TOKEN` as a secret if your webhook requires a bearer token for authentication.

3. After adding the secrets, push to `main` (or merge a PR) and the workflow will run.

Notes
-----
- The workflow builds only the frontend (`/frontend`). If your preview expects a backend deploy step, extend the workflow or make the webhook trigger a full redeploy on the preview environment.
- If your preview platform supports direct GitHub integration, prefer linking the project in the platform UI so pushes to `main` automatically deploy without a webhook.
