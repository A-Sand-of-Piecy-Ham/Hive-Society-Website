# Runbook

Every command and procedure needed to develop, check, deploy, and maintain the site. Written so a new maintainer can take over with nothing but this file.

Not a developer? You want [EDITING.md](../EDITING.md) instead.

**Contents:** [Setup](#1-setup) · [npm scripts](#2-npm-scripts) · [Making a change](#3-making-a-change) · [Deploying](#4-deploying) · [One-time project setup](#5-one-time-project-setup) · [When CI fails](#6-when-ci-fails) · [Routine maintenance](#7-routine-maintenance) · [Troubleshooting](#8-troubleshooting)

---

## 1. Setup

### Dependencies

**Required**: everything in [§2](#2-npm-scripts) and [§3](#3-making-a-change) needs only these:

| Tool | Version | Install | Check |
|---|---|---|---|
| Node.js (includes npm) | 24+ | [nvm](https://github.com/nvm-sh/nvm): `nvm install 24` | `node --version` |
| git | any recent | [git-scm.com](https://git-scm.com/downloads) | `git --version` |

**Optional**: only for the task listed. Skip any you don't need.

| Tool | Needed for | Install | Check |
|---|---|---|---|
| Docker | Building/running the container image; required by k3d | [Docker Desktop](https://docs.docker.com/desktop/) (macOS/Windows, incl. WSL2) or [Docker Engine](https://docs.docker.com/engine/install/) (Linux) | `docker --version` |
| kubectl | Any Kubernetes work (render, apply, logs) | [kubernetes.io/docs/tasks/tools](https://kubernetes.io/docs/tasks/tools/) · `brew install kubectl` | `kubectl version --client` |
| k3d | Running the site in a local Kubernetes cluster | `curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh \| bash` · `brew install k3d` | `k3d version` |
| ImageMagick | Resizing images before committing ([§3](#3-making-a-change)) | `sudo apt install imagemagick` · `brew install imagemagick` | `convert -version` (v7: `magick -version`) |
| kustomize | Only for `kustomize edit set image` when releasing to production; rendering uses kubectl | [kubectl.docs.kubernetes.io/installation/kustomize](https://kubectl.docs.kubernetes.io/installation/kustomize/) · `brew install kustomize` | `kustomize version` |
| kubeconform | Validating manifests locally (CI already does it) | [github.com/yannh/kubeconform](https://github.com/yannh/kubeconform#installation) · `brew install kubeconform` | `kubeconform -v` |
| GitHub CLI (`gh`) | Opening PRs / checking CI from the terminal (the website works just as well) | [cli.github.com](https://cli.github.com/) · `brew install gh` | `gh --version` |

`wrangler` (Cloudflare deploys) needs no install: it runs through `npx`.

Tested with Node 24.21, Docker 29.0, kubectl 1.34, k3d 5.9, ImageMagick 6.9. ImageMagick 7 renamed `convert` to `magick`; substitute it in the commands below.

### Get the site running

```bash
git clone <repo-url> hive_site && cd hive_site
npm ci          # exact versions from package-lock.json; use this, not `npm install`, unless changing dependencies
npm start       # → http://localhost:8080
```

There's no build step: Node runs the TypeScript (`.mts`) files directly.

## 2. npm scripts

This table is the complete list. A test fails if a script in `package.json` isn't documented here.

| Command | What it does | When to use it |
|---|---|---|
| `npm start` | Serves `public/` at http://localhost:8080. Pages are rendered on each request (links filled from `content/site.yaml`), and files are never served stale | Day-to-day development |
| `npm run start:dist` | Serves the exported `dist/` instead of `public/` | Previewing exactly what will be deployed (run `npm run export` first) |
| `npm run export` | Builds the deployable static site into `dist/`: renders pages, fingerprints assets (`?v=<hash>`), writes `robots.txt`, `sitemap.xml`, `_headers` | Before a manual deploy; Cloudflare Pages runs it automatically |
| `npm test` | Runs every test in `test/`: server behavior, theme rules, site settings, form parsing, and a check that every link and image on every page exists | Before every commit (CI runs it too) |
| `npm run lint` | ESLint with strict type-aware rules | Before every commit |
| `npm run typecheck` | TypeScript type check (no output files) | Before every commit |
| `npm run validate:theme` | Checks `content/theme.yaml`: hex colors, naming, team list shape | After editing colors |
| `npm run check:form` | Compares the live Google Form (mailing list) with the question IDs in `content/site.yaml`. Needs internet | After changing the Google Form, or when the daily check fails |

Options and variants:

```bash
npm run lint -- --fix                              # auto-fix what ESLint can
npm run validate:theme -- path/to/other-theme.yaml # validate a different file
node --test test/theme.test.mts                    # run one test file
node --test --test-name-pattern='health' test/app.test.mts   # run tests whose name matches
PORT=3000 npm start                                # different port (also: HOST, STATIC_DIR)
SITE_URL=https://staging.example.com npm run export          # canonical URL for sitemap/robots
```

**The pre-commit check** (exactly what CI's main job runs):

```bash
npm run lint && npm run typecheck && npm run validate:theme && npm test && npm run export
```

## 3. Making a change

`main` is protected. Every change goes through a pull request.

```bash
git switch main && git pull
git switch -c <github-user>/<short-description>      # e.g. alex/fix-footer-spacing
# …edit, then run the pre-commit check above…
git add -A && git commit -m "fix: tighten footer spacing on mobile"
git push -u origin HEAD                               # then open a PR on GitHub
```

- **PR title = the release note and the version bump.** It must start with an allowed type (`content:`, `theme:`, `fix:`, `feat:`, …). The rules are in [README → Versioning](../README.md#versioning). CI rejects any other title.
- PRs are **squash-merged** once all required checks pass.
- Changed a convention, command, or layout? Update [AGENTS.md](../AGENTS.md), this runbook, and [PROJECT_LOG.md](PROJECT_LOG.md) in the same PR. Changed what editors can do? Update [EDITING.md](../EDITING.md).

**Adding images:** resize before committing (git keeps every version forever):

```bash
convert in.png -auto-orient -resize '1200x1200>' -strip -quality 82 -interlace JPEG out.jpg   # ImageMagick
```

Max 1200 px on the long edge (1920 px for full-width heroes). Use JPEG except for logos/transparency. Never commit the same image twice under different names.

## 4. Deploying

### Cloudflare Pages (current production)

**Automatic (preferred):** once the Pages project is connected to the GitHub repo ([§5](#5-one-time-project-setup)), every merge to `main` deploys production and every PR gets a preview URL. Nothing to run.

**Manual** (emergencies, or before the Git connection exists):

```bash
npm ci && npm run export
npx wrangler login                                   # first time only; opens a browser
npx wrangler pages deploy dist --project-name=<pages-project-name> --branch=main
```

### Container image

Needs Docker ([§1](#dependencies)).

```bash
docker build -t hive-site:dev .                      # multi-stage: runs the export, serves dist/
docker run --rm --read-only --user 1000 -p 8080:8080 hive-site:dev   # same constraints as the Kubernetes pod
```

Publishing to GitHub Container Registry (manual until release automation exists):

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin   # token needs write:packages
docker build -t ghcr.io/<owner>/hive-site:<version> .
docker push ghcr.io/<owner>/hive-site:<version>
```

### Kubernetes: local (k3d)

Needs Docker, kubectl, and k3d ([§1](#dependencies)). Verified end to end on 2026-09-23.

```bash
k3d cluster create hive -p "8081:80@loadbalancer"    # one time; Traefik is included
docker build -t hive-site:dev . && k3d image import hive-site:dev -c hive
kubectl apply -k kube/overlays/local                 # → http://hive.localhost:8081
kubectl -n hive get pods                             # check it's running
k3d cluster delete hive                              # tear down
```

After a code change, rebuild, re-import, then `kubectl -n hive rollout restart deploy/hive-site`.

### Kubernetes: production (k3s + Cloudflare Tunnel)

Needs kubectl with access to the production cluster ([§1](#dependencies)); kustomize only if you use `kustomize edit`.

One time (see [§5](#5-one-time-project-setup) for creating the tunnel):

```bash
kubectl create namespace hive
kubectl -n hive create secret generic cloudflared-token --from-literal=token=<tunnel-token>
```

Each release:

```bash
# Set the image tag in kube/overlays/prod/kustomization.yaml (images → newTag), or with the kustomize CLI:
#   (cd kube/overlays/prod && kustomize edit set image hive-site=ghcr.io/<owner>/hive-site:<version>)
kubectl kustomize kube/overlays/prod | less          # review what will be applied
kubectl apply -k kube/overlays/prod
kubectl -n hive rollout status deploy/hive-site      # waits until healthy
kubectl -n hive logs deploy/hive-site                # if something's wrong
kubectl -n hive rollout undo deploy/hive-site        # roll back to the previous version
```

## 5. One-time project setup

Do these once, when setting the project up or moving it to a new owner. Tick them off in [PROJECT_LOG.md](PROJECT_LOG.md).

**GitHub**
1. Create the repository as **private**, then push `main`.
2. **Branch protection:** Settings → Rules → Rulesets → new branch ruleset for `main`: require a pull request, require these status checks: **Lint, typecheck, test**, **Kubernetes manifests**, **Container image**, **Conventional PR title**. Also block force pushes, and allow **squash merge** only (Settings → General). Private repos need GitHub Pro/Team for this to be enforced (free via the GitHub Student Developer Pack).
3. **Officers for roster overrides:** Settings → Secrets and variables → Actions → Variables → `ROSTER_OFFICERS` = comma-separated GitHub usernames. *(Used once the roster check exists.)*
4. **Log retention:** Settings → Actions → General → Artifact and log retention, e.g. 30 days. Roster-override approvals live only in these logs.
5. Dependabot runs from `.github/dependabot.yml` automatically. Enable alerts under Settings → Code security.

**Cloudflare Pages**
1. Workers & Pages → Create → Pages → Connect to Git → pick the repo.
2. Build command `npm run export`, output directory `dist`, environment variable `NODE_VERSION` = `24`.
3. Custom domains → `hivesocietyimprov.com` (and `www`).

**Cloudflare Tunnel** (only for the Kubernetes deployment)
1. Zero Trust → Networks → Tunnels → Create (cloudflared). Copy the token into the Kubernetes secret above.
2. Public hostnames: `hivesocietyimprov.com` and `www.hivesocietyimprov.com` → `http://traefik.kube-system.svc.cluster.local:80`.

**Google** (in the Hive Google account)
- The shows calendar ("Hive Shows - Website Calendar") must be **public**; its ID goes in `content/site.yaml`.
- The mailing-list Google Form's question IDs go in `content/site.yaml`; verify with `npm run check:form`.

## 6. When CI fails

| Failing check | What it means | Fix |
|---|---|---|
| **Conventional PR title** | Title doesn't start with an allowed type | Edit the PR title (e.g. `fix: …`). No new commit needed |
| **Lint, typecheck, test** → lint / typecheck | Code style or type error | Run the same command locally; `npm run lint -- --fix` handles most lint issues |
| … → Validate theme.yaml | A color isn't `#rrggbb`, a key isn't kebab-case, or a team entry is malformed | The error names the exact key; fix it in `content/theme.yaml` |
| … → test: *local links and assets resolve* | A page references a file that doesn't exist (renamed/deleted image) | The failure lists the missing paths; fix the reference or restore the file |
| … → test: *every npm script is documented* | A script was added to `package.json` without a row in [§2](#2-npm-scripts) | Add the row |
| **Kubernetes manifests** | A Kustomize overlay doesn't render, or a resource fails schema validation | `kubectl kustomize kube/overlays/<name>` locally; kubeconform's message names the field |
| **Container image** | Build failed, or the container didn't serve pages under pod constraints | `docker build` and `docker run` locally ([§4](#container-image)); check `docker logs` |
| **Mailing-list form drift** (daily, not required) | A Google Form question was deleted or re-created, or a new required question was added | `npm run check:form` shows which; update the ID in `content/site.yaml` (open the form → ⋮ → *Get pre-filled link*: field names show as `entry.<id>`) |

## 7. Routine maintenance

| When | Task |
|---|---|
| Weekly (Dependabot PRs) | Review and merge dependency PRs (`deps:` = patch release, `ci:` = no release) once checks pass |
| When the form drift check emails | [§6](#6-when-ci-fails), last row |
| Start of each semester | Confirm upcoming shows are in the shows calendar; roster updated (leavers → Alumni); officer list in `ROSTER_OFFICERS` current |
| When officers change | Update GitHub access, `ROSTER_OFFICERS`, and access to the Hive Google account / Cloudflare |
| Before making the repo public | Review git history for anything that shouldn't be public |

## 8. Troubleshooting

- **Browser shows an old version:** hard-reload (Ctrl/Cmd + Shift + R). On the deployed site this should never be needed, because assets are fingerprinted; if it is, check that the deploy ran `npm run export`.
- **`npm start` fails with a site.yaml error:** the message names the bad key in `content/site.yaml`.
- **Port 8080 already in use:** `PORT=3000 npm start`, or find the other process with `lsof -i :8080`.
- **`npm ci` fails:** `package-lock.json` and `package.json` disagree. Run `npm install` to update the lockfile and commit both.
- **Local k3d site not reachable at hive.localhost:8081:** `kubectl -n hive get pods,ingress`. Pods stuck in `ErrImageNeverPull`/`ImagePullBackOff` mean the image wasn't imported: re-run `k3d image import`.
