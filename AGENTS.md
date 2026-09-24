# AGENTS.md

Guidance for AI coding agents working in this repo. Humans: see [README.md](README.md).
`CLAUDE.md` only imports this file (`@AGENTS.md`). Put guidance here, not there, so every agent reads the same instructions.

> **Keep this file current.** If your change makes anything here wrong or incomplete (commands, layout, conventions, decisions), update this file in the same change. A stale AGENTS.md misleads every later agent.
> Also keep in sync, in the same change:
> - [docs/PROJECT_LOG.md](docs/PROJECT_LOG.md): tick TODOs you finish (move them to **Done** with the date), add TODOs you defer, record decisions.
> - [docs/RUNBOOK.md](docs/RUNBOOK.md), the maintainer runbook (audience: a basic developer; explain *why* a step exists, not just the command): npm scripts, commands, deploys, setup, versions, tests, CI. A test fails if an npm script, test file, or PR-title type isn't in its tables; keep each test file's "what it guarantees" accurate. Container/Kubernetes material goes in [docs/CONTAINERIZATION.md](docs/CONTAINERIZATION.md), never the main runbook.
> - [EDITING.md](EDITING.md), the non-coder guide: whenever what's editable, or how, changes. It's the only doc editors read.
>   **Readers of EDITING.md do not like reading; content must be brief and avoid technical jargon. Assume website editors are lazy.**
>   Short bullets, plain words, no "CMS", "repo", "PR", "cache", file paths, or explanations of how things work. Only what to do, what not to do, and who to ask. If a line doesn't change what an editor does, cut it.

## Project

Website for Hive Society Improv (UIUC), https://hivesocietyimprov.com. Today it's the original Mobirise export in `public/`, served by a Node static server or exported to static files. **Decided: migrating to Astro** (content collections for members/teams/events, static output, islands for interactivity; see README → Architecture). Until the migration lands, keep changes to `public/` minimal; new page features belong in the Astro version. Read `docs/PROJECT_LOG.md` for current decisions and open work, and `docs/site-audit.md` for the content inventory and plans.

## Commands

| Task | Command |
|---|---|
| Serve `public/` on :8080 | `npm start` |
| Static export → `dist/` | `npm run export` |
| Serve `dist/` | `npm run start:dist` |
| Tests (node:test) | `npm test` |
| Theme rules check | `npm run validate:theme` |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| Render k8s manifests | `kubectl kustomize kube/overlays/local` (or `prod`) |
| Image limits check | `npm run check:images` |
| Live Google Form check | `npm run check:form` (network) |

Full reference with options, deploys, and setup: [docs/RUNBOOK.md](docs/RUNBOOK.md).

Node 24+ runs `.mts` directly via type stripping; there's no build step. `tsconfig.json` sets `erasableSyntaxOnly`, so **don't use `enum`, `namespace`, or constructor parameter properties**.

**Before calling a change done:** `npm run lint && npm run typecheck && npm test` must pass (plus `npm run validate:theme` if you touched `content/theme.yaml`). These are the same checks CI runs; see `.github/workflows/ci.yml`. If you touched `kube/`, both overlays must render. If you touched the server or export, run it and hit a page.

## Layout

```
content/theme.yaml     all site colors (rules below)
content/site.yaml      site settings (calendar ID, …), referenced from pages by name
public/                site root: HTML pages + assets (vendored Mobirise output)
public/assets/site/overrides.css   interim layout fixes over Mobirise (spacing/sizing only, never colors)
src/app.mts            static site handler: createSiteServer(), resolveFile() (Pages-style URLs, /healthz)
src/server.mts         entry point: env config, listen, SIGTERM
src/theme.mts          theme.yaml loading, validation, CSS-variable flattening
src/site.mts           site.yaml loading/validation; named links (calendar-google, calendar-webcal, calendar-ics)
src/images.mts         image policy (site.yaml → images): size limits, exceptions, duplicates
src/forms.mts          Google Form structure parser + drift comparison
src/render.mts         shared HTML transform (server + export): fills data-site-link hrefs; export adds ?v=<hash>
scripts/export.mts     public/ → dist/ + robots.txt, sitemap.xml, _headers
scripts/validate-theme.mts   CLI used by CI
test/*.test.mts        node:test suites (server, theme, local link/asset check)
.github/               ci.yml (required checks), pr-title.yml, dependabot.yml
kube/base, kube/overlays/{local,prod}   Kustomize; prod = k3s + Cloudflare Tunnel
docs/                  RUNBOOK.md (commands/procedures), PROJECT_LOG.md (decisions + TODOs), site-audit.md
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
- Tests use `node:test` + `node:assert/strict`, no test framework. New behavior gets a test. ESLint allowlists node:test's `describe`/`it` for `no-floating-promises`, so don't `await` them.
- Relative imports use the real `.mts` extension (`import … from './app.mts'`); Node requires it, and `allowImportingTsExtensions` permits it.
- CI: third-party actions are pinned to a full commit SHA with a `# vX.Y.Z` comment; GitHub-owned actions (`actions/*`) are pinned to a major tag. Dependabot keeps both current. Don't rename CI job `name`s without updating branch protection.
- `public/` is vendored Mobirise output. Don't reformat it wholesale. Make targeted edits only; it's being replaced by templates. Put layout fixes in `public/assets/site/overrides.css`, targeting block-type classes (`footer3`, `contacts01`) rather than `cid-*` hashes.
- **Never hard-code values that live in settings.** Links built from settings go in markup as `<a data-site-link="<name>" href="#">`; `renderPage` fills them from `src/site.mts`, and an unknown name fails the render. New settings go in `content/site.yaml` + `parseSite()` + a test.
- Caching: the export fingerprints every `assets/…` reference in HTML (`?v=<sha256 prefix>`), and `/assets/*` is served `immutable` for a year. Files referenced only from CSS (fonts) aren't fingerprinted, so never modify one in place; add a new filename. The dev server revalidates un-hashed files, so a normal reload shows edits.
- **Images committed to the repo:** enforced by `npm run check:images` (limits and exceptions in `content/site.yaml` → `images`). JPEG, at most 1200 px on the long edge, quality ~82, progressive, metadata stripped; larger only via an exception with a reason. Use PNG only for logos or images that need transparency. Git history keeps every version of a file forever, so optimize *before* committing. Example: `convert in.png -auto-orient -resize '1200x1200>' -strip -quality 82 -interlace JPEG out.jpg`. Don't commit duplicate files; reference one shared file instead (e.g. every page's `og:image` is `assets/images/social-preview.png`, as an absolute URL).

### Commits, PRs, and versioning
`main` is branch-protected: **all changes go through a PR on a branch**, required CI checks must pass before merge, and PRs are squash-merged. Never commit or push to `main` directly, and never bypass or weaken protection or required checks to get a change in. If a check is wrong, fix the check in its own PR.

Conventional Commits; the PR title becomes the squash commit message and is checked by `.github/workflows/pr-title.yml`. If you change the allowed types, update that file, this table, and README → Versioning together. The version is bumped automatically. **Never edit `version` in `package.json` by hand.**

| Type | Use for | Release |
|---|---|---|
| `content:` | Text, photos, members, teams | patch |
| `theme:` | Color *value* changes in `theme.yaml` | patch |
| `fix:` / `perf:` / `revert:` | Bug fixes / performance / reverting a change | patch |
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

### Roster privacy
- Never create a lasting record that someone was removed rather than made alumni: no labels, tags, files, YAML fields, commit-message keywords, or PR-text tokens. Git history showing a file deleted is acceptable.
- The roster check's override is the `workflow_dispatch` "Approve roster removal" action: officer allowlist in the repository variable `ROSTER_OFFICERS` (settings, not a file), which sets a success status on the PR's head SHA. It's invalidated by new commits and leaves only an Actions run log that expires.

## Don't
- Don't push, deploy, or apply manifests to a real cluster unless the human explicitly asks.
- Don't change `.gitignore`, CI workflows, ESLint/TS config, or Kustomize base without saying so in your summary.
- Don't implement items marked **on hold** in the project log (e.g. Beeble rendering).
