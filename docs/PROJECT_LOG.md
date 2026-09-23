# Project log

Running list of decisions and deferred work. Newest decisions first. Move a TODO to **Done** (with the date) rather than deleting it.
When a decision changes conventions, commands, or layout, update [AGENTS.md](../AGENTS.md) and the README in the same change.

## Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-09-23 | `main` is branch-protected with required CI checks and squash merges; all changes land via PRs | CMS PRs, CI gating, and PR-title-driven versioning all rely on it |
| 2026-09-23 | Source images normalized before the first commit: JPEG, ≤1200 px (hero 1920), q82, metadata stripped; opaque PNGs converted to JPEG | Git keeps every blob forever, so the 54 MB originals were kept out of history (now ~7 MB) |
| 2026-09-23 | `AGENTS.md` is the canonical agent guide and is updated alongside convention changes | Heavy agentic development expected; stale guidance compounds |
| 2026-09-23 | Versioning: SemVer driven by Conventional Commits (release-please). Patch = `content`/`theme`/`fix`/`perf`/`refactor`/`build`/`deps` (anything with runtime regression risk gets a version, so regressions are traceable; formatting/test-only changes don't); no release = `test`/`ci`/`docs`/`style`/`chore`; minor = `feat`; major = breaking a contract (content/theme schema, URLs, manual deploy steps). Table in README | Automatic, no hand bumps; "architecture change" reframed as "contract break" to match SemVer practice |
| 2026-09-23 | `theme.yaml` teams are a **list** of `{ id, background, text }` (option A) | CMS list widgets let editors add teams; `id` links to team data |
| 2026-09-23 | Theme colors live in `content/theme.yaml` with **semantic, per-component keys and literal hex values**. No palette names, no CSS selectors, no cross-references | Editors otherwise default to generic colors instead of designing a palette for the site. Duplicated values are fine so components can diverge later |
| 2026-09-23 | Theme and content are stored **in git** (YAML), not in a runtime KV store or database | History, rollback, PR previews, and CI checks (contrast) on every edit; no server dependency |
| 2026-09-23 | CMS: **Sveltia CMS** (git-based, Decap-compatible config), tentative | Form UI for non-coders, color widget, editorial workflow turns edits into PRs, runs entirely in the browser |
| 2026-09-23 | **Proposed, pending managers:** Beeble is the source of truth for members & teams as *structured YAML* (not prose) that both Beeble and the site render; Beeble moves into this repo as `handbook/` (monorepo) so one CMS/CI covers both | Managers want Beeble as SoT; a monorepo avoids cross-repo sync and a second CMS/auth |
| 2026-09-23 | Beeble stays a separate site for now (https://mirth.cc/beeble/, repo `lumirth/beeble`, mdBook) | Deferred; see TODO |
| 2026-09-23 | Hosting: k3s in prod and k3d locally; Kustomize base + overlays; Cloudflare Tunnel for ingress; images on GHCR | Portability across self-hosting, DO Droplets, and DOKS with minimal changes |
| 2026-09-23 | Static export (`npm run export` → `dist/`) is the interim deploy for Cloudflare Pages | The site is fully static today |

## TODO

### Decisions needed
- [ ] GitHub home for this repo (Hive org?). CI, CMS, and GHCR all depend on it.
- [ ] Rendering engine for templated pages (Astro recommended; see `docs/site-audit.md` §4).
- [ ] Content PR policy: auto-merge on green checks vs require one approval.

### Theme
- [ ] Theme build step: `content/theme.yaml` → generated `:root { --group-key: … }` CSS, consumed by templates.
- [ ] Theme validator (CI): every value is `#rrggbb`/`#rrggbbaa`; keys match the schema; no unknown groups; team `id`s unique and present in team data.
- [ ] Contract-break check (CI): fail if a theme key or content field is removed/renamed without a `!` / `BREAKING CHANGE` PR title.
- [ ] Contrast check (CI): WCAG AA for each text/background pair (e.g. `buttons.text` on `buttons.background`, each `teams.*`).
- [ ] Fix `links.text` (`#ffa600` on `#ffeb69` fails contrast).
- [ ] In-browser theme editor with live preview and contrast warnings (Tier 2 in the audit).

### CMS
- [ ] Add `public/admin/index.html` + `public/admin/config.yml` (Sveltia).
- [ ] Deploy the OAuth client (Sveltia CMS Authenticator on Cloudflare Workers) and register a GitHub OAuth app.
- [ ] Enable `publish_mode: editorial_workflow` so edits become PRs that run CI.
- [ ] Collections: theme, site settings (nav/footer/socials/contact), members, teams, events.
- [ ] Commit message templates that satisfy the PR-title / Conventional Commits check.

### CI / testing
- [ ] GitHub Actions: lint, typecheck, `node:test` unit tests, export build, Docker build.
- [ ] `kubectl kustomize` + kubeconform on both overlays.
- [ ] Playwright: functional tests across viewports (phone + desktop).
- [ ] Playwright + axe: accessibility checks per page.
- [ ] Playwright visual regression with screenshot diffs posted to the PR.
- [ ] Lighthouse CI budgets (performance, a11y, page weight).
- [ ] Per-PR preview deploys (Cloudflare Pages branches) linked from the PR.
- [ ] Plain-language PR summary bot for non-coders.
- [ ] release-please config: `changelog-sections` making `content`, `theme`, `refactor`, `build`, and `deps` visible (so they cut patch releases); Renovate/Dependabot configured to title PRs `deps:`, PR-title lint restricted to the README type list, release → GHCR tag → prod overlay.
- [ ] CODEOWNERS: `content/**` editors vs `src/**`, `kube/**`, `.github/**` developers.

### Site
- [ ] Responsive images at export: AVIF/WebP variants, `srcset`/`sizes`, `loading="lazy"`. Source images are already normalized (~7 MB total).
- [ ] Extract site settings (`site.yaml`) and move nav/footer into a shared layout.
- [ ] Members and teams as data; responsive grid layout (see audit §5).
- [ ] Accessibility fixes: `lang`, `<main>`, heading order, labelled social links, stable anchors.
- [ ] Replace the Indify calendar and Google Form iframes with native components.

### Beeble
- [ ] Confirm with managers: Beeble as SoT via structured data + monorepo (see decision above).
- [ ] Import `lumirth/beeble` history into `handbook/` (`git subtree add` or `git filter-repo`); archive the old repo with a pointer.
- [ ] Define member/team schema (`handbook/data/members/*.yaml`, `handbook/data/teams/*.yaml`); seed from the current site's members/teams pages.
- [ ] Generate Beeble roster/team pages from that data (preprocessor or pre-build script) so the handbook and the site never disagree.
- [ ] CMS collections for members/teams pointing at `handbook/data/`.
- [ ] Keep the handbook deploy at its own URL (decide: keep `mirth.cc/beeble/` or move to e.g. `handbook.hivesocietyimprov.com`).
- [ ] **On hold:** render Beeble's handbook prose as `/handbook` on this site.
- [ ] *If the monorepo is rejected:* transfer `lumirth/beeble` to the Hive org instead (keeps history and redirects), give it its own CMS instance, and have this site fetch its data at build time.
- [ ] Fix its deploy workflow: installs mdBook via rustup on cache miss; `actions/cache@v3` is deprecated.

### Housekeeping
- [ ] On creating the GitHub remote: enable branch protection / ruleset on `main` (required checks, PR required, squash-only, no force-push).
- [ ] `package.json`: remove the ESLint transitive tree from `dependencies`; drop stale `"main"`.
- [ ] Set the real GHCR owner in `kube/overlays/prod/kustomization.yaml`.
- [ ] Create the Cloudflare Tunnel and the `cloudflared-token` Secret.

## Done
- 2026-09-23: ESLint 10 flat config + typed linting; `tsconfig.json`.
- 2026-09-23: Kustomize base + `local` / `prod` overlays.
- 2026-09-23: Live site mirrored into `public/`; Node static server; `npm run export`.
- 2026-09-23: Site audit (`docs/site-audit.md`); `content/theme.yaml` seeded from current colors.
- 2026-09-23: README (theme rules, versioning policy, contributing); `AGENTS.md` + `CLAUDE.md` pointer; this log.
- 2026-09-23: Images optimized 54 MB → ~7 MB; the 7 identical per-page `*-meta.png` social images (missing from the mirror) merged into one `social-preview.png`, referenced by absolute URL (crawlers ignore relative `og:image`).
