# Project log

Running list of decisions and deferred work. Newest decisions first. Move a TODO to **Done** (with the date) rather than deleting it.
When a decision changes conventions, commands, or layout, update [AGENTS.md](../AGENTS.md) and the README in the same change.

## Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-09-23 | Calendar: source is the revived shows-only **"Hive Shows - Website Calendar"**; page shows a **month grid with an upcoming-shows list under it**; each show shows its Google Calendar **description** and its own **add-to-calendar** link; homepage features the **next show** (falls back to "Come See Us!"). Freshness: up to a week is acceptable, so a **daily scheduled rebuild** is plenty (no visitor-side JavaScript needed). **Build deferred** | User answers to calendar questions; a live API would be overkill for the required freshness |
| 2026-09-23 | Images are limited per class by folder (`portraits` = `members/` 1080 px / 225 KB, sized for the large card so anyone can be promoted; `team-photos` = `teams/`; `other`), all classes required; portraits and team photos have naming rules. Team names are format-checked only | Every image has a limit; teams rename about yearly, so name ↔ data checks wait for a rename procedure |
| 2026-09-23 | **Framework: Astro** (approved). Rationale recorded in README → Architecture | Content-heavy site maintained by non-coders: typed content collections, zero-JS default, static-first with optional Node adapter |
| 2026-09-23 | Roster-removal override = officer-run `workflow_dispatch` ("Approve roster removal") that sets a status on the PR head SHA; officer allowlist in repo variable `ROSTER_OFFICERS`. No labels, tokens, or files | No lasting record of removals beyond git history; approval can't be self-granted by typing text; invalidated by new commits |
| 2026-09-23 | Mailing-list form drift check: daily scheduled + on PRs touching form settings; not a required check | Catches deleted/re-created Google Form questions without letting a Google outage block merges |
| 2026-09-23 | Repository is **private** for now; may be made public later (portfolio). Review history before publicizing | Roster history, including removals, would be public |
| 2026-09-23 | Calendar: **build-time render from the public Google Calendar ICS** (approved). Mailing list: **native themed form posting to the existing Google Form** (approved) | Editors keep using Google tools; site gets themed UI |
| 2026-09-23 | All footers charcoal `#232323` (matching home); was purple on 5 of 7 pages | Consistency; user choice |
| 2026-09-23 | Caching: content-hash fingerprints on asset URLs at export + immutable `/assets/*`; HTML always revalidates. No "disable cache" switch | Stale assets become impossible rather than bypassable; a page query param can't affect subresource caching anyway |
| 2026-09-23 | Settings-driven values (calendar ID) live in `content/site.yaml`, referenced from markup via `data-site-link` | No hard-coded IDs/URLs in pages |
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
- [ ] Members data location: `content/members/` now, or wait for the Beeble/`handbook/` decision.
- [ ] GitHub home for this repo (personal or Hive org). CI, Pages, CMS, and GHCR all depend on it.
- [ ] Content PR policy: auto-merge on green checks vs require one approval.
- [ ] **Officers:** should "Hive Society 2025 Official Calendar!" stay public? Audited 2026-09-23: it mixes shows with internal events (meetings, socials at "Hive House", "Survivor Night", a constitution meeting, trips, tentative dates); titles/dates only, no descriptions, attendees, or residential addresses. It's discoverable because Indify's public widget config exposes all three connected calendar IDs plus the account address. Unlisting steps: secret iCal link or Google Group.

### Theme
- [ ] Theme build step: `content/theme.yaml` → generated `:root { --group-key: … }` CSS (`themeToCssVariables` exists; nothing consumes it yet). Lands with Astro.
- [ ] Theme validator: also check team `id`s exist in team data. **Blocked** on a team-rename procedure (teams rename about every year or semester). *(Format, kebab-case, list shape, and unique ids are done.)*
- [ ] Contract-break check (CI): fail if a theme key or content field is removed/renamed without a `!` / `BREAKING CHANGE` PR title.
- [ ] Contrast check (CI): WCAG AA for each text/background pair (e.g. `buttons.text` on `buttons.background`, each `teams.*`).
- [ ] Fix `links.text` (`#ffa600` on `#ffeb69` fails contrast).
- [ ] In-browser theme editor with live preview and contrast warnings (Tier 2 in the audit).

### CMS
- [ ] Add `public/admin/index.html` + `public/admin/config.yml` (Sveltia).
- [ ] Deploy the OAuth client (Sveltia CMS Authenticator on Cloudflare Workers) and register a GitHub OAuth app.
- [ ] Enable `publish_mode: editorial_workflow` so edits become PRs that run CI.
- [ ] Collections: theme, site settings (nav/footer/socials/contact), members, teams, events.
- [ ] Media folders: member photo uploads go to `public/assets/images/members/` named from the member's name, team photos to `teams/` (so editors can't upload `IMG_1234.jpg`).
- [ ] Mirror validator rules as field `pattern`s (hex colors, kebab ids, image names) so editors see errors before saving; CI still enforces.
- [ ] Commit message templates that satisfy the PR-title / Conventional Commits check.

### CI / testing
- [ ] Roster check: a member removed from the active roster must appear in alumni (graduated *or* left); override via the officer-run "Approve roster removal" workflow (see decision). Needs members as data first. Set `ROSTER_OFFICERS` repo variable; consider short Actions log retention.
- [ ] Member ↔ portrait check: every member entry has a portrait (or an explicit "no photo") and every portrait belongs to a member; member ID = portrait base name. Not for teams until there's a rename procedure (rename photo, theme id, and data together; decide what happens to old names/alumni pages).
- [ ] Playwright: functional tests across viewports (phone + desktop).
- [ ] Playwright + axe: accessibility checks per page.
- [ ] Playwright visual regression with screenshot diffs posted to the PR.
- [ ] Lighthouse CI budgets (performance, a11y, page weight).
- [ ] Per-PR preview deploys (Cloudflare Pages branches) linked from the PR.
- [ ] Plain-language PR summary bot for non-coders.
- [ ] release-please config: `changelog-sections` making `content`, `theme`, `refactor`, `build`, and `deps` visible (so they cut patch releases); release → GHCR tag → prod overlay. *(Dependabot `deps`/`ci` prefixes and PR-title lint are done.)*
- [ ] CODEOWNERS: `content/**` editors vs `src/**`, `kube/**`, `.github/**` developers.

### Site
- [ ] **Calendar page (on hold, decided 2026-09-23):** replaces Indify, which is blank today (its `checkedCalendars` is the account's private primary calendar; no events in any month, Sep 2023 → Sep 2026). Build-time from the shows calendar's ICS (parser must handle recurrence + timezones, e.g. `node-ical`). Month grid + upcoming-shows list under it; per show: title, date/time, venue, **description**, **add-to-calendar** link.
- [ ] **Scheduled rebuilds** (with the calendar page): Pages deploy hook stored as `PAGES_DEPLOY_HOOK` secret; daily GitHub Actions cron POSTs to it (redeploy only if the feed changed).
- [ ] **Homepage "Next show" (on hold):** next upcoming show from the same data replaces "Come See Us!"; falls back to it when nothing is scheduled.
- [ ] After the calendar page ships: remove Indify and revoke its access to the Hive Google account. Officers: move upcoming shows into "Hive Shows - Website Calendar".
- [ ] Mailing list: native themed form → Google Form `formResponse`, entry IDs from `content/site.yaml` (drift check already runs), replacing the iframe.
- [ ] Manually verify the "Add to Google Calendar" link while signed in to a Google account (can't be checked by CI).
- [ ] **Expand the About page.** It's two paragraphs beside a large photo. Ideas: what long-form improv is, how the society works (NewBee → core teams, electives), how auditions work, a short history/lineage timeline (from teams data), FAQ, a video.
- [ ] Hero sizing: cap the homepage hero at ~65vh (it currently dominates the fold).
- [ ] Responsive images at export: AVIF/WebP variants, `srcset`/`sizes`, `loading="lazy"`. Sources are already within `image-limits`.
- [ ] Nav/footer into a shared layout; members and teams as data with a responsive grid (see audit §5). Lands with Astro.
- [ ] Accessibility fixes: `<main>` landmark, heading order, stable anchors (`lang` and labelled social links are done).

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

### Astro migration (on hold)
- [ ] Scaffold Astro (TypeScript strict) alongside the current site; port layout (nav/footer) and one page first to validate the approach.
- [ ] Content collections + schemas: members, teams, events; theme.yaml → CSS custom properties; site.yaml → settings.
- [ ] Port pages; retire `public/` Mobirise pages, `src/render.mts` fingerprinting, and `overrides.css`.
- [ ] Keep the Node server path via `@astrojs/node` only if a dynamic feature needs it.

### Housekeeping
- [ ] **On hold:** create the GitHub remote; enable branch protection / ruleset on `main` (required checks, PR required, squash-only, no force-push). A private repo on GitHub Free can't enforce it: get GitHub Pro (Student Developer Pack) or host under an org on Team.
- [ ] Set the real GHCR owner in `kube/overlays/prod/kustomization.yaml`.
- [ ] Private repo ⇒ private GHCR images: add `imagePullSecrets: [{name: ghcr-pull}]` to the prod overlay (patch) and create the secret (see docs/CONTAINERIZATION.md).
- [ ] Create the Cloudflare Tunnel and the `cloudflared-token` Secret.

## Done
- 2026-09-23: Project log cleanup. Resolved: calendar source (shows-only "Hive Shows - Website Calendar", see Decisions) and rendering engine (Astro). Merged duplicate Indify/iframe, image-sizing, and theme-CSS items; mailing-list drift check marked done within its item.
- 2026-09-23: Member portraits resized to 1080 px (5.4 MB → 4.8 MB, max 199 KB); `image-limits.portraits` tightened to 1080 px / 225 KB. Sized for the large half-width card (~540 CSS px at 2×) so any member can be promoted into one. Homepage hero → `homepage-group-photo.jpg`, About photo → `about-group-spiral-photo.jpg`. Decided: no team-name ↔ team-data check until there's a rename procedure (teams rename ~yearly).
- 2026-09-23: Team photos/logos moved to `public/assets/images/teams/<team-id>.jpg|png` (9 files, ids match `theme.yaml` teams where present), naming enforced by `check:images`; fixed `alt` text (7 of 9 said "DeMarcus Blackington", one named the wrong team). `image-limits` split into per-class sections (`portraits`, `team-photos`, `other`), all required, unknown sections rejected.
- 2026-09-23: Member portraits moved to `public/assets/images/members/firstname-lastname.jpg` (41 files), naming enforced by `check:images`. Fixed wrong `alt` text on 38 of 41 portraits (Mobirise copy-paste named the wrong person). `site.yaml` key `images` → `image-limits`.
- 2026-09-23: Image check in CI (`npm run check:images`, `src/images.mts`): 1200 px / 300 KB limits, exceptions with reasons in `content/site.yaml → images`, duplicate detection, stale-exception detection. Hero and social-preview listed as exceptions.
- 2026-09-23: RUNBOOK rewritten for a basic-developer audience (what lint/typecheck/tests/export do and why; how the pieces fit; versions & releases with every PR-title type and examples; images; roster changes & override; CI explained). Containers/Kubernetes/GHCR/Tunnel moved to optional `docs/CONTAINERIZATION.md` with rationale. Docs test also enforces PR-title types.
- 2026-09-23: RUNBOOK §6 "Tests and checks": every test file (what it guarantees, case count), every CI job (runs / when / blocks merging), coverage gaps. Docs test now also requires each test file to be listed.
- 2026-09-23: RUNBOOK dependency tables (required: Node 24, git; optional by task: Docker, kubectl, k3d, ImageMagick, kustomize, kubeconform, gh). Local k3d flow verified end to end (Traefik ingress at hive.localhost:8081, read-only pod as UID 1000, rollout restart).
- 2026-09-23: `docs/RUNBOOK.md`: setup, all npm scripts with options, change workflow, deploys (Pages, container, k3d, prod k3s), one-time GitHub/Cloudflare/Google setup, CI-failure guide, maintenance calendar, troubleshooting. `test/docs.test.mts` fails if an npm script is undocumented. README/AGENTS point to it.
- 2026-09-23: Mailing-list config in `content/site.yaml`; `src/forms.mts` (Google Form structure parser + drift comparison) with tests; `npm run check:form`; `form-drift.yml` workflow. Live form verified: 3 questions, IDs match.
- 2026-09-23: Calendar audit: public calendars, Indify config exposure, Indify blank due to private primary calendar + free-tier 1-month-back/3-month-ahead window. Unlisting steps given to officers (secret iCal link or Google Group).
- 2026-09-23: Asset fingerprinting in export + immutable caching; server cache policy (`?v=` immutable, else revalidate with Last-Modified/304); Docker image now serves the exported `dist/` (multi-stage).
- 2026-09-23: `content/site.yaml` + `data-site-link` rendering; calendar page gets "Add to Google Calendar" / "Apple / Outlook" buttons built from the calendar ID.
- 2026-09-23: All footers charcoal; `theme.yaml` `footer.background` updated to match.
- 2026-09-23: `EDITING.md` (non-coder guide). `package.json` cleaned: bogus `dependencies` removed, `yaml` is the only runtime dependency, `private: true`.
- 2026-09-23: Layout fixes (`public/assets/site/overrides.css`): footer padding (453 → 277 px), sticky footer on short pages, contact page tightened (no scroll at 1920×1080), mailing-list form frame sized to the form (no inner scrollbar). Homepage hero cropped (top 30% ceiling removed; 912 → 645 px tall at full HD).
- 2026-09-23: CI (`.github/workflows/ci.yml`): lint, typecheck, theme validation, `node:test` suites, static export artifact; Kustomize + kubeconform on every overlay; Docker build + smoke test under pod constraints. PR-title check (`pr-title.yml`); Dependabot (`deps:` / `ci:` prefixes).
- 2026-09-23: Tests: server routing/traversal/methods, theme rules, local link and asset check across all pages. Server split into `src/app.mts` (testable) + `src/server.mts` (entry).
- 2026-09-23: Mobirise cleanup on all pages: removed builder badge (1×1 spacer GIF, inline styles, mobiri.se links), generator/IE meta, editor-only attributes, unused YouTube-background script, per-page `?v=` CSS cache-busters and redundant preload. Added `lang="en"`, accessible names on icon links, `rel="noopener"`. Screenshots were pixel-identical before/after apart from the removed 64 px badge strip.
- 2026-09-23: ESLint 10 flat config + typed linting; `tsconfig.json`.
- 2026-09-23: Kustomize base + `local` / `prod` overlays.
- 2026-09-23: Live site mirrored into `public/`; Node static server; `npm run export`.
- 2026-09-23: Site audit (`docs/site-audit.md`); `content/theme.yaml` seeded from current colors.
- 2026-09-23: README (theme rules, versioning policy, contributing); `AGENTS.md` + `CLAUDE.md` pointer; this log.
- 2026-09-23: Images optimized 54 MB → ~7 MB; the 7 identical per-page `*-meta.png` social images (missing from the mirror) merged into one `social-preview.png`, referenced by absolute URL (crawlers ignore relative `og:image`).
