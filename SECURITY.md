# Security Policy

## Supported versions

Only the latest `v1.x` release line receives security fixes. Pre-1.0 (`0.9.x`)
releases are best-effort.

## Reporting a vulnerability

Open a GitHub Security Advisory or contact the maintainers privately. Do not
open a public issue for unpatched vulnerabilities. Expect an acknowledgement
within 72 hours.

## Deployment notes

- Keep `HARBOR_CHECK_ORIGIN: "true"`. If a reverse proxy or tunnel causes
  origin mismatches, add your public hostname to `HARBOR_ALLOWED_DOMAINS`
  instead of disabling the check.
- Set `HARBOR_ALLOW_SIGNUP: "false"` on any internet-reachable instance unless
  you explicitly want open registration.
- Replace all bootstrap admin defaults before first start.
- Email verification/reset links are logged server-side until an SMTP mailer
  is configured; treat 1.0 as self-hosted single-admin unless you wire mail.
- Back up both the Postgres volume (`db_data`) and the uploads volume
  (`uploads_data`), not just the database dump.
