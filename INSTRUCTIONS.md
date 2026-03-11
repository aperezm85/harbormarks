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

## 3. Create Environment File

Copy the example and edit values:

```bash
cp .env.example .env
```

Set at least these variables in `.env`:

```bash
HARBOR_USER=admin
HARBOR_PASSWORD=change_this_now
SESSION_SECRET=use_a_long_random_secret
```

Notes:

- In this repository, `docker-compose.yml` already sets the internal database URL to the `db` service.
- `HOST` and `PORT` are also forced by Compose for container runtime.
- You usually only need to set login credentials and `SESSION_SECRET` in `.env`.

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
