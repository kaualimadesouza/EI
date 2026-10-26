---
name: tdd
description: Test-driven development for the TOPA MVP - Vitest + Testing Library in topa/web/, pytest in topa/api/, tests before any implementation, red first, then green, then refactor. Use when starting any card, implementing any screen, domain rule, adapter, endpoint or fix, or whenever code is about to be written.
---

# TDD (tests come first, always)

No production code before a failing test that demands it. Coverage is a
byproduct: both packages gate at 100% (`thresholds` in `topa/web/vite.config.ts`,
`fail_under` in `topa/api/pyproject.toml`), with test files out of the denominator.

## The cycle

1. **Derive the tests from the card before touching `src/`**: one test per
   acceptance criterion, plus unit tests for each domain rule.
2. **Red**: run them and watch them fail for the right reason (missing
   behavior, not an import typo).
3. **Green**: the minimum that passes, inside out: domain, port, adapter, UI or
   route.
4. **Refactor** with the suite as the safety net; the thermo-nuclear review
   runs on the PR anyway.

Bugfixes: a failing regression test first, then the fix, and the test stays.

## topa/web/ (Vitest + Testing Library, jsdom)

Layers: `src/{domain,ports,adapters/http,adapters/local,ui}`, wired in
`src/composition.ts`. Tests sit next to the code (`X.test.ts(x)`).

- **domain** (cart, pricing, `sugerir()`): plain unit tests, no DOM, no fakes.
  Money is integer centavos; assert exact values.
- **ports**: both adapters implement the same port, so they pass the same
  behavior tests. The local adapter is what demo mode ships, not a test double.
- **adapters/http**: stub `fetch` at the boundary with typed fixtures that
  mirror the API's pydantic responses; cover the error and unreachable paths.
- **ui**: render the screen with a port that answers what the test needs
  (see `StartScreen.test.tsx`), act like the customer or the lojista
  (`userEvent`), assert what the screen shows.

## topa/api/ (pytest, uv)

Layers: `topa_api/{domain,application,adapters,presentation,entrypoints}`;
import-linter keeps `domain` and `application` free of FastAPI and SQLAlchemy.

- `tests/unit/`: domain rules and use cases, fast, no database. Use cases get
  in-memory fakes that implement the port Protocol.
- `tests/integration/`: the acceptance criteria through the real HTTP surface,
  `TestClient` against Postgres migrated to head by Alembic (`db_engine` and
  `client` in `tests/integration/conftest.py`). Name tests after the behavior
  (`test_sold_out_product_is_hidden_from_the_menu`).
- Swap dependencies with `app.dependency_overrides`, keyed by the dependency
  function, never by monkeypatching internals.

## Rules that keep the suite honest

- A test asserts behavior: what came back, what state was left, which error,
  which message the user sees. "Does not crash" is not an assertion.
- Query the DOM like a user: `getByRole`, `getByLabelText`, `getByText`;
  `data-testid` only as a last resort. Never assert class names or internal
  state.
- Determinism: no sleeps, no wall clock. Order numbers, "pedidos por hora" and
  anything time-based take an injected clock or seeded rows.
- A test that fails after a refactor is information: fix the code or the
  contract, never weaken the assertion.
