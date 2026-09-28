# Definition of Done

> Loaded into every agent's context. Changed only by a Retrospective decision.

A story is **Done** when all of these hold:

1. The code lives on its story branch (created from `main`) with Conventional Commits that reference the story id, e.g. `feat(S-012): add login form`.
2. Automated tests cover every acceptance criterion, and the full test suite passes in the author's sandbox after rebasing on `main`.
3. At least `required_approvals` teammate review(s) say `verdict: approve`, and all requested changes are resolved.
4. The Product Owner accepted it (an `acceptance` message with `verdict: accept`).
5. It is merged into `main` with `--no-ff` during a merge window, and `main` still builds with all tests green.
6. User-visible behaviour is documented (product README or docs).
7. Non-obvious learnings are recorded in the author's knowledge folder.
