# Tencent production deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`. The workflow builds an archive from tracked website files and sends it over SSH to the existing Tencent Ubuntu server. It can also be run manually on `main` from GitHub Actions.

- Website: https://www.pratt-oil.com/
- Server: `43.160.235.91`
- Nginx root: `/var/www/html/demo/pratt-oil-oilfield`
- Receiver installed by an administrator: `/usr/local/sbin/pratt-oil-github-deploy`
- Release storage: `/var/lib/pratt-oil/releases/<release-id>/site`
- Original website backup: `/var/backups/pratt-oil/initial-*`
- GitHub Actions secret: `PRATT_DEPLOY_SSH_KEY`
- Pinned public SSH host key: `deploy/known_hosts`

The deployment key is dedicated to this repository and restricted to the receiver command in `authorized_keys`. It does not provide an interactive shell. Private keys must never be committed. Changing the receiver in this repository requires an administrator to install the reviewed script on the server; a website release cannot replace it.

Only the static website directories `assets/`, `en/`, `ar/`, `admin/`, `privacy-policy/`, `terms/` and the listed root website files are packaged. Git metadata, workflow files, deployment scripts and historical backups are excluded. Each archive includes a fresh manifest with file sizes and SHA256 hashes; the receiver rejects unexpected files, links, path traversal, unsupported metadata and oversized archives. Transfers and validation use bounded chunks.

The receiver prepares a separate release and atomically switches the website root to it. On the first deployment it atomically exchanges the original directory and the new symlink, then preserves the original directory outside the public web root. It checks the served homepage, stylesheet and `/__pratt_release.json` against the requested commit. If this check fails, it restores the previous website. Five recent releases and the original backup are retained. Nginx configuration and certificates are not changed.

## Check a release

Check the GitHub Actions run and `https://www.pratt-oil.com/__pratt_release.json`. The marker's `commit` must equal the deployed GitHub commit. The receiver returns a nonzero exit code on validation or health-check failure.

## Restore a previous release

Use an administrator SSH connection or Tencent's terminal, rather than the restricted deployment key. Inspect the available releases and the current target:

```bash
readlink -f /var/www/html/demo/pratt-oil-oilfield
ls -1 /var/lib/pratt-oil/releases
```

After choosing an existing release ID, run the following, replacing `RELEASE_ID` with that exact directory name. This takes the same lock as deployment and atomically changes the symlink:

```bash
sudo flock /var/lib/pratt-oil/deploy.lock python3 - RELEASE_ID <<'PY'
import os, pathlib, re, sys, uuid
name = sys.argv[1]
if not re.fullmatch(r'\d{8}T\d{6}Z-[a-f0-9]{12}-[a-f0-9]{8}', name):
    raise SystemExit('Invalid release ID')
target = pathlib.Path('/var/lib/pratt-oil/releases') / name / 'site'
if not (target / 'index.html').is_file():
    raise SystemExit('Release does not exist')
live = pathlib.Path('/var/www/html/demo/pratt-oil-oilfield')
temporary = live.parent / ('.pratt-rollback-' + uuid.uuid4().hex)
temporary.symlink_to(target, target_is_directory=True)
os.replace(temporary, live)
print('Restored:', target)
PY
```

Verify the homepage and marker after recovery. A subsequent successful push to `main` publishes that new commit again. Updating `admin/seed.json` does not clear data already stored in a visitor's browser localStorage.
