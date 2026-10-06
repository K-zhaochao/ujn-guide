# Production Release Runbook

`scripts/release/` is the only supported production release path. It builds a
tracked source snapshot, verifies its manifest, checks the rendered Nginx and
environment contract, switches `current` atomically, restarts systemd, and
checks the running release metadata. Do not use `deploy/deploy.ps1` or upload
a mutable zip over the live site.

The 2026-09-08 fixes add bounded readiness, verified failure recovery, the
candidate backend's upload contract, effective Nginx location checks and safe
logging validation. The restore helper now orchestrates actual systemd/HTTP/data
checks. These are **not a production readiness sign-off**: local tests substitute
systemd/process inspection, so Linux/1Panel rehearsal remains required. See the
[fix verification record](../../server/docs/operations/pet-readiness-fixes-2026-09-08.md).

The maintained [1Panel runbook](../../server/docs/operations/1panel-deployment.md)
and [acceptance checklist](../../server/docs/operations/production-acceptance.md)
live in the independent backend repository; check it out alongside the main site.

## Required sequence

1. Run root and backend verification from clean working trees.
2. Build a release directory with `release-manifest.js --create`.
3. Render the Nginx configuration from `templates/ujn-guide-nginx.conf` and
   set `client_max_body_size` to at least the value implied by the production
   upload policy. The template defaults to `28m` for 10 images x 2 MiB;
   20 x 2 MiB requires `55m`. Its longer restore-import prefix independently
   defaults to `128m`, matching `BACKUP_EXPORT_MAX_MB`.
   Load `templates/ujn-guide-log-format.conf` inside **http**, before server
   includes; select `ujn_safe` in the vhost and adapt the log file destination.
4. Run `deploy-release.sh --dry-run` with the external environment file and
   rendered Nginx configuration.
5. Only after isolated Linux readiness/rollback rehearsal, run the same
   command without `--dry-run`; retain the resulting release ID,
   manifest hash, health response, and service status in the private
   acceptance record.
6. Use `deploy-release.sh --rollback` only when the previous code is compatible
   with the current database. The script does not restore the external SQLite or
   Lsky data; schema upgrades need a matched, verified data recovery plan.

Use `--allow-initial` only for a release root without a previous deployment; it
does not authorize overwriting existing data. Keep the full same-commit release
tool directory together on the server, not just the shell script. Install backend
production dependencies on Linux; do not copy Windows `node_modules`.

For 1Panel, confirm that systemd uses a host-installed Node executable and that
OpenResty can reach the host loopback backend. Map the whole release tree read-only
at the same absolute path inside the container, including symlink targets; a bind
mount of only the old `current/site` can remain pinned to the old release.

`--readiness-timeout N` bounds each target's readiness window (1..600 seconds,
default 60). Refused connections, HTTP/JSON errors and mixed release metadata
are retried only within that deadline. Recovery stops the failed process first,
switches the link and separately verifies the fallback. Exit 1 means deployment
failed, even if fallback was verified; exit 2 requires manual incident handling.
On initial failure, stop is verified before unlinking current; data/releases remain.

The config CLI now requires `--server-dir <candidate/server>`. It imports only
that backend's pure upload policy, never a developer `.env` or default database.
It verifies the correct HTTPS vhost, exact/longest-prefix overrides, inherited body
limits and includes. Relative includes require the actual `--nginx-prefix`.
Unsupported nested/rewritten API routing fails closed. Both candidate and fallback
must expose this contract; prepare a compatible verified fallback for legacy releases.

Access log formats must be available in the supplied http/vhost configuration and
use only safe JSON variables. Default combined, query/header variables and unknown
mapped variables are rejected, including extra log destinations. Native API error
logs cannot redact request URLs: the template discards those location-level raw
messages while retaining safe access diagnostics and backend errors. Master/early
parser/TLS/CDN/WAF/collector logs still need real-environment synthetic-secret tests.

Run `npm run test:release` (`node --test tests/release/*.test.js`) for manifest,
executable deployment-failure, upload and log-contract tests. Mocked commands on
Windows/Git Bash do not constitute Linux/systemd acceptance. Always run `nginx -t`
in the actual OpenResty environment and test real upload boundaries separately.

Secrets, SQLite databases, audit archives, Lsky storage, and the rendered
production configuration remain outside the release directory and Git.

## Local same-origin acceptance

Before entering the credentialed production checklist, start the local backend on
`127.0.0.1:3005`, build the static site, and start `npm run dev:site`. Then run:

```powershell
npm run verify:local-deployment
```

The command probes `/`, `/pets/`, `/api/health`, and `/admin` through the local
same-origin proxy. It is intentionally credential-free and does not replace the
1Panel checks for HTTPS, OAuth, Lsky, encrypted backups, or rollback.
