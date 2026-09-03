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
- Keep `HARBOR_CHECK_ORIGIN: "true"`. This is the CSRF origin check and turning it
  off on an internet-reachable deployment removes a real protection. If a reverse
  proxy causes an origin mismatch, the cause is the proxy dropping the original
  host: the app sees an internal host such as `172.27.0.2:3000` while the browser
  sends `Origin: https://your-domain`. Forward the real host instead
  (`proxy_set_header Host $host` in nginx, or the equivalent) rather than
  disabling the check.
- Do not add `SESSION_SECRET`. The application has never read it. Sessions are
  opaque random tokens stored in the database.
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

### Every page returns 500 after an upgrade

Symptom: `/login` renders, but every page after signing in returns 500. The app
log shows `Failed query: select ... from "bookmarks"` naming a column such as
`updated_at` or `deleted_at`.

Cause: the schema migrations did not run, so the code is newer than the database.

Check whether the migrator has ever run:

```bash
docker exec harbormarks-db psql -U astro -d harbormarks -c "select name from schema_migrations order by name"
```

`relation "schema_migrations" does not exist` means it never has. Take a dump
first (section 9), then run it by hand and restart:

```bash
docker exec harbormarks-app node ./scripts/migrate.mjs
docker restart harbormarks-app
```

If the database was hand-patched before the migrator was introduced, its schema
can be ahead of what `schema_migrations` records. Compare before running:

```bash
docker exec harbormarks-db psql -U astro -d harbormarks -c "\d bookmarks"
```

If `tags` is already `text[]` while `schema_migrations` is missing, record the
first two migrations as applied so the runner does not try to recreate a text
index on an array column:

```bash
docker exec harbormarks-db psql -U astro -d harbormarks -c "
CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT NOW());
INSERT INTO schema_migrations (name) VALUES ('0001_initial.sql'), ('0002_tags_array.sql') ON CONFLICT DO NOTHING;"
```

The permanent fix is to make sure the stack does not override the container
startup command. See section 11.

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

**Take a database dump before upgrading.** See section 9 for the command.

From project directory:

```bash
git pull
docker compose up -d --build
```

Schema migrations run automatically when the app container starts, before the
server accepts requests, and are recorded in the `schema_migrations` table. If a
migration fails the container stops rather than starting against a half-migrated
database, so check the app logs if the container will not come up:

```bash
docker compose logs app | tail -50
```

### Upgrading to 0.9.4

This release adds a generated search column and a GIN index to the `bookmarks`
table. Adding a stored generated column rewrites the table under a brief
exclusive lock, so the startup migration can take a moment on a large
collection. Nothing else is required.

If your database was created before migrations existed, this upgrade also
converts `tags` from a text column to a text array. Existing tags are preserved.

> If you built an image between 30 and 31 August 2026, that build shipped a
> version of `0002_tags_array.sql` that dropped the `tags` column instead of
> converting it. Restore from a dump if your tags disappeared.

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

### 2026-09-03 (v0.9.6)

- Added five nullable enrichment columns (`site_name`, `author`, `published_at`,
  `language`, `canonical_url`) via migration `0005_bookmark_enrichment.sql`, applied
  automatically at container start. All are nullable, so the migration adds columns
  without rewriting existing rows; take a dump before any upgrade as usual.
- Metadata extraction now runs on `node-html-parser` and decodes the response body
  with the declared or detected charset, so non-UTF-8 pages no longer arrive as
  mojibake, and bot-protected pages fall back to a per-host adapter.
- Brought the README, changelog, and package version back in sync for the release.

### 2026-09-02 (v0.9.5)

- Added import, driven by a new `POST /api/bookmarks/import` route: JSON (this
  app's export format) and Netscape HTML, auto-detected from the file,
  authenticated per user, with duplicate URLs reconciled against existing data.
- Documented that no schema migration ships in 0.9.5: upgrading to this version
  runs no new migration, so it is a drop-in image swap with no restart-time table
  rewrite. Take a dump before any upgrade as usual.
- Fixed toasts rendering off-screen or unstyled by loading the Sonner stylesheet.
- Brought the README, changelog, and package version back in sync for the release.

### 2026-08-31 (v0.9.4)

- Documented that schema migrations run automatically at container start and are
  tracked in `schema_migrations`.
- Added an upgrade note for the 0.9.4 table rewrite and the tags conversion.
- Removed the stale `SESSION_SECRET` entry from the Compose environment block in
  section 3. The application has never read it; leave it out.
- Added section 11 with a known-good Portainer stack definition. Portainer stacks
  are edited in the browser and drift from this repository; a stack that loses the
  container startup command skips migrations and takes the app down after any
  release that adds a column.
- Added a troubleshooting entry for "every page returns 500 after an upgrade",
  which is what missing migrations look like from the outside.
- Added database healthchecks and `condition: service_healthy` to both Compose
  files, so the app no longer races Postgres on a cold start.
- Strengthened the guidance on `HARBOR_CHECK_ORIGIN`: fix the proxy's forwarded
  host rather than disabling the CSRF origin check.

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
HARBOR_BOOTSTRAP_ADMIN_PASSWORD: use_a_long_unique_password
HARBOR_ALLOW_SIGNUP: "false"
HARBOR_CHECK_ORIGIN: "true"
```

The `app` service must also keep the `command:`, `healthcheck:`, and
`depends_on: db: condition: service_healthy` entries from
`docker-compose.deploy.yml`. If you are pasting a stack into Portainer rather than
using the file, paste all of it — see section 11.

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

## 11. Deploying As A Portainer Stack

Portainer stacks are edited in the browser, so they drift from the files in this
repository. Two things matter most, and both have caused outages:

1. **The startup command must run the migrator.** The image's `CMD` is
   `sh -c "node ./scripts/migrate.mjs && node ./dist/server/entry.mjs"`. A stack
   that overrides `command:` or `entrypoint:`, or a container created from an
   older image definition, silently skips migrations. The app then starts against
   a schema that is older than the code and every authenticated page returns 500.
   State the command explicitly in the stack so it cannot be lost.
2. **The app must wait for the database.** `depends_on: - db` alone does not wait
   for Postgres to accept connections, so on a cold start the migrator can fail
   with connection-refused before the database is up.

Paste this as the stack definition, replacing the bootstrap password and the
published port:

```yaml
services:
  db:
    image: postgres:17
    container_name: harbormarks-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: astro
      POSTGRES_PASSWORD: astro
      POSTGRES_DB: harbormarks
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U astro -d harbormarks"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s

  app:
    image: ghcr.io/aperezm85/harbormarks:latest
    container_name: harbormarks-app
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://astro:astro@db:5432/harbormarks
      # Used only for first-start bootstrap when the users table is empty.
      HARBOR_BOOTSTRAP_ADMIN_EMAIL: admin@example.com
      HARBOR_BOOTSTRAP_ADMIN_NAME: Harbor Admin
      HARBOR_BOOTSTRAP_ADMIN_PASSWORD: use_a_long_unique_password
      HARBOR_ALLOW_SIGNUP: "false"
      HARBOR_CHECK_ORIGIN: "true"
      HOST: 0.0.0.0
      PORT: 3000
    command: ["sh", "-c", "node ./scripts/migrate.mjs && node ./dist/server/entry.mjs"]
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/login >/dev/null 2>&1 || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
    ports:
      - "7878:3000"
    depends_on:
      db:
        condition: service_healthy

volumes:
  db_data:
```

Notes:

- **Do not add `SESSION_SECRET`.** The application has never read it.
- **Do not set `HARBOR_CHECK_ORIGIN: "false"`.** See section 3 for the proxy fix.
- After updating the stack, use Portainer's **Update the stack** with
  *Re-pull image* enabled, so the container is recreated rather than restarted.
  A restarted container keeps its old definition, including a missing `command:`.
- Confirm migrations ran by checking the app log for `Applied migration ...`
  lines, or that `schema_migrations` is populated.
