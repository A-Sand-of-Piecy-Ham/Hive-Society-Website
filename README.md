# Hive Society Improv website

Source for [hivesocietyimprov.com](https://hivesocietyimprov.com/), the site for UIUC's long-form improv society.

Today the site is the original Mobirise export (in `public/`), served by a small Node server or exported as static files. The plan is to move text, member lists, and colors into editable files so non-coders can update the site. See [docs/PROJECT_LOG.md](docs/PROJECT_LOG.md) for what's done and what's next.

**Not a developer?** Start with [EDITING.md](EDITING.md): what you can change, where, and how to see your change.

## Architecture

| Layer | Choice |
|---|---|
| Site framework | **[Astro](https://astro.build/)** (migration from the legacy site builder export in progress) |
| Language / runtime | TypeScript on Node 24 (native type stripping, no build step for tooling) |
| Content | YAML + Markdown in git, schema-validated; edited by non-developers through **[Sveltia CMS](https://github.com/sveltia/sveltia-cms)** |
| Hosting | Static output on **Cloudflare Pages**; portable **Kubernetes** path (k3s + Kustomize + Cloudflare Tunnel) for self-hosting |
| CI/CD | GitHub Actions: lint, typecheck, unit tests, manifest validation, container smoke test, content checks; release automation via Conventional Commits |

### Why Astro

The site is mostly content: shows, members, teams, and the society's history. It's maintained by rotating student officers, most of whom don't code. The framework had to fit that, rather than a typical web app. Candidates were **Astro**, **Next.js**, **Eleventy**, and extending the existing hand-rolled renderer.

- **Content collections with schemas.** Members, teams, and events are typed, validated data. A typo from the CMS fails the build with a readable error instead of breaking a page in production.
- **Zero JavaScript by default, interactivity where it matters.** Pages ship as static HTML. Interactive pieces (member filters, the live show calendar) are isolated "islands", keeping pages fast on phones.
- **Static-first, server-optional.** The default output deploys directly to Cloudflare Pages. A Node adapter serves the same site from the Kubernetes deployment if dynamic features are needed later.
- **Built-in asset pipeline.** Image resizing, modern formats, and content-hashed filenames replace the custom fingerprinting and manual image optimization this project started with.

**Next.js** was the main alternative. Its strengths (per-request rendering, auth, app-style interactivity) aren't requirements here. Its static export gives up most of them, and it would ship a React runtime to every visitor of an otherwise static site. **Eleventy** fit the static side well but offered no typed content schema or component islands.

## Quick start

Requires Node 24+.

```bash
npm ci
npm start            # http://localhost:8080
```

**Every command, deployment, and setup step is in [docs/RUNBOOK.md](docs/RUNBOOK.md)**: npm scripts, making a change, Cloudflare Pages / container / Kubernetes deploys, one-time GitHub and Cloudflare setup, what to do when CI fails, and routine maintenance.

## Layout

```
content/theme.yaml   site colors (see "Theme" below)
content/site.yaml    site settings (e.g. the public Google Calendar ID); pages reference them by name
public/              the website: HTML pages, images, CSS
src/                 Node server (server.mts entry, app.mts handler), page rendering (render.mts),
                     site settings (site.mts), theme validation (theme.mts)
scripts/             static export → dist/, theme validator CLI
test/                node:test suites
.github/             CI workflows, PR-title check, Dependabot
kube/                Kubernetes manifests: base/ plus overlays/local (k3d) and overlays/prod (k3s + Cloudflare Tunnel)
docs/                RUNBOOK.md (all commands and procedures), PROJECT_LOG.md, site audit
EDITING.md           guide for non-coders (keep it accurate when what's editable changes)
AGENTS.md            instructions for AI coding agents (keep it updated when conventions change)
```

## Theme

All site colors live in **[content/theme.yaml](content/theme.yaml)**. It's grouped by part of the site:

```yaml
navigation:
  background: "#ffffffcc"
  text: "#593269"
buttons:
  background: "#593269"
  text: "#ffffff"
teams:
  - id: usuc
    background: "#ffdd00"
    text: "#593269"
```

### The rules, and why

1. **Name the place, not the color.** Keys describe *where* a color is used (`navigation.background`, the `usuc` team's `background`), never *what* it is (`purple`, `dark`, `accent-2`) and never a code name (`h1`, `.btn`).
   *Why:* if there's a key called `purple`, everyone reaches for it and the site slowly turns generic. Naming the place makes each decision specific: "what should the USUC background be?"
2. **Always a real hex value.** Write `"#593269"` (or `"#593269cc"` with transparency). No `red`, no pointing one key at another.
   *Why:* every key stands alone, so you can read the file and know exactly what each part looks like.
3. **Repeating a color is fine.** If the nav text and the button background are both `#593269`, write it twice.
   *Why:* they happen to match today. When someone wants different buttons later, they change one line and nothing else moves.
4. **Adding a team:** copy an existing entry under `teams:`, change its `id` to the team's id (the same id used in the team list), and pick its colors.

Each key becomes a CSS variable made from its path (`navigation.background` → `var(--navigation-background)`; the team with `id: usuc` → `var(--teams-usuc-background)`). The site's CSS only uses those variables, so it never has hard-coded colors. *(This hookup isn't built yet; see the project log.)*

Soon you'll be able to edit this file (and member lists, text, etc.) with a point-and-click editor, and automatic checks will warn when text and background colors are too close to read.

## Contributing

The repository is **private** (it holds roster history). It may be made public later; before that, review history for anything that shouldn't be public.

**`main` must be branch-protected, with CI gating merges.** Nobody pushes to `main` directly. Every change, including edits made through the site editor, lands through a pull request that:

- passes all required CI checks. Today those are **Lint, typecheck, test**, **Kubernetes manifests**, **Container image**, and **Conventional PR title**; UX/accessibility checks will be added,
- has a Conventional Commits title (see Versioning; the title becomes the squash-merge commit and decides the version bump),
- is squash-merged (linear history, one commit per PR),
- for code, infrastructure, or CI changes, has a developer's approval (content-only PRs may auto-merge on green; see the project log).

Set this up in GitHub → Settings → Rules → Rulesets as soon as the repo has a remote. **Note:** on a *private* repository, branch protection and rulesets require GitHub Pro/Team (free for students via the GitHub Student Developer Pack); on GitHub Free they only work for public repos. Until protection is enforced, still work on branches.

## Versioning

Versions follow [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`) and are bumped **automatically** from commit / PR titles ([Conventional Commits](https://www.conventionalcommits.org/)). Nobody edits the version number by hand. *(Automation is planned; see the project log.)*

For a website, "breaking" means breaking something **someone else relies on**: editors' content files, the theme keys, public URLs, or the deployment setup.

| Bump | When | PR title starts with |
|---|---|---|
| **Patch** `1.4.2 → 1.4.3` | Content edits (text, photos, members, teams), color value changes, bug fixes, performance, internal code restructuring, container/build changes, dependency updates, reverts | `content:` `theme:` `fix:` `perf:` `refactor:` `build:` `deps:` `revert:` |
| **Minor** `1.4.3 → 1.5.0` | New capability that doesn't break anything: a new page, component, CMS section, or a *new* theme key / content field | `feat:` |
| **Major** `1.5.0 → 2.0.0` | Breaking changes: removing or renaming a theme key or content field, changing page URLs, or a change that needs manual deployment steps (new secret, new cluster, new site engine) | `feat!:` / `fix!:` or a `BREAKING CHANGE:` note |
| *No release* | Changes that can't affect how the running site behaves: tests, CI, docs, formatting, repo housekeeping | `test:` `ci:` `docs:` `style:` `chore:` |

A big internal rewrite is **not** automatically major. What decides the bump is the effect on those contracts. A rewrite that keeps every URL, theme key, and content field working is a `refactor:` (patch), or a `feat:` if it adds something.

The test is **regression risk**, not whether code was touched: if a change could make the deployed site behave or look different, even by accident, it gets at least a patch, so a regression can be traced to the release that introduced it. Refactors, build/image changes, and dependency updates all qualify. Formatting-only (`style:`) and test-only (`test:`) changes edit code too, but can't change what the running site does, so they don't cut a release. Edits made through the site editor (CMS) get a `content:` or `theme:` title automatically.

## Caching

There's no "disable cache" switch because there's nothing stale to bypass:

- **Pages** (HTML) are always revalidated.
- **Assets** referenced from pages get a content hash in their URL at export (`style.css?v=3fa9c1…`), so a changed file has a new URL and everything else can be cached for a year.
- The dev server (`npm start`) marks un-hashed files as revalidate-on-every-load, so local edits show on a normal reload.

A `?nocache` page parameter couldn't do this anyway: stylesheets and images are separate requests with their own URLs, which a page's query string doesn't touch. One rule follows: files referenced only from CSS (fonts) aren't hashed, so never edit one in place. Add a new filename.

## Deploying

- **Static, current:** `npm run export`, then upload `dist/` (e.g. `npx wrangler pages deploy dist`).
- **Kubernetes:** see the comments at the top of `kube/overlays/local/kustomization.yaml` (local k3d) and `kube/overlays/prod/kustomization.yaml` (production k3s behind a Cloudflare Tunnel).
