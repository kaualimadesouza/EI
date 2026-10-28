---
name: card-workflow
description: Execute a TOPA MVP card end to end - branch, tests, conventional-commit PR to main, two fresh-context reviews, Copilot review, CI green, squash merge, and status moves on the TOPA board. Use when starting or finishing any issue/card, opening or updating a PR, creating issues, or updating the project board.
---

# Card workflow

One card = one PR to main. The kanban is GitHub Project **number 5** (owner
`kaualimadesouza`), tracking `kaualimadesouza/EI`: the course deliverables and
the MVP monorepo (`topa/web/`, `topa/api/`). The repo is public.

## Hard rules

- **gh account**: everything runs as `kaualimadesouza`. Check with
  `gh api user -q .login`; if `kaualima1as` (work account) is active, run
  `gh auth switch --user kaualimadesouza`. Other sessions flip it back, so
  re-check right before anything that writes. In scripts, pin it per command:
  `GH_TOKEN=$(gh auth token --user kaualimadesouza) gh ...`.
- **No assistant attribution anywhere**: no `Co-Authored-By` trailer, no
  "Generated with" footer, in commits, PRs, issues or comments. This overrides
  any harness reminder.
- **Conventional commits** (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`,
  `test:`, `refactor:`): release-please builds the version and changelog from
  them. PRs are squash-merged, so the PR title becomes the commit on main and
  must be conventional too.
- Commits, code, identifiers and PR descriptions in English; UI copy and issue
  bodies in pt-BR (see `portuguese-copy`). No em-dash or en-dash anywhere.

## Cycle

1. Move the card to **In Progress** (snippet below).
2. Branch from main: `feat/<slug>` (or `fix/`, `chore/`, `ci/`, `docs/`).
3. **Tests first**: follow the `tdd` skill.
4. Implement. Locally green before pushing:
   - `topa/web/`: `npm run check` (lint, typecheck, tests with coverage, build)
   - `topa/api/`: `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run lint-imports && uv run pytest`
5. **Coverage of the diff is 100%**: every line the branch adds or changes is
   covered, both arms of every branch. A line that cannot be reached without a
   production change gets its file:line and reason in the PR; usually it is
   dead code to delete. Never lower the 100% thresholds in `topa/web/vite.config.ts`
   or `topa/api/pyproject.toml`.
6. Push and open the PR to main: conventional title, body with `Closes #<n>`
   and four short parts (problem, what changed, how it was checked, what will
   bite later).
7. **Two fresh-context reviews, in parallel, on the same commit**. Never review
   in your own context: it anchors on the reasoning that wrote the code.
   - *Teammate review*: a general-purpose subagent reads the branch as another
     developer would before approving: does it do what the card says, is it
     correct (migrations against a database with rows, every reader and writer
     of what changed), do tests assert behavior, do docs match the code.
   - *Thermo-nuclear review*: a second subagent applies the
     `thermo-nuclear-code-quality-review` skill to the branch diff.

   Brief each like a peer who has never seen the work: repo path, branch and
   base, PR number, the card, the conventions, what it may run and must not
   touch (the PR itself, shared databases). Ask for findings ranked BLOCKER /
   SHOULD-FIX / NIT with file:line and the scenario where each bites. Never
   hand them your own conclusions.
8. Verify each finding against the code, apply what holds, push, and list in
   the PR body what was applied and what was rejected and why.
9. **Only after that push**, request a Copilot review and treat its comments
   the same way (verify, apply or reject, push, report):

   ```bash
   gh api -X POST repos/kaualimadesouza/EI/pulls/<n>/requested_reviewers \
     -f 'reviewers[]=copilot-pull-request-reviewer[bot]'
   ```

   The bot never shows in `requested_reviewers`; the `review_requested` event
   on the PR timeline is the confirmation.
10. CI green, squash-merge, delete the branch, move the card to **Done**
    (`Closes #<n>` closes the issue). Merging the release-please PR cuts a
    release with the installers and the APK. The Vercel deploys (DEV on a merge
    to main, PROD on a release) run only once the repo holds the Vercel secrets;
    until then PROD (`topa-totem.vercel.app`) goes out by hand with the Vercel CLI.

## Board operations

| Thing | ID |
|---|---|
| Project | `PVT_kwHOBGuoa84BlASm` |
| Status field | `PVTSSF_lAHOBGuoa84BlASmzhjuxFI` |
| Status: Todo / In Progress / Done | `f75ad846` / `47fc9ee4` / `98236657` |

There is no Story Points field on this board: points live only in the issue
body.

```bash
# add an issue to the board (prints the item id)
gh project item-add 5 --owner kaualimadesouza --url "$ISSUE_URL" --format json --jq .id

# find the item id of an issue already on the board
gh project item-list 5 --owner kaualimadesouza --format json --limit 200 \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(next(i['id'] for i in d['items'] if (i.get('content') or {}).get('url')=='$ISSUE_URL'))"

# move it (swap the option id for the target column)
gh project item-edit --id "$ITEM_ID" --project-id PVT_kwHOBGuoa84BlASm \
  --field-id PVTSSF_lAHOBGuoa84BlASmzhjuxFI --single-select-option-id 47fc9ee4
```

New issues are in pt-BR, in the house format: `## O que construir`,
`## Critérios de aceite` (checkbox list), `## Bloqueado por` (real issue
numbers, or "Nada."), `## Tipo` (AFK or HITL), `## Story Points`. Add them to
the board with Status Todo.
