# Production Release Runbook

`scripts/release/` is the only supported production release path. It builds a
tracked source snapshot, verifies its manifest, checks the rendered Nginx and
environment contract, switches `current` atomically, restarts systemd, and
checks the running release metadata. Do not use `deploy/deploy.ps1` or upload
a mutable zip over the live site.

## Required sequence

1. Run root and backend verification from clean working trees.
2. Build a release directory with `release-manifest.js --create`.
3. Render the Nginx configuration from `templates/ujn-guide-nginx.conf` and
   set `client_max_body_size` to at least the value implied by the production
   upload policy. The default is `35m`.
4. Run `deploy-release.sh --dry-run` with the external environment file and
   rendered Nginx configuration.
5. Run the same command without `--dry-run`; retain the resulting release ID,
   manifest hash, health response, and service status in the private
   acceptance record.
6. If health verification fails, use `deploy-release.sh --rollback` rather
   than replacing files in place.

Secrets, SQLite databases, audit archives, Lsky storage, and the rendered
production configuration remain outside the release directory and Git.
