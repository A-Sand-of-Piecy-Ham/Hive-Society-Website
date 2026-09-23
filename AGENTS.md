# AGENTS.md

Guidance for AI coding agents working in this repo. Humans: see [README.md](README.md).
`CLAUDE.md` only imports this file (`@AGENTS.md`). Put guidance here, not there, so every agent reads the same instructions.

> **Keep this file current.** If your change makes anything here wrong or incomplete (commands, layout, conventions, decisions), update this file in the same change. A stale AGENTS.md misleads every later agent. Also keep [docs/PROJECT_LOG.md](docs/PROJECT_LOG.md) in sync: tick TODOs you finish (move them to **Done** with the date), add TODOs you defer, and record decisions.

## Project

Website for Hive Society Improv (UIUC), https://hivesocietyimprov.com. Today it's the original Mobirise export in `public/`, served by a Node static server or exported to static files. It's moving toward data-driven pages (YAML content, a git-based CMS for non-coders, a generated theme). Read `docs/PROJECT_LOG.md` for current decisions and open work, and `docs/site-audit.md` for the content inventory and plans.

## Commands

| Task | Command |
|---|---|
| Serve `public/` on :8080 | `npm start` |
| Static export → `dist/` | `npm run export` |
| Serve `dist/` | `npm run start:dist` |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| Render k8s manifests | `kubectl kustomize kube/overlays/local` (or `prod`) |

Node 24+ runs `.mts` directly via type stripping; there's no build step. `tsconfig.json` sets `erasableSyntaxOnly`, so **don't use `enum`, `namespace`, or constructor parameter properties**.

**Before calling a change done:** `npm run lint && npm run typecheck` must pass. If you touched `kube/`, both overlays must render. If you touched the server or export, run it and hit a page.

## Layout

```
content/theme.yaml     all site colors (rules below)
public/                site root: HTML pages + assets (vendored Mobirise output)
src/server.mts         static file server (Pages-style extensionless URLs, /healthz)
scripts/export.mts     public/ → dist/ + robots.txt, sitemap.xml, _headers
kube/base, kube/overlays/{local,prod}   Kustomize; prod = k3s + Cloudflare Tunnel
docs/                  PROJECT_LOG.md (decisions + TODOs), site-audit.md
```

## Conventions

### Theme (`content/theme.yaml`), strict
- Keys name **where** a color is used (`navigation.background`, `buttons.hover-text`). **Never** add palette or primitive keys (`purple`, `accent`, `primary`), keys named after CSS selectors (`h1`, `.btn`), or values that reference other keys.
- Values are literal `#rrggbb` / `#rrggbbaa`.
- **Duplicate hex values are intentional.** Don't "deduplicate" them into shared keys.
- `teams` is a list of `{ id, background, text }`. `id` matches the team id in the team data.
- CSS must consume colors only as `var(--group-key)` (e.g. `--navigation-background`, `--teams-usuc-background`), never as hard-coded hex.
- Renaming or removing a key is a **breaking change** (see Versioning).

### Code
- TypeScript ESM (`.mts`), strict typed ESLint (`typescript-eslint` `strictTypeChecked`). Prefer Node built-ins over new dependencies; justify any new dependency.
- Match surrounding style: doc-comments on exported or non-obvious functions, comments explain *why*.
- `public/` is vendored Mobirise output. Don't reformat it wholesale. Make targeted edits only; it's being replaced by templates.
- **Images committed to the repo:** JPEG, at most 1200 px on the long edge (1920 px for full-width heroes), quality ~82, progressive, metadata stripped. Use PNG only for logos or images that need transparency. Git history keeps every version of a file forever, so optimize *before* committing. Example: `convert in.png -auto-orient -resize '1200x1200>' -strip -quality 82 -interlace JPEG out.jpg`. Don't commit duplicate files; reference one shared file instead (e.g. every page's `og:image` is `assets/images/social-preview.png`, as an absolute URL).

### Commits, PRs, and versioning
`main` is branch-protected: **all changes go through a PR on a branch**, required CI checks must pass before merge, and PRs are squash-merged. Never commit or push to `main` directly, and never bypass or weaken protection or required checks to get a change in. If a check is wrong, fix the check in its own PR.

Conventional Commits; the PR title becomes the squash commit message. The version is bumped automatically. **Never edit `version` in `package.json` by hand.**

| Type | Use for | Release |
|---|---|---|
| `content:` | Text, photos, members, teams | patch |
| `theme:` | Color *value* changes in `theme.yaml` | patch |
| `fix:` / `perf:` | Bug fixes / performance | patch |
| `refactor:` | Restructuring shipped code with no intended behavior change | patch (so regressions map to a release) |
| `build:` | Dockerfile, base image, build/export pipeline | patch |
| `deps:` | Dependency updates (runtime or build) | patch |
| `feat:` | New page, component, CMS collection, **new** theme key or content field | minor |
| `<type>!:` or `BREAKING CHANGE:` footer | Removed/renamed theme key or content field, changed URLs, change needing manual deploy steps (new secret, cluster, site engine) | major |
| `test:` `ci:` `docs:` `style:` (formatting only) `chore:` | No runtime regression risk | none |

Rule of thumb: bump by **regression risk**. If the change could alter the deployed site's behavior or appearance (code logic, image, dependencies, content), it gets at least a patch. Formatting-only and test-only changes touch code but carry no runtime risk, so they don't release. "Architecture change" is **not** automatically major. What matters is whether a contract breaks (content/theme schema, URLs, deploy steps). Full rationale is in README → Versioning.

### Infrastructure
- Kustomize: environment differences go in overlays, never forked copies of base files. Use standard `networking.k8s.io/v1` Ingress, not Traefik CRDs, to stay portable.
- Pods run non-root with a numeric UID and a read-only root filesystem. Keep it that way.
- **No secrets in the repo.** The Cloudflare tunnel token is created manually as the `cloudflared-token` Secret.

## Don't
- Don't push, deploy, or apply manifests to a real cluster unless the human explicitly asks.
- Don't change `.gitignore`, CI workflows, ESLint/TS config, or Kustomize base without saying so in your summary.
- Don't implement items marked **on hold** in the project log (e.g. Beeble rendering).
