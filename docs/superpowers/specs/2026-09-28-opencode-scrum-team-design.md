# opencode Scrum Team — Design

Date: 2026-09-28 · Target: opencode 1.18.16 (OpenCode Desktop, Windows 11)

## 1. Goal

A multi-agent system for opencode that develops software the way a Scrum team does:
1 Product Owner, 1 Scrum Master, 5 Developers. The team runs the full cycle (Planning → Daily
Scrums/work → Refinement → Review → Retrospective), shares thoughts, asks each other for help, and
changes its own way of working based on Review and Retrospective results. The system is generic:
at kickoff the PO asks the user for the **basic product idea** and the **tech stack**.

Each developer has a private git sandbox and an owner-writable, team-readable knowledge folder.

## 2. Decisions

| Topic | Decision |
|---|---|
| User's role | Stakeholder: answers kickoff questions, gives feedback at every Sprint Review. `/sprint` = one full cycle. |
| Orchestration | Scrum Master is the primary agent and facilitates every event; PO and developers are subagents. All state lives in files. |
| Retro → next sprint | Living `scrum/working-agreements.md`, loaded into every agent via `instructions` (re-read on every prompt). Agent prompts stay fixed. |
| Help | Async channel (one file per message) routed by the SM + at most one direct call per work block (depth-capped). |
| Git | GitHub flow: `main` always releasable, short-lived story branches, `--no-ff` merges, tag `sprint-NN` after Review. |
| Developers | T-shaped; focus areas derived from the tech stack at setup, recorded in `team/roster.md`, changeable by Retro. |

## 3. Verified platform facts (opencode 1.18.16 source)

- Multiple `task` calls in one assistant turn run concurrently → 5 developers work in parallel.
- `task_id` resumes an existing subagent session → developers keep context within a sprint.
- `subagent_depth` (default 1) blocks subagents from spawning subagents. We set `2`; a subagent also
  needs an explicit `task` permission rule. At depth 2 nobody can call further → call chains are capped by the platform.
- `instructions` files are read fresh on every prompt → Retro changes apply immediately.
- Permission rules: last matching rule wins; patterns use `*` = any chars (incl. `/`); edit patterns are
  paths relative to the **git root of the workspace** with `\` normalized, case-insensitive on Windows.
  → The workspace root **must** be a git repository.
- Custom agents default to `"*": "allow"` → every team agent starts from deny.
- An "Always allow" click on an edit prompt approves `*` for **all agents** for the rest of the process →
  no team rule may evaluate to `ask`; every path is explicitly `allow` or `deny`.
- The shell permission only sees command text, and in-project paths are not path-checked → a plugin guard covers shell writes.
- `chat.message` fires for subagent sessions with the agent name → a plugin can map session → agent.
  Throwing in `tool.execute.before` blocks the call. `shell.env` can inject env vars per session.
- Default Windows shell is PowerShell → config sets `"shell": "bash"` (Git Bash).
- `{file:path}` substitution in `opencode.json` is JSON-escaped inline → one shared developer prompt.
- Local plugins must `export default { id, server }` and export nothing else.
- `opencode debug agent <name> --tool <id> --params <json>` executes a tool under an agent's
  permissions without an LLM → deterministic permission tests.

**Honest limit:** all agents run as the same OS user. Ownership is enforced hard for opencode's
file tools and heuristically for shell commands; every blocked attempt is logged and reviewed in the Retro.

## 4. Workspace layout

```
scrum/                               ← git repo; open OpenCode here
├─ AGENTS.md                         ← team handbook, loaded for every agent (keep short)
├─ opencode.json                     ← all 7 agents, permissions, instructions, shell, depth
├─ README.md                         ← how to use it
├─ .opencode/
│  ├─ prompts/                       ← scrum-master.md, product-owner.md, developer.md
│  ├─ playbooks/                     ← one file per event, read by the SM when running it
│  ├─ templates/                     ← formats for backlog items, plans, messages, reports
│  ├─ command/                       ← kickoff, sprint, planning, daily, review, retro, status
│  ├─ plugin/team-guard.ts           ← enforcement plugin (default export only)
│  ├─ team-guard/                    ← pure guard logic + tests (not auto-loaded)
│  └─ logs/guard.jsonl               ← written by the plugin only (git-ignored)
├─ team/
│  ├─ roster.md                      ← SM: members, focus areas, port ranges
│  ├─ knowledge/<owner>/             ← po, sm, dev-1…dev-5: profile.md, notes, journal.md
│  └─ channel/                       ← messages, one immutable file each
├─ scrum/
│  ├─ product-vision.md              ← PO
│  ├─ product-backlog.md             ← PO
│  ├─ definition-of-ready.md         ← PO
│  ├─ definition-of-done.md          ← SM (changed only by Retro decisions)
│  ├─ working-agreements.md          ← SM (parameters + active agreements)
│  ├─ agreements-archive.md          ← SM
│  ├─ metrics.md                     ← SM
│  └─ sprints/sprint-NN/
│     ├─ plan.md, board.md, sessions.md, daily/day-N.md, refinement.md, review.md, retro.md ← SM
│     └─ backlog/dev-N.md            ← dev-N (Sprint Backlog belongs to the Developers)
├─ product/                          ← product git repo, `main` checked out (git-ignored here)
└─ sandboxes/                        ← git worktrees of product/ (git-ignored here)
   ├─ dev-1 … dev-5                  ← private developer sandboxes
   └─ po                             ← PO's detached checkout for acceptance testing
```

## 5. Ownership model

Everyone may read everything. Write access:

| Path | Owner(s) |
|---|---|
| `scrum/product-vision.md`, `product-backlog.md`, `definition-of-ready.md` | product-owner |
| `scrum/sprints/*/backlog/dev-N.md` | dev-N |
| everything else under `scrum/` | scrum-master |
| `team/roster.md` | scrum-master |
| `team/knowledge/<owner>/` | that owner (`po`, `sm`, `dev-N`) |
| `team/channel/<ts>-<author>-to-<to>-<type>-<slug>.md` | author, create-only (existing files are immutable) |
| `sandboxes/dev-N/` | dev-N |
| `sandboxes/po/` | product-owner |
| `product/` | nobody edits files; devs may only `git merge --no-ff` / `git revert` there; SM may `init`, `commit --allow-empty` (setup), `worktree`, `tag`, `config`; everyone may run read-only git commands |
| `AGENTS.md`, `opencode.json`, `.opencode/`, `README.md`, `docs/` | only the user |

Enforced in three layers:
1. **opencode permissions** per agent (edit rules: `"*": "deny"` first, owner allows after, exceptions last).
2. **team-guard plugin** (`tool.execute.before`): checks `edit`/`write` paths, `apply_patch` file headers,
   and shell commands (redirections, file-mutating commands, `workdir`, `git -C`) against the same model;
   enforces channel immutability and author naming; restricts `product/` to allowed git subcommands;
   caps direct calls. Blocks are logged to `.opencode/logs/guard.jsonl`.
3. **Retro audit**: the SM reviews the guard log each Retro.

The guard only restricts the seven team agents; the user's own agents (build/plan) are unaffected.

## 6. Agents

| Agent | Mode | Responsibilities | task permission |
|---|---|---|---|
| `scrum-master` | primary, `default_agent` | Facilitates all events, runs mechanics (setup, round order, merge window, tagging, workspace commits), tracks metrics, removes impediments. Does not assign work, make technical decisions or write product code. | `product-owner`, `dev-*` |
| `product-owner` | all | Vision, backlog ordering, Definition of Ready, acceptance checks on branches before merge, backlog adaptation from Review feedback. Talks to the user at kickoff (as primary). | none |
| `dev-1`…`dev-5` | subagent | Self-organizing developers: estimate, choose and order work, TDD in own sandbox, peer review, merge own work, maintain own knowledge. | other `dev-*`, `product-owner` (direct help, max 1 per work block) |

- Prompts: `.opencode/prompts/{scrum-master,product-owner,developer}.md`. Developer entries in
  `opencode.json` use `"You are dev-N …\n\n{file:./.opencode/prompts/developer.md}"`.
- `question` tool: allowed for SM and PO (to ask the user), denied for developers.
- Step limits: SM 500, PO 80, developers 80 per call (a sprint resumes cleanly if the SM hits its limit).
- Models: all inherit the user's selected model; per-agent `model` can be set later.
- Git identity and port range per developer are injected by the plugin via `shell.env`
  (`GIT_AUTHOR_*`, `GIT_COMMITTER_*`, `TEAM_MEMBER`, `TEAM_PORT_BASE`), with worktree-level git config as fallback.

## 7. Communication

1. **Task results**: developers answer the SM with a short fixed-format report (≤150 words);
   details stay in their files.
2. **Readable files**: Sprint Backlog files, knowledge folders (`profile.md` says what to ask me about;
   `journal.md` holds per-sprint learnings). Rule: check a teammate's knowledge before asking them.
3. **Channel**: `team/channel/<YYYYMMDD-HHMM>-<from>-to-<to|all>-<type>-<slug>.md` with front matter
   (`from`, `to`, `type`, `re`, `story`, `verdict`). Types: `help`, `question`, `review-request`, `review`,
   `acceptance`, `impediment`, `info`. A reply is a new file with `re: <original filename>`.
   The SM routes unanswered messages in the help & review round by resuming the addressee's session.
4. **Direct call**: a developer may call one teammate or the PO once per work block for a blocker.
   The helper advises only; the requester applies changes in their own sandbox.

Posting a message never blocks the sender: they note the blocker in their backlog file and continue with other work.

## 8. Git workflow

- `product/` is its own repo on `main`. Setup creates worktrees: `sandboxes/dev-N` (detached at `main`)
  and `sandboxes/po` (detached, for acceptance checks).
- One story = one branch `feature/S-<id>-<slug>` (bugs: `fix/…`, throwaway spikes: `spike/dev-N-<slug>`, never merged),
  created from `main` in the owner's sandbox. Commits follow Conventional Commits with the story id: `feat(S-012): …`.
- Peer review: author posts `review-request` with test evidence; reviewer reads `git diff main...<branch>`
  and the author's sandbox (read-only), posts `review` with `verdict: approve|changes`.
- PO acceptance: PO checks out the branch detached in `sandboxes/po`, runs it, verifies acceptance criteria,
  posts `acceptance` with `verdict: accept|reject`.
- Merge window (serial, one story at a time): author rebases on `main`, runs the full test suite, then
  `git -C <workspace>/product merge --no-ff --no-edit <branch>`. Because merges are serial and the branch was
  just rebased, the tested tree equals the merged tree. Author deletes the branch and returns the sandbox to detached `main`.
- If `main` turns red anyway, the author reverts immediately (`git -C product revert -m 1 --no-edit <merge>`).
- After the Review the SM tags `main` with `sprint-NN`. Unfinished branches stay; their stories go back to the Product Backlog.

## 9. Event flow

### `/kickoff` (agent: product-owner)
1. If a vision already exists, confirm with the user before replacing it.
2. Ask the user: (1) the basic product idea, (2) the tech stack; then up to 3 follow-ups (users, must-haves, constraints/non-goals).
3. Write `product-vision.md`, `definition-of-ready.md`, and an ordered `product-backlog.md`
   (story format with id, acceptance criteria, notes). The first story is a **walking skeleton**
   (repo scaffold, build, test runner, one trivial end-to-end path).
4. Tell the user to switch to the Scrum Master and run `/sprint`.

### `/sprint` (agent: scrum-master) — one full cycle, resumable
State lives in `scrum/sprints/sprint-NN/board.md` (`Phase:` line). `/sprint` resumes where it stopped.

0. **Setup** (first run only): roster with 5 stack-derived focus areas and port ranges; `git init` product with
   an empty initial commit; worktrees; git identities; developers (parallel) write their own `profile.md`;
   workspace commit.
1. **Sprint Planning**: SM reads agreements, last retro, metrics. PO proposes a Sprint Goal and ready stories.
   Developers (parallel) estimate (1,2,3,5,8; above the max size → split), raise risks and dependencies, and state
   preferences. SM facilitates one resolution round if choices conflict. Capacity: sprint 1 conservative,
   later the average velocity of the last 3 sprints. Dependencies get `blocked-by` and are sequenced;
   in sprint 1 the walking skeleton comes first and the others work on dependent-free preparation meanwhile.
   Each developer writes their own Sprint Backlog file; the SM writes `plan.md` and `board.md`.
2. **Development days** (× `days_per_sprint`, default 3):
   a. **Daily Scrum** (developers, parallel, short): read board, teammates' backlogs and channel; state plan for the
      block, impediments and pairing needs; update own backlog file. SM writes `daily/day-N.md`, handles impediments.
   b. **Work block** (developers, parallel, resumed sessions): work in own sandbox per DoD; post messages; request review.
   c. **Help & review round**: SM routes unanswered channel messages to addressees (parallel, resumed sessions).
   d. **Merge window** (serial): for each story with an approving review → PO acceptance → author merges.
   The loop ends early when every story is done.
3. **Refinement**: PO drafts the next ~2 sprints of candidates; two developers matching the focus areas
   (parallel) estimate, split and flag risks; PO marks items ready per DoR.
4. **Sprint Review**: SM + PO compile the increment (done / not done / goal met, how to run it).
   SM presents it to the user and **pauses for feedback**. With the feedback, PO adapts the backlog;
   SM tags `sprint-NN`.
5. **Sprint Retrospective** (see §10), then workspace commit and a short summary to the user.

Single-event commands (`/planning`, `/daily`, `/review`, `/retro`) run one phase of the current sprint;
`/status` prints the board and open impediments.

## 10. Review and Retrospective feedback loop

**Evidence** (SM compiles into `retro.md` before the Retro):
committed vs. done points, carry-over, acceptance rejections, review turnaround (blocks), help messages
(count, unanswered, answer latency), direct calls, merge conflicts, reverts, red builds, guard blocks,
the user's Review feedback, and the status of active agreements' success signals.

**Retro steps**
1. **Check last changes**: for each active agreement compare its success signal with the evidence → keep, adjust or drop
   (dropped ones move to the archive with a reason).
2. **Perspectives** (PO + 5 developers, parallel): each writes into their own `journal.md` and returns what went well,
   what didn't (with evidence), and 1–2 improvement proposals.
3. **Insights**: SM clusters the input, picks the top unsuccessful workflows (at most 3), and does a 5-whys root cause.
4. **Decide**: proposals backed by the most participants and strongest evidence win; at most 3 new agreements per Retro.
5. **Record**: each agreement `WA-NN` states problem (evidence), change, who it applies to, owner,
   success signal, "since sprint N", "check in sprint N+1". Parameter changes go in the same file.
   Focus-area changes go to the roster; DoD changes to the DoD.
6. **Metrics**: append a row to `metrics.md`.

**Tunable parameters** (in `working-agreements.md`, changeable only by the Retro):
`days_per_sprint`, `wip_limit_per_dev`, `max_story_points`, `required_approvals`,
`capacity_buffer_percent`, `review_routing` (focus-match or round-robin), `direct_calls_per_block`.

Because `working-agreements.md` and `definition-of-done.md` are in `instructions`, every agent sees
the changes on its next prompt, and the next Retro verifies whether they worked.

## 11. Error handling

| Situation | Handling |
|---|---|
| Guard blocks an action | Error message tells the agent what to do instead (e.g. post to channel); logged. |
| Subagent fails or runs out of steps | SM resumes it once; otherwise records an impediment on the board and continues. |
| Rebase conflict | Author resolves in own sandbox; if not solvable in the block, aborts and posts an impediment. |
| `main` red after merge | Author reverts at once; story goes back to in progress; counted in metrics. |
| App closed mid-sprint | `/sprint` resumes from the `Phase:` in `board.md`; sessions from `sessions.md` are resumed when possible. |
| Unexpected permission prompt | README instructs: choose "Allow once" or "Reject", never "Always". |
| Developer sessions grow large | Sessions are resumed within a sprint only; each sprint starts fresh sessions. |

## 12. Testing

1. **Guard unit tests** (`node --test`, pure TypeScript logic shared with the plugin): owner/non-owner writes,
   channel creation and immutability, shell write detection (redirects, `cp/mv/rm/touch/mkdir/tee/sed -i`,
   `workdir`, `git -C`), `product/` git subcommand rules, direct-call cap, unknown agents unaffected.
2. **Config consistency test**: re-implements opencode's wildcard + last-match evaluation and checks that the
   `edit` rules in `opencode.json` agree with the guard's ownership model for a matrix of sample paths × agents,
   and that no team rule evaluates to `ask`.
3. **Headless permission checks** (with the user's approval to run `npx opencode-ai@1.18.16`):
   `opencode debug config` (agents and prompt substitution resolve) and `opencode debug agent <name> --tool write`
   for allowed and forbidden paths — no LLM calls.
4. **Manual dry run** (user-driven): `/kickoff` with a tiny product, one `/sprint`; check artifacts, branches, tag, agreements.

## 13. Out of scope

Remote git hosting / pull requests on a server, CI, OS-level user separation, automatic model selection,
multiple teams, running more than one sprint per `/sprint` call.
