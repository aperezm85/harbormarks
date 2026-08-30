# HarborMarks NAS Deployment Instructions

This guide explains how to run HarborMarks on a NAS using Docker Compose.

## 1. Prerequisites

- A NAS with Docker support (for example Synology Container Manager, QNAP Container Station, or a Linux NAS with Docker Engine).
- SSH access to the NAS shell (recommended).
- Docker Compose available as `docker compose`.
- At least 2 GB RAM free for app + PostgreSQL.
- One free host port (default in this project: `3000`).

## 2. Copy Project To The NAS

Place the project on your NAS, for example:

```bash
/volume1/docker/harbormarks
```

Then open a shell in that directory:

```bash
cd /volume1/docker/harbormarks
```

## 3. Configure App Credentials In Compose

Edit `docker-compose.yml` and set at least these values under `services.app.environment`:

```yaml
HARBOR_BOOTSTRAP_ADMIN_EMAIL: admin@example.com
HARBOR_BOOTSTRAP_ADMIN_NAME: Harbor Admin
HARBOR_BOOTSTRAP_ADMIN_PASSWORD: change_this_now
HARBOR_ALLOW_SIGNUP: "true"
HARBOR_CHECK_ORIGIN: "true"
```

Notes:

- In this repository, `docker-compose.yml` already sets the internal database URL to the `db` service.
- `HOST` and `PORT` are also forced by Compose for container runtime.
- Keep `HARBOR_CHECK_ORIGIN` enabled by default. If a proxy causes an origin mismatch, fix the forwarded host/proto headers instead of disabling the check globally.
- Bootstrap admin values are used only when the users table is empty.
- Always replace any example/default bootstrap credentials before starting in shared or production environments.
- You usually only need to set bootstrap admin values in `docker-compose.yml`.

## 4. Build And Start

Run:

```bash
docker compose up -d --build
```

Check status:

```bash
docker compose ps
```

Follow logs:

```bash
docker compose logs -f app
```

## 5. Open In Browser

Use:

```text
http://<NAS_IP>:3000/login
```

Example:

```text
http://192.168.1.50:3000/login
```

If you use a reverse proxy, map your domain to `http://127.0.0.1:3000` on the NAS.

## 6. NAS Firewall And Router Notes

- Ensure NAS firewall allows inbound TCP `3000` from your LAN.
- Do not expose PostgreSQL (`5432`) to the internet.
- If remote internet access is needed, use a reverse proxy + HTTPS + authentication.

## 7. Common Troubleshooting

### App does not open

- Check containers:

```bash
docker compose ps
```

- Check app logs:

```bash
docker compose logs --tail=200 app
```

- Confirm NAS port use:

```bash
curl -I http://localhost:3000/login
```

### Login works but page errors

- Check database URL in running app:

```bash
docker compose exec -T app sh -lc 'echo "$DATABASE_URL"'
```

Expected host in URL is `db`, not `localhost`.

### Rebuild after code or env changes

```bash
docker compose up -d --build
```

### Stop and remove containers

```bash
docker compose down
```

To also remove database data volume:

```bash
docker compose down -v
```

Warning: `-v` deletes stored bookmarks.

## 8. Updating HarborMarks

From project directory:

```bash
git pull
docker compose up -d --build
```

## 9. Backup Recommendation

Because PostgreSQL data is in a Docker volume (`db_data`), set a NAS backup job for Docker volumes or do periodic SQL dumps.

Quick dump example:

```bash
docker compose exec -T db pg_dump -U astro harbormarks > harbormarks_backup.sql
```

Restore example:

```bash
cat harbormarks_backup.sql | docker compose exec -T db psql -U astro -d harbormarks
```

## Recent Changes

### 2026-03-16

- Updated Compose setup docs to use bootstrap-admin env variables (`HARBOR_BOOTSTRAP_ADMIN_*`) instead of legacy login-only env keys.
- Clarified that bootstrap-admin values are used only when no users exist.
- Added explicit guidance to replace default/example credentials before deployment.
- Added GHCR-based image publishing and deploy-without-repo-copy workflow guidance.
- Added image-based deployment path using `docker-compose.deploy.yml`.

## 10. Deploy Without Copying The Project To NAS

If you do not want to copy this repository to the NAS, publish a prebuilt image and deploy from a minimal Compose file.

This repository includes:

- `docker-compose.deploy.yml`: image-based deploy file (no local build).
- `.github/workflows/publish-ghcr.yml`: builds and pushes to GitHub Container Registry.

Current publish workflow in this repo: GHCR.

### A) Publish from GitHub Actions

GHCR workflow needs no extra secret in most repos because it uses `GITHUB_TOKEN`.

The publish workflow triggers on:

- push to `main`
- tags like `v1.0.0`
- manual run (`workflow_dispatch`)

### B) NAS-side files only

On NAS, create a small folder (for example `/volume1/docker/harbormarks`) with only:

- `docker-compose.deploy.yml`

Edit `docker-compose.deploy.yml` and set these values under `services.app.environment`:

```yaml
HARBOR_BOOTSTRAP_ADMIN_EMAIL: admin@example.com
HARBOR_BOOTSTRAP_ADMIN_NAME: Harbor Admin
HARBOR_BOOTSTRAP_ADMIN_PASSWORD: change_this_now
HARBOR_ALLOW_SIGNUP: "true"
SESSION_SECRET: use_a_long_random_secret
```

In `docker-compose.deploy.yml`, set your image reference (default shown here is GHCR):

- GHCR: `ghcr.io/aperezm85/harbormarks:latest`

Start/update on NAS:

```bash
docker compose -f docker-compose.deploy.yml pull
docker compose -f docker-compose.deploy.yml up -d
```

### C) Recommended tag strategy

For safer upgrades on NAS, pin to a version tag (for example `:v1.2.0`) instead of always using `:latest`.

Rollback example:

1. Change image tag in `docker-compose.deploy.yml` to previous version.
2. Run `docker compose -f docker-compose.deploy.yml up -d`.
