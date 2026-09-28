# opencode Scrum Team

A Scrum team made of opencode agents: **1 Product Owner, 1 Scrum Master and 5 Developers**.
You are the stakeholder. The team runs real sprint cycles on your product — Planning, Daily Scrums, work in private git
sandboxes, peer reviews, PO acceptance, merges, Refinement, Review with you, and a Retrospective that changes how the
team works in the next sprint.

Built for opencode 1.18.16 (OpenCode Desktop on Windows; Git for Windows required).

## Quick start

1. Open this folder (`C:\Users\jannik\scrum`) in OpenCode Desktop.
2. Run **`/kickoff`**. The Product Owner asks you for the **product idea** and the **tech stack**
   (you can let the team propose one), then writes the vision and the Product Backlog.
3. Switch to the **Scrum Master** (Tab) and run **`/sprint`**. The first run sets up the team:
   roster with focus areas, the product repository and one git sandbox per developer. Then Sprint 1 starts.
4. The sprint stops at the **Sprint Review** and asks for your feedback. Answer in the chat.
   The PO adapts the backlog, the team holds its Retrospective, and the sprint ends with a summary.
5. Run **`/sprint`** again for the next sprint.

## Commands

| command | agent | what it does |
|---|---|---|
| `/kickoff [idea]` | Product Owner | asks for the product idea and tech stack, writes vision and backlog |
| `/sprint [feedback]` | Scrum Master | one full sprint; resumes where it stopped (also after closing the app) |
| `/planning` | Scrum Master | Sprint Planning only |
| `/daily` | Scrum Master | the next development day only |
| `/review [feedback]` | Scrum Master | Sprint Review, or continue it with your feedback |
| `/retro` | Scrum Master | Retrospective only |
| `/status` | Scrum Master | read-only status: phase, stories, impediments, open messages |

You can also talk to the Product Owner directly (Tab) about the product at any time.

## How a sprint runs

```
Planning ─► Day 1 … Day N ─► Refinement ─► Review ⏸ you ─► Retro ─► next sprint
              │
              ├ Daily Scrum         developers plan the next block (parallel)
              ├ Work block          each developer works in sandboxes/dev-N (parallel)
              ├ Help & review round unanswered channel messages are routed to their addressees
              └ Merge window        one story at a time: PO acceptance → rebase → tests → merge into product/
```

- **Git:** `product/` holds `main` (always releasable). Each developer works in their own worktree
  `sandboxes/dev-N` on `feature/S-<id>-<slug>` branches, gets a teammate review and PO acceptance, then merges with
  `--no-ff`. After the Review, `main` is tagged `sprint-NN`.
- **Knowledge:** every member has `team/knowledge/<handle>/` (profile, notes, journal). Everyone can read all of them;
  only the owner can change them.
- **Communication:** `team/channel/` holds one file per message (help, question, review-request, review, acceptance,
  impediment, info). Messages are never edited; replies are new files. A developer who is truly blocked may call one
  teammate or the PO directly, once per work block.
- **Improvement loop:** the Retro measures what happened (points, rejections, review turnaround, unanswered help,
  reverts, blocked writes, your feedback), checks whether last sprint's changes worked, and records at most three new
  agreements plus parameter changes in `scrum/working-agreements.md`. That file is loaded into every agent's context,
  so the changes apply immediately — and the next Retro checks them again.

## Where to look

| what | where |
|---|---|
| vision, backlog, Definition of Ready | `scrum/product-vision.md`, `scrum/product-backlog.md`, `scrum/definition-of-ready.md` |
| current sprint | `scrum/sprints/sprint-NN/` (`board.md`, `plan.md`, `daily/`, `backlog/dev-N.md`, `review.md`, `retro.md`) |
| agreements and parameters | `scrum/working-agreements.md` (history in `scrum/agreements-archive.md`) |
| metrics per sprint | `scrum/metrics.md` |
| team and focus areas | `team/roster.md` |
| messages | `team/channel/` |
| blocked write attempts and direct calls | `.opencode/logs/guard.jsonl` |
| the product | `product/` (latest `main`), tags `sprint-01`, `sprint-02`, … |

## Ownership and safety

Everyone reads everything; writes are limited to what each member owns (see `AGENTS.md`). This is enforced twice:
per-agent permissions in `opencode.json`, and the `team-guard` plugin (`.opencode/plugin/team-guard.ts`), which also
checks shell commands, keeps channel messages immutable, limits `product/` to merges, injects each member's git identity
and enforces the direct-call limit. Your own agents (Build, Plan) are not restricted.

- **Never click "Always allow" on a permission prompt from a team agent.** opencode applies an "always" approval to
  every agent for the rest of the session, which would switch off the ownership rules. The team is configured so
  that prompts should not appear; if one does, choose "Allow once" or "Reject".
- All agents run as your Windows user. File-tool writes are strictly enforced; shell commands are checked
  heuristically. Every blocked attempt is logged and discussed in the next Retro.

## Customizing

- Process parameters (days per sprint, WIP limit, max story size, required approvals, capacity buffer, review routing,
  direct calls per block) live in `scrum/working-agreements.md`. By design only the Retro changes them — but you can
  edit them yourself at any time.
- Models: every agent uses the model you select. To give an agent its own model, add `"model": "provider/model"` to its
  entry in `opencode.json`.
- Roles and events: prompts in `.opencode/prompts/`, event scripts in `.opencode/playbooks/`, artifact formats in
  `.opencode/templates/`. The team cannot change these; the Retro writes suggestions for you at the end of `retro.md`.

## Tests

```bash
node --test .opencode/team-guard/*.test.ts
```

Covers the ownership model, shell write detection, per-tool evaluation, the plugin hooks, and a consistency check
that the permissions in `opencode.json` match the guard's ownership model.

## Starting over

To throw away the product and all sprints (keeps the team setup files):

```bash
rm -rf product sandboxes scrum/sprints/sprint-* scrum/product-*.md scrum/definition-of-ready.md team/channel/2* team/knowledge/*/*.md
git checkout -- scrum team
```

Then run `/kickoff` again.
