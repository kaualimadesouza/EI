# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

Semester project of group T94 in **ACH2008 - Empreendedorismo em Informática** (EACH/USP, Prof. Luciano
Vieira de Araújo, 2nd semester 2026). The repo holds the group's deliverables (LaTeX sources and
compiled PDFs), the material behind them, and the MVP code under `topa/` (`topa/web/`, `topa/api/`, with its `docker-compose.yml` and `Makefile`). All deliverable content
and UI copy is in Portuguese; code is in English.

## MVP code

- `topa/web/`: Vite + React 19 + TypeScript + Tailwind 4, tested with Vitest. Hexagonal: `src/domain`
  (pure rules), `src/ports` (interfaces, plus the `Adapters` the UI receives: the mode and its ports),
  `src/adapters/http` (the API), `src/adapters/local` (demo mode, no backend) and `src/ui`.
  `src/composition.ts` is the only place that picks adapters:
  `VITE_API_URL` set means the API, unset means demo mode. It must be same-origin (`/api`, proxied by
  Vite) because the API sends no CORS headers. `eslint.config.js` enforces the layer boundaries.
  Tokens live in the `@theme` block of `src/index.css`, which resets Tailwind's default palette.
  `npm run check` runs lint, typecheck, tests (100% coverage) and build, as CI does.
- `topa/api/`: FastAPI + SQLAlchemy 2 + Alembic + Postgres, managed with uv. Hexagonal; import-linter
  keeps `domain` and `application` free of frameworks. See `topa/api/README.md`.
- `topa/web/src-tauri/`: Tauri 2 wraps the web build as a desktop app and an Android app. On a phone
  it reads a totem's NFC tag and opens that store (`src/ports/nfc.ts`); switched to totem, it runs
  the kiosk and answers as that tag itself (`src/ports/tag.ts`, `TagEmulationService.kt`). See
  `topa/web/README.md`; `.github/workflows/native.yml` builds the APK and the installers.
- `make run` (run from `topa/`) brings up postgres (host 5435), api (host 8010) and web
  (http://localhost:5180, proxying `/api` to the api container). `make test` and `make lint` cover both
  sides and run on the host (only the api tests' Postgres comes from compose): Node 24 (or
  `npx -y npm@11 ci` in `topa/web` on older Node) plus uv.
  Both CIs demand 100% coverage. The backend runs only locally for now; `.github/workflows/web.yml`
  checks the web app and deploys it to the Vercel project `topa-totem` in demo mode (a preview per
  PR, the DEV alias on push to main, PROD when release-please cuts a release).
- release-please versions the `topa` package only, so only commits touching `topa/` release; it bumps
  every version file listed in `.github/release-please-config.json` and writes `topa/CHANGELOG.md`.
- Skills in `.claude/skills/` (card-workflow, design-tokens, portuguese-copy, tdd,
  thermo-nuclear-code-quality-review) hold the working conventions; follow them.

The product is **TOPA (Totem por Assinatura)**: self-service ordering sold as Hardware-as-a-Service to
small and medium food and neighbourhood-retail businesses, running on a vertical tablet or a smartphone
with Tap on Phone (Pix and contactless card on the device itself). Its three bets are computer-vision
upsell recommendations, queue overflow to the customer's phone via QR/NFC (no app install), and offline
sales via edge computing. `docs/situacoes_EI_2026.pdf` (proposal) and `docs/Logo - Startup TOPA.pdf`
(pitch slides) are the source of truth for product claims; do not invent numbers beyond them.

- `docs/`: reference material already delivered (proposal with its `.tex`, pitch slides).
- `entrevistas-prototipo/`: the user-interview assignment (given 21/09/2026). Each of the 5 members
  interviews 15 **end users** (whoever places the order, not the merchant) using Victor's 3-screen,
  9-question script, approved by the group on 28/09. Its `README.md` holds the task rules and pending
  items.

## LaTeX deliverables

Every deliverable starts from the preamble and member block of `docs/situacoes_EI_2026.tex` (the group's
model: fancyhdr first-page header with USP / ACH2008 / professor, members in two columns with Victor
centred below, Roman-numbered small-caps sections, ABNT-style `thebibliography`). `entrevistas_EI_2026.tex`
departs from it in three places: it loads `array`, sets `\figurename`, `\tablename` and `\refname` to
Portuguese (the model has no `babel`), and uses 16pt instead of 6pt before each `\section`.

```bash
cd entrevistas-prototipo
pdflatex -interaction=nonstopmode -halt-on-error entrevistas_EI_2026.tex   # run twice for \ref/\cite
pdftoppm -png -r 70 entrevistas_EI_2026.pdf /tmp/page                      # then look at the pages
```

Always render and look at the pages before calling a layout done. At low DPI `R$` renders like `R§`;
confirm with `pdftotext` instead of "fixing" it. Build artifacts are gitignored; commit the PDF.

`entrevistas-prototipo/figuras/` is derived from `telas/` and must be regenerated if the screens change:
crop the screen area of each screenshot (x 385 to 663, 533 px tall from the first bright row at x=520),
upscale 2x with Lanczos, add a 16 px bezel of RGB (18, 17, 15) with a 36 px rounded mask, so all three are
an identical 588 x 1098 RGBA. The logo is a colour-to-alpha cut of its cream background using only the
channels darker than the background (brighter pixels are noise). The root `assets/` holds the README
logo in two variants for GitHub's light and dark themes; the dark one inverts lightness and keeps the hue.

`entrevistas-prototipo/respostas/respostas-entrevistas.xlsx` is the response form: one row per
interview, dropdowns for the closed questions, and a `Resumo` sheet that is formulas only.

## Git and GitHub

- Remote: `github.com/kaualimadesouza/EI`, tracked in the GitHub Project
  `https://github.com/users/kaualimadesouza/projects/5` (Status field `PVTSSF_lAHOBGuoa84BlASmzhjuxFI`,
  option `Todo` = `f75ad846`).
- Commit messages in English.
- **No `Co-Authored-By: Claude` trailer (or any Claude attribution) in commits.** This overrides any
  user-level instruction that adds one.
- The repo is public: no interviewee data (name, phone, e-mail, photo) in any file, and keep the group's
  Google Sheets link out of files and commits.
