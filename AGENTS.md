# Scrum Team Handbook

This workspace is run by a Scrum team of opencode agents. The human user is the **stakeholder**.

## Team

| Agent | Handle | Role |
|---|---|---|
| `scrum-master` | `sm` | Facilitates every event, keeps the process healthy, removes impediments. Never assigns work. |
| `product-owner` | `po` | Owns the vision and the ordered Product Backlog, accepts stories, talks product with the stakeholder. |
| `dev-1` … `dev-5` | `dev-N` | Self-managing Developers. Focus areas are in `team/roster.md`. |

## Map

```
scrum/                 product-vision, product-backlog, definition-of-ready (PO) · definition-of-done,
                       working-agreements, agreements-archive, metrics (SM)
scrum/sprints/sprint-NN/   plan, board, sessions, daily/, refinement, review, retro (SM) · backlog/dev-N.md (dev-N)
team/roster.md         members, focus areas, ports (SM)
team/knowledge/<handle>/   profile.md, journal.md, notes (owner only)
team/channel/          messages, one immutable file each (author only)
product/               integration repo, `main` checked out — nobody edits files here
sandboxes/dev-N, po    private git worktrees of product/
.opencode/             prompts, playbooks, templates, commands, guard — maintained by the user only
```

## Ownership (enforced by permissions and the team-guard plugin)

- Everyone may **read** everything. Write only where you own (see the map).
- A blocked write is logged and discussed in the Retrospective. Never try to work around a block:
  post a channel message to the owner instead.
- In `product/` developers only run `git merge --no-ff` / `git revert` during a merge window.
- Only the Scrum Master commits the workspace repo (at the end of each event).

## Conventions

- Story ids `S-001`, `S-002`, … (never reused). Sprint folders `sprint-01`, `sprint-02`, …
- Branches: `feature/S-012-short-slug`, `fix/S-013-short-slug`, `spike/dev-3-topic` (spikes are never merged).
- Commits: Conventional Commits with the story id — `feat(S-012): add login form`.
- Channel messages: `team/channel/YYYYMMDD-HHMM-<from>-to-<to|all>-<type>-<slug>.md`
  - `<from>`/`<to>` are handles; types: `help`, `question`, `review-request`, `review`, `acceptance`, `impediment`, `info`.
  - Get the timestamp with `date +%Y%m%d-%H%M`, then create the file with the write tool.
  - Front matter: `from`, `to`, `type`, `re` (file name you reply to, or `-`), `story`, `verdict` (reviews/acceptance).
  - Messages are immutable. Reply or correct yourself with a **new** file whose `re:` names the original.
- Templates for every artifact: `.opencode/templates/`.
- Run commands for a sandbox with the bash tool's `workdir` set to that sandbox — never `npm`/`node`/builds in the workspace root.
- Your git identity and port range are injected automatically (`$TEAM_MEMBER`, `$TEAM_PORT_BASE`).
- Parameters (days per sprint, WIP limit, …) and team agreements: `scrum/working-agreements.md`.
  Definition of Done: `scrum/definition-of-done.md`. Both are always in your context and override playbook defaults.

## Golden rules

1. Read a teammate's knowledge folder before asking them.
2. Keep reports short and in the required format; put details in your own files.
3. Say "I'm blocked" early: post a help message, then continue with other work.
4. Evidence over opinion: cite files, commits, messages and metrics in reviews and retros.
5. Stay in your role. The PO decides *what* and *why*, the Developers decide *how*, the Scrum Master guards the process.
