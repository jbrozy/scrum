# opencode Scrum Team Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 7-agent Scrum team (PO, SM, 5 developers) for opencode 1.18.16 that runs full sprint cycles with git sandboxes, owner-only knowledge folders, and Retro-driven process changes.

**Architecture:** Pure configuration + prompts + one guard plugin. `opencode.json` defines the agents and their permissions; markdown prompts, playbooks and templates define behaviour; `.opencode/plugin/team-guard.ts` enforces ownership for file tools and shell commands, injects git identities, and caps direct calls. The guard's logic lives in pure TypeScript modules tested with `node --test`.

**Tech Stack:** opencode 1.18.16 config/agents/commands/plugins, TypeScript (erasable syntax only — runs under Bun inside opencode and under Node 26 type stripping for tests), git worktrees, Markdown.

## Global Constraints

- Target opencode 1.18.16 on Windows 11; `"shell": "bash"` (Git Bash).
- Workspace root `C:\Users\jannik\scrum` is a git repo; `product/` and `sandboxes/` are git-ignored.
- Team agent ids: `scrum-master`, `product-owner`, `dev-1` … `dev-5`; handles `sm`, `po`, `dev-1` … `dev-5`.
- No team permission rule may be `ask`. Every team agent's `edit`, `task`, `external_directory` rules start with `"*": "deny"`.
- Team permissions are defined per team agent only (never globally) so the user's own agents stay unrestricted.
- `subagent_depth: 2`, `default_agent: "scrum-master"`, `instructions: ["scrum/working-agreements.md", "scrum/definition-of-done.md"]`.
- Channel file name: `YYYYMMDD-HHMM-<from>-to-<to|all>-<type>-<slug>.md`, types `help|question|review-request|review|acceptance|impediment|info`.
- Branches `feature/S-<id>-<slug>`, `fix/S-<id>-<slug>`, `spike/dev-N-<slug>`; Conventional Commits with story id.
- Ports: dev-N `3N00–3N99`, po `3900–3999`. Git identity `<agent> <handle@team.local>`.
- Plugin file exports only `default { id, server }`. Guard modules use `.ts` import specifiers and no enums/namespaces/parameter properties.
- Step limits: scrum-master 500, product-owner 80, developers 80.

## File Structure

| File | Responsibility |
|---|---|
| `.gitignore`, `.gitattributes` | ignore product/sandboxes/logs; LF line endings |
| `.opencode/team-guard/paths.ts` | path normalization, workspace-relative paths |
| `.opencode/team-guard/ownership.ts` | team identities, `canWrite` ownership model, channel naming |
| `.opencode/team-guard/shell.ts` | shell lexer + write detection + git rules |
| `.opencode/team-guard/guard.ts` | per-tool evaluation, direct-call cap, identity env, limit parsing |
| `.opencode/team-guard/*.test.ts` | unit tests; `config.test.ts` checks opencode.json against the model |
| `.opencode/plugin/team-guard.ts` | wires guard into opencode hooks, logs to `.opencode/logs/guard.jsonl` |
| `opencode.json` | agents, permissions, instructions, shell, depth |
| `AGENTS.md` | team handbook loaded for every agent |
| `.opencode/prompts/*.md` | scrum-master, product-owner, developer role prompts |
| `.opencode/playbooks/*.md` | kickoff, sprint, setup, planning, development-day, refinement, review, retro |
| `.opencode/templates/*.md` | artifact formats |
| `.opencode/command/*.md` | `/kickoff /sprint /planning /daily /review /retro /status` |
| `scrum/*`, `team/*` | initial artifacts and owner folders |
| `README.md` | user guide |

---

### Task 1: Workspace scaffold

**Files:**
- Create: `.gitignore`, `.gitattributes`, `scrum/working-agreements.md`, `scrum/definition-of-done.md`, `scrum/agreements-archive.md`, `scrum/metrics.md`, `scrum/sprints/.gitkeep`, `team/roster.md`, `team/channel/.gitkeep`, `team/knowledge/{sm,po,dev-1,dev-2,dev-3,dev-4,dev-5}/.gitkeep`

**Interfaces:**
- Produces: `scrum/working-agreements.md` containing the parameter table row `| direct_calls_per_block | 1 | 0–2 |` (parsed by Task 4 with `/direct_calls_per_block\W+(\d+)/`); `team/roster.md` front matter `status: not-set-up` (read by the sprint playbook).

- [ ] **Step 1: Write `.gitignore`**

```gitignore
product/
sandboxes/
.opencode/logs/
.opencode/node_modules/
node_modules/
```

- [ ] **Step 2: Write `.gitattributes`**

```gitattributes
* text=auto eol=lf
```

- [ ] **Step 3: Write `scrum/working-agreements.md`** with: a one-line purpose note (loaded into every agent; only the Retro changes it; keep under ~60 lines), `## Parameters` table (`parameter | value | allowed range`): `days_per_sprint 3 (2–5)`, `wip_limit_per_dev 1 (1–2)`, `max_story_points 5 (3–8)`, `required_approvals 1 (1–2)`, `capacity_buffer_percent 20 (0–40)`, `review_routing focus-match (focus-match, round-robin)`, `direct_calls_per_block 1 (0–2)`; `## Active agreements` with "None yet — the first Retrospective adds them."; `## Format` showing the WA block (`### WA-NN · title`, Problem (evidence), Change, Applies to, Owner, Success signal, Since/Check in).

- [ ] **Step 4: Write `scrum/definition-of-done.md`** — 7 numbered criteria: story branch + Conventional Commits with id; tests cover acceptance criteria and full suite passes after rebase on main; `required_approvals` approving reviews with requested changes resolved; PO acceptance message `verdict: accept`; merged `--no-ff` in a merge window and main green; user-visible behaviour documented in the product README/docs; non-obvious learnings recorded in the author's knowledge folder.

- [ ] **Step 5: Write `scrum/agreements-archive.md`** (heading + "Retired agreements with the reason they were dropped or replaced."), `scrum/metrics.md` (heading + table header `sprint | planned pts | done pts | carry-over | acceptance rejects | reverts | help msgs (unanswered) | direct calls | guard blocks | goal met`), `team/roster.md` (front matter `status: not-set-up` + "The Scrum Master fills this in during team setup."), and the `.gitkeep` files.

- [ ] **Step 6: Verify and commit**

Run: `git status --short` → shows the new files. Then:
```bash
git add -A && git commit -m "chore: scaffold scrum team workspace"
```

### Task 2: Guard paths + ownership model

**Files:**
- Create: `.opencode/team-guard/paths.ts`, `.opencode/team-guard/ownership.ts`
- Test: `.opencode/team-guard/ownership.test.ts`

**Interfaces:**
- Produces (paths.ts): `normalize(p: string): string` (forward slashes, `/c/x` → `c:/x`, case preserved), `resolvePath(p: string, base: string): string`, `toRel(root: string, abs: string): string | null` (case-insensitive compare, `""` for root, `null` outside), `isSpecialTarget(p: string): boolean` (`/dev/null` etc.).
- Produces (ownership.ts): `DEVELOPERS`, `TEAM_AGENTS`, `type TeamAgent`, `type Decision = { allow: true } | { allow: false; reason: string }`, `allow`, `deny(reason)`, `isTeamAgent(a?: string)`, `isDeveloper(a: string)`, `handleOf(a: TeamAgent)`, `CHANNEL_FILE: RegExp`, `canWrite(agent: TeamAgent, rel: string, exists: boolean): Decision`.

- [ ] **Step 1: Write the failing test** `.opencode/team-guard/ownership.test.ts`

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { canWrite, handleOf, isTeamAgent } from "./ownership.ts"
import { resolvePath, toRel } from "./paths.ts"

const ok = (agent: any, rel: string, exists = false) => assert.equal(canWrite(agent, rel, exists).allow, true, `${agent} should write ${rel}`)
const no = (agent: any, rel: string, exists = false) => assert.equal(canWrite(agent, rel, exists).allow, false, `${agent} must not write ${rel}`)

test("identities", () => {
  assert.equal(isTeamAgent("dev-3"), true)
  assert.equal(isTeamAgent("build"), false)
  assert.equal(isTeamAgent(undefined), false)
  assert.equal(handleOf("scrum-master"), "sm")
  assert.equal(handleOf("product-owner"), "po")
  assert.equal(handleOf("dev-2"), "dev-2")
})

test("paths", () => {
  const root = "C:\\Users\\jannik\\scrum"
  assert.equal(toRel(root, "C:/Users/jannik/scrum/team/roster.md"), "team/roster.md")
  assert.equal(toRel(root, "c:\\users\\JANNIK\\scrum\\Team\\x.md"), "Team/x.md")
  assert.equal(toRel(root, "/c/Users/jannik/scrum"), "")
  assert.equal(toRel(root, "C:/Users/jannik/other/x"), null)
  assert.equal(toRel(root, "C:/Users/jannik/scrumother/x"), null)
  assert.equal(toRel(root, resolvePath("../../team/knowledge/dev-4/a.md", root + "/sandboxes/dev-3")), "team/knowledge/dev-4/a.md")
})

test("knowledge folders are owner-only", () => {
  ok("dev-3", "team/knowledge/dev-3/notes/git.md")
  ok("dev-3", "team/knowledge/dev-3")
  no("dev-3", "team/knowledge/dev-4/notes.md")
  no("dev-3", "team/knowledge")
  ok("scrum-master", "team/knowledge/sm/profile.md")
  no("scrum-master", "team/knowledge/dev-1/profile.md")
  ok("product-owner", "team/knowledge/po/profile.md")
  no("product-owner", "team/knowledge/sm/profile.md")
})

test("sandboxes are owner-only and product is integration-only", () => {
  ok("dev-1", "sandboxes/dev-1/src/app.ts")
  no("dev-1", "sandboxes/dev-2/src/app.ts")
  ok("product-owner", "sandboxes/po/notes.txt")
  no("scrum-master", "sandboxes/dev-1/x")
  no("dev-1", "product/src/app.ts")
  no("scrum-master", "product/README.md")
})

test("scrum artifacts", () => {
  ok("product-owner", "scrum/product-backlog.md")
  ok("product-owner", "scrum/product-vision.md")
  ok("product-owner", "scrum/definition-of-ready.md")
  no("scrum-master", "scrum/product-backlog.md")
  no("dev-1", "scrum/product-backlog.md")
  ok("scrum-master", "scrum/working-agreements.md")
  ok("scrum-master", "scrum/sprints/sprint-01/board.md")
  ok("scrum-master", "scrum/sprints/sprint-01/backlog")
  no("product-owner", "scrum/definition-of-done.md")
  no("dev-2", "scrum/sprints/sprint-01/board.md")
  ok("dev-2", "scrum/sprints/sprint-01/backlog/dev-2.md")
  no("dev-2", "scrum/sprints/sprint-01/backlog/dev-3.md")
  no("scrum-master", "scrum/sprints/sprint-01/backlog/dev-3.md")
  no("scrum-master", "scrum/sprints/sprint-01/backlog/sm.md")
  ok("scrum-master", "team/roster.md")
  no("dev-1", "team/roster.md")
})

test("user-only files", () => {
  for (const rel of ["AGENTS.md", "opencode.json", "README.md", ".gitignore", ".opencode/prompts/developer.md", "docs/x.md", ".git/config", "random.txt", ""]) {
    no("scrum-master", rel)
    no("dev-1", rel)
  }
})

test("channel: create-only, named as yourself, valid format", () => {
  ok("dev-3", "team/channel/20260928-1412-dev-3-to-dev-1-help-db-setup.md")
  ok("dev-3", "team/channel/20260928-1412-dev-3-to-all-info-skeleton-merged.md")
  ok("dev-3", "team/channel/20260928-1412-dev-3-to-po-question-s-004.md")
  ok("product-owner", "team/channel/20260928-1412-po-to-dev-2-acceptance-s-003.md")
  ok("scrum-master", "team/channel/20260928-1412-sm-to-all-info-sprint-start.md")
  no("dev-3", "team/channel/20260928-1412-dev-4-to-all-info-fake.md")
  no("dev-3", "team/channel/20260928-1412-dev-3-to-dev-1-help-db-setup.md", true)
  no("dev-3", "team/channel/hello.md")
  no("dev-3", "team/channel/20260928-1412-dev-3-to-dev-1-rant-x.md")
  no("dev-3", "team/channel/sub/20260928-1412-dev-3-to-all-info-x.md")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test .opencode/team-guard/ownership.test.ts`
Expected: FAIL — `Cannot find module .../ownership.ts`

- [ ] **Step 3: Write `.opencode/team-guard/paths.ts`**

```ts
import { posix } from "node:path"

const SPECIAL_TARGETS = new Set(["/dev/null", "/dev/stdout", "/dev/stderr", "/dev/tty", "nul", "con"])

/** Forward slashes, Git-Bash drive paths (/c/x → c:/x), `..` resolved. Case is preserved. */
export function normalize(p: string): string {
  let s = p.replaceAll("\\", "/")
  const drive = s.match(/^\/([a-zA-Z])(\/|$)/)
  if (drive) s = `${drive[1]}:/${s.slice(3)}`
  s = posix.normalize(s)
  if (s.length > 1 && s.endsWith("/") && !/^[a-zA-Z]:\/$/.test(s)) s = s.slice(0, -1)
  return s
}

function isAbsolute(p: string): boolean {
  return p.startsWith("/") || /^[a-zA-Z]:\//.test(p)
}

/** Resolve `p` against `base`. `~` paths resolve to a marker outside every workspace. */
export function resolvePath(p: string, base: string): string {
  const s = p.replaceAll("\\", "/")
  if (s.startsWith("~")) return "/~home" + s.slice(1)
  if (isAbsolute(s)) return normalize(s)
  return normalize(posix.join(normalize(base), s))
}

/** Workspace-relative path ("" for the root) or null when `abs` is outside `root`. */
export function toRel(root: string, abs: string): string | null {
  const r = normalize(root)
  const a = normalize(abs)
  if (a.toLowerCase() === r.toLowerCase()) return ""
  if (!a.toLowerCase().startsWith(r.toLowerCase() + "/")) return null
  return a.slice(r.length + 1)
}

export function isSpecialTarget(p: string): boolean {
  return SPECIAL_TARGETS.has(p.replaceAll("\\", "/").toLowerCase())
}
```

- [ ] **Step 4: Write `.opencode/team-guard/ownership.ts`**

```ts
export const DEVELOPERS = ["dev-1", "dev-2", "dev-3", "dev-4", "dev-5"] as const
export const TEAM_AGENTS = ["scrum-master", "product-owner", ...DEVELOPERS] as const
export type TeamAgent = (typeof TEAM_AGENTS)[number]
export type Decision = { allow: true } | { allow: false; reason: string }

export const allow: Decision = { allow: true }
export const deny = (reason: string): Decision => ({ allow: false, reason })

export function isTeamAgent(agent: string | undefined): agent is TeamAgent {
  return agent !== undefined && (TEAM_AGENTS as readonly string[]).includes(agent)
}

export function isDeveloper(agent: string): boolean {
  return (DEVELOPERS as readonly string[]).includes(agent)
}

export function handleOf(agent: TeamAgent): string {
  if (agent === "scrum-master") return "sm"
  if (agent === "product-owner") return "po"
  return agent
}

export const CHANNEL_FILE =
  /^\d{8}-\d{4}-(sm|po|dev-[1-5])-to-(sm|po|all|dev-[1-5])-(help|question|review-request|review|acceptance|impediment|info)-[a-z0-9][a-z0-9-]*\.md$/

const USER_ONLY_FILES = new Set(["agents.md", "opencode.json", "readme.md", ".gitignore", ".gitattributes"])
const USER_ONLY_DIRS = [".opencode", "docs", ".git"]
const PO_FILES = new Set(["scrum/product-vision.md", "scrum/product-backlog.md", "scrum/definition-of-ready.md"])

const under = (rel: string, dir: string) => rel === dir || rel.startsWith(dir + "/")

/** May `agent` create, change or delete the workspace-relative path `rel`? */
export function canWrite(agent: TeamAgent, rel: string, exists: boolean): Decision {
  const r = rel.toLowerCase()
  const me = handleOf(agent)
  if (r === "") return deny("the workspace root itself is not writable")
  if (USER_ONLY_FILES.has(r) || USER_ONLY_DIRS.some((d) => under(r, d)))
    return deny(`${rel} is maintained by the user only`)
  if (under(r, "product"))
    return deny("product/ is the integration repo — change code in your own sandbox and merge it with git during the merge window")

  const sandbox = r.match(/^sandboxes\/([^/]+)/)
  if (sandbox)
    return sandbox[1] === me ? allow : deny(`${rel} is in ${sandbox[1]}'s sandbox — only ${sandbox[1]} may change it; post a channel message instead`)
  if (r === "sandboxes") return deny("sandboxes/ is created during team setup only")

  const knowledge = r.match(/^team\/knowledge\/([^/]+)/)
  if (knowledge)
    return knowledge[1] === me ? allow : deny(`${rel} is in ${knowledge[1]}'s knowledge folder — read it, but only ${knowledge[1]} may change it`)
  if (r.startsWith("team/channel/")) return checkChannel(me, r.slice("team/channel/".length), exists)
  if (r === "team/roster.md") return agent === "scrum-master" ? allow : deny("team/roster.md is maintained by the Scrum Master")
  if (under(r, "team")) return deny(`${rel} is not a writable team area`)

  if (PO_FILES.has(r))
    return agent === "product-owner" ? allow : deny(`${rel} is owned by the Product Owner — send them a question in the channel`)
  const sprintBacklog = r.match(/^scrum\/sprints\/[^/]+\/backlog\/([^/]+)\.md$/)
  if (sprintBacklog)
    return isDeveloper(agent) && sprintBacklog[1] === me
      ? allow
      : deny(`${rel} is ${sprintBacklog[1]}'s Sprint Backlog — only that developer may change it`)
  if (/^scrum\/sprints\/[^/]+\/backlog$/.test(r))
    return agent === "scrum-master" ? allow : deny("only the Scrum Master creates the sprint backlog folder")
  if (/^scrum\/sprints\/[^/]+\/backlog\//.test(r))
    return deny("the sprint backlog folder only holds <dev-N>.md files owned by each developer")
  if (under(r, "scrum"))
    return agent === "scrum-master" ? allow : deny(`${rel} is maintained by the Scrum Master — share input via your report or the channel`)

  return deny(`${rel} is outside the team's writable areas`)
}

function checkChannel(me: string, file: string, exists: boolean): Decision {
  if (file === "" || file.includes("/")) return deny("team/channel/ only holds message files directly inside it")
  if (exists)
    return deny(`team/channel/${file} already exists — messages are immutable; post a reply as a new file with "re: ${file}"`)
  const m = file.match(CHANNEL_FILE)
  if (!m)
    return deny("channel file names must look like YYYYMMDD-HHMM-<from>-to-<to|all>-<type>-<slug>.md (types: help, question, review-request, review, acceptance, impediment, info)")
  if (m[1] !== me) return deny(`you may only post messages as yourself ("${me}"), not as "${m[1]}"`)
  return allow
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test .opencode/team-guard/ownership.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add .opencode/team-guard && git commit -m "feat(guard): add workspace ownership model"
```

### Task 3: Shell write detection

**Files:**
- Create: `.opencode/team-guard/shell.ts`
- Test: `.opencode/team-guard/shell.test.ts`

**Interfaces:**
- Consumes: `canWrite`, `handleOf`, `isDeveloper`, `allow`, `deny`, `Decision`, `TeamAgent` (Task 2); `resolvePath`, `toRel`, `isSpecialTarget` (Task 2).
- Produces: `type ShellContext = { root: string; exists: (abs: string) => boolean }`, `checkShell(agent: TeamAgent, command: string, cwd: string, ctx: ShellContext, depth?: number): Decision`.

- [ ] **Step 1: Write the failing test** `.opencode/team-guard/shell.test.ts`

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { checkShell } from "./shell.ts"

const root = "C:/Users/jannik/scrum"
const existing = new Set([`${root}/team/channel/20260928-1000-dev-1-to-dev-3-help-x.md`.toLowerCase()])
const ctx = { root, exists: (p: string) => existing.has(p.toLowerCase()) }
const at = (dir?: string) => (dir ? `${root}/${dir}` : root)
const ok = (agent: any, cmd: string, dir?: string) =>
  assert.equal(checkShell(agent, cmd, at(dir), ctx).allow, true, `${agent} should run: ${cmd} (in ${dir ?? "root"})`)
const no = (agent: any, cmd: string, dir?: string) =>
  assert.equal(checkShell(agent, cmd, at(dir), ctx).allow, false, `${agent} must not run: ${cmd} (in ${dir ?? "root"})`)

test("developers work freely in their own sandbox", () => {
  ok("dev-3", "npm install && npm test", "sandboxes/dev-3")
  ok("dev-3", "npm test 2>&1 | tail -20", "sandboxes/dev-3")
  ok("dev-3", "git switch -c feature/S-001-skeleton main", "sandboxes/dev-3")
  ok("dev-3", 'git commit -m "feat(S-001): add skeleton"', "sandboxes/dev-3")
  ok("dev-3", "git rebase main && git branch -d feature/S-001-skeleton", "sandboxes/dev-3")
  ok("dev-3", "cd sandboxes/dev-3 && npm install")
  ok("dev-3", "rm -rf dist", "sandboxes/dev-3")
})

test("reading is always allowed", () => {
  ok("dev-3", "cat team/knowledge/dev-4/notes.md")
  ok("dev-3", "ls team/knowledge && grep -r token team/knowledge")
  ok("dev-3", "git -C product log --oneline -5")
  ok("dev-3", "git diff main...feature/S-002-login", "sandboxes/dev-3")
  ok("dev-3", "git -C sandboxes/dev-2 status")
  ok("dev-3", "date +%Y%m%d-%H%M")
  ok("dev-3", "node --version")
  ok("dev-3", 'echo "$(date +%Y%m%d-%H%M)"')
  ok("dev-3", "ls > /dev/null")
  ok("dev-3", "git -C product branch --merged main")
})

test("writing own knowledge and channel via shell", () => {
  ok("dev-3", "echo hi > team/knowledge/dev-3/notes.md")
  ok("dev-3", "mkdir -p team/knowledge/dev-3/notes")
  ok("dev-3", "cp team/knowledge/dev-4/snippet.ts sandboxes/dev-3/src/snippet.ts")
  ok("dev-3", "cat > team/knowledge/dev-3/n.md <<'EOF'\nsome > text about team/knowledge/dev-4\nEOF\nls")
  ok("dev-3", "echo x > team/channel/20260928-1412-dev-3-to-dev-1-help-db.md")
})

test("writing other members' areas is blocked", () => {
  no("dev-3", "echo x > team/knowledge/dev-4/notes.md")
  no("dev-3", "echo x >> ../../team/knowledge/dev-4/notes.md", "sandboxes/dev-3")
  no("dev-3", "rm -rf sandboxes/dev-2/src")
  no("dev-3", "cp a.ts ../dev-2/a.ts", "sandboxes/dev-3")
  no("dev-3", "mv team/knowledge/dev-4/a.md team/knowledge/dev-3/a.md")
  no("dev-3", "sed -i 's/a/b/' team/knowledge/dev-4/a.md")
  no("dev-3", "echo x | tee team/roster.md")
  no("dev-3", "cd team/knowledge/dev-4 && touch x")
  no("dev-3", 'bash -c "echo x > team/roster.md"')
  no("dev-3", "echo $(rm -rf team/knowledge/dev-4)")
  no("dev-3", "echo x > team/channel/20260928-1412-dev-4-to-all-info-fake.md")
  no("dev-3", "echo x > team/channel/20260928-1000-dev-1-to-dev-3-help-x.md")
  no("dev-3", "echo x > .opencode/prompts/developer.md")
  no("dev-3", "echo {} > opencode.json")
  no("scrum-master", "echo x > scrum/product-backlog.md")
  no("scrum-master", "echo x > team/knowledge/dev-1/profile.md")
  no("product-owner", "echo x > scrum/definition-of-done.md")
})

test("build tools only run inside your own areas", () => {
  no("dev-3", "npm install")
  no("dev-3", "npm install", "sandboxes/dev-2")
  no("dev-3", `node -e "require('fs').writeFileSync('../../team/knowledge/dev-4/x','y')"`, "sandboxes/dev-3")
  ok("product-owner", "npm install && npm test", "sandboxes/po")
  ok("product-owner", "git checkout --detach feature/S-001-skeleton", "sandboxes/po")
})

test("product/ is integration-only", () => {
  ok("dev-3", "git -C ../../product merge --no-ff --no-edit feature/S-001-skeleton", "sandboxes/dev-3")
  ok("dev-3", "git -C product revert -m 1 --no-edit HEAD")
  no("dev-3", 'git -C product commit -m "x"')
  no("dev-3", "git -C product reset --hard HEAD~1")
  no("dev-3", "git -C product checkout -b hack")
  no("scrum-master", "git -C product merge feature/x")
  no("product-owner", "git -C product tag v1")
  ok("scrum-master", "git init -b main product")
  ok("scrum-master", 'git -C product commit --allow-empty -m "chore: initialize repository"')
  ok("scrum-master", "git -C product worktree add --detach ../sandboxes/dev-1 main")
  ok("scrum-master", 'git -C product tag -a sprint-01 -m "Sprint 01 increment"')
  ok("scrum-master", "git -C product config extensions.worktreeConfig true")
})

test("sandbox and workspace git rules", () => {
  ok("scrum-master", "git -C sandboxes/dev-1 config --worktree user.name dev-1")
  no("scrum-master", 'git -C sandboxes/dev-1 commit -m "x"')
  no("dev-3", 'git -C sandboxes/dev-2 commit -m "x"')
  ok("scrum-master", 'git add -A && git commit -m "scrum(sprint-01): planning"')
  ok("scrum-master", "mkdir -p scrum/sprints/sprint-01/daily")
  no("dev-3", "git add -A")
  no("dev-3", 'git commit -m "x"')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test .opencode/team-guard/shell.test.ts`
Expected: FAIL — `Cannot find module .../shell.ts`

- [ ] **Step 3: Write `.opencode/team-guard/shell.ts`**

```ts
import { allow, canWrite, deny, handleOf, isDeveloper, type Decision, type TeamAgent } from "./ownership.ts"
import { isSpecialTarget, resolvePath, toRel } from "./paths.ts"

export type ShellContext = { root: string; exists: (abs: string) => boolean }

type Lexeme = { kind: "word"; text: string } | { kind: "op"; text: string }
type Segment = { words: string[]; redirects: string[] }

const READ_ONLY = new Set([
  "ls", "dir", "cat", "head", "tail", "less", "more", "grep", "egrep", "fgrep", "rg", "wc", "echo", "printf",
  "pwd", "which", "whereis", "type", "date", "diff", "cmp", "uniq", "cut", "tr", "awk", "gawk", "stat", "file",
  "du", "df", "tree", "basename", "dirname", "realpath", "readlink", "test", "[", "true", "false", "sleep",
  "jq", "column", "nl", "od", "xxd", "md5sum", "sha1sum", "sha256sum", "printenv", "whoami", "id", "uname",
  "hostname", "ps", "tasklist", "kill", "pkill", "taskkill", "export", "unset", "set", "exit", "wait", "jobs",
  "sed", "find", "sort", "env",
])
const WRAPPERS = new Set(["sudo", "command", "builtin", "exec", "nohup", "time", "env", "{", "}", "!", "then", "do", "else"])
const VERSION_FLAGS = new Set(["--version", "-v", "-V", "--help", "-h", "version"])
const READ_ONLY_GIT = new Set([
  "status", "log", "diff", "show", "rev-parse", "ls-files", "ls-tree", "describe", "shortlog", "blame", "grep",
  "cat-file", "merge-base", "for-each-ref", "rev-list", "show-ref", "name-rev", "whatchanged", "help", "version",
  "var", "check-ignore", "count-objects", "show-branch", "range-diff", "cherry",
])

/** Reads a balanced `$( … )` starting at `start` (pointing at `$`). Returns [inner, indexAfter]. */
function readSubstitution(s: string, start: number): [string, number] {
  let depth = 0
  let i = start + 1
  for (; i < s.length; i++) {
    if (s[i] === "(") depth++
    else if (s[i] === ")" && --depth === 0) return [s.slice(start + 2, i), i + 1]
  }
  return [s.slice(start + 2), s.length]
}

function lex(command: string, inner: string[]): Lexeme[] {
  const out: Lexeme[] = []
  const heredocs: { delim: string; strip: boolean }[] = []
  let word = ""
  let started = false
  let i = 0
  const n = command.length
  const flush = () => {
    if (started) out.push({ kind: "word", text: word })
    word = ""
    started = false
  }
  while (i < n) {
    const c = command[i]
    if (c === "\n") {
      flush()
      out.push({ kind: "op", text: ";" })
      i++
      while (heredocs.length > 0) {
        const { delim, strip } = heredocs.shift()!
        while (i < n) {
          const end = command.indexOf("\n", i)
          const line = command.slice(i, end === -1 ? n : end).replace(/\r$/, "")
          i = end === -1 ? n : end + 1
          if ((strip ? line.replace(/^\t+/, "") : line) === delim) break
        }
      }
      continue
    }
    if (c === " " || c === "\t" || c === "\r") { flush(); i++; continue }
    if (c === "#" && !started) { while (i < n && command[i] !== "\n") i++; continue }
    if (c === "'") {
      const end = command.indexOf("'", i + 1)
      const stop = end === -1 ? n : end
      word += command.slice(i + 1, stop)
      started = true
      i = stop + 1
      continue
    }
    if (c === '"') {
      i++
      started = true
      while (i < n && command[i] !== '"') {
        if (command[i] === "\\" && i + 1 < n && '"\\$`'.includes(command[i + 1])) { word += command[i + 1]; i += 2; continue }
        if (command[i] === "$" && command[i + 1] === "(") {
          const [body, next] = readSubstitution(command, i)
          inner.push(body)
          word += command.slice(i, next)
          i = next
          continue
        }
        if (command[i] === "`") {
          const end = command.indexOf("`", i + 1)
          const stop = end === -1 ? n : end
          inner.push(command.slice(i + 1, stop))
          word += command.slice(i, stop + 1)
          i = stop + 1
          continue
        }
        word += command[i]
        i++
      }
      i++
      continue
    }
    if (c === "\\") { if (i + 1 < n && command[i + 1] !== "\n") word += command[i + 1]; started = true; i += 2; continue }
    if (c === "$" && command[i + 1] === "(") {
      const [body, next] = readSubstitution(command, i)
      inner.push(body)
      word += command.slice(i, next)
      started = true
      i = next
      continue
    }
    if (c === "`") {
      const end = command.indexOf("`", i + 1)
      const stop = end === -1 ? n : end
      inner.push(command.slice(i + 1, stop))
      word += command.slice(i, stop + 1)
      started = true
      i = stop + 1
      continue
    }
    if (command.startsWith("<<<", i)) { flush(); out.push({ kind: "op", text: "<" }); i += 3; continue }
    if (command.startsWith("<<", i)) {
      flush()
      i += 2
      let strip = false
      if (command[i] === "-") { strip = true; i++ }
      while (command[i] === " " || command[i] === "\t") i++
      let delim = ""
      while (i < n && !" \t\n;&|<>".includes(command[i])) {
        if (!"'\"\\".includes(command[i])) delim += command[i]
        i++
      }
      heredocs.push({ delim, strip })
      continue
    }
    if (command.startsWith("&&", i) || command.startsWith("||", i)) { flush(); out.push({ kind: "op", text: ";" }); i += 2; continue }
    if (c === ";" || c === "|" || c === "(" || c === ")") { flush(); out.push({ kind: "op", text: ";" }); i++; continue }
    if (c === "&") {
      flush()
      if (command[i + 1] === ">") { out.push({ kind: "op", text: ">" }); i += command[i + 2] === ">" ? 3 : 2; continue }
      out.push({ kind: "op", text: ";" })
      i++
      continue
    }
    if (c === ">" || c === "<") {
      if (started && /^\d+$/.test(word)) { word = ""; started = false } else flush()
      i++
      if (c === ">" && (command[i] === ">" || command[i] === "|")) i++
      if (command[i] === "&") {
        i++
        while (i < n && /[0-9-]/.test(command[i])) i++
        continue
      }
      out.push({ kind: "op", text: c })
      continue
    }
    word += c
    started = true
    i++
  }
  flush()
  return out
}

function segments(lexemes: Lexeme[]): Segment[] {
  const result: Segment[] = []
  let cur: Segment = { words: [], redirects: [] }
  for (let k = 0; k < lexemes.length; k++) {
    const l = lexemes[k]
    if (l.kind === "word") { cur.words.push(l.text); continue }
    const next = lexemes[k + 1]
    if (l.text === ">" || l.text === "<") {
      if (next?.kind === "word") {
        if (l.text === ">") cur.redirects.push(next.text)
        k++
      }
      continue
    }
    result.push(cur)
    cur = { words: [], redirects: [] }
  }
  result.push(cur)
  return result.filter((s) => s.words.length > 0 || s.redirects.length > 0)
}

function stripPrefixes(words: string[]): string[] {
  let k = 0
  while (k < words.length) {
    const w = words[k]
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w) || WRAPPERS.has(w)) { k++; continue }
    if (w === "timeout") { k += 2; continue }
    break
  }
  return words.slice(k)
}

function commandName(word: string): string {
  const base = word.replaceAll("\\", "/").split("/").pop() ?? word
  return base.toLowerCase().replace(/\.(exe|cmd|bat)$/, "")
}

const isOption = (a: string) => a.startsWith("-") && a !== "-"

function mutationTargets(name: string, args: string[]): string[] | null {
  const positional = args.filter((a) => !isOption(a))
  switch (name) {
    case "rm": case "rmdir": case "unlink": case "touch": case "mkdir": case "truncate": case "shred": case "tee":
      return positional
    case "chmod": case "chown": case "chgrp":
      return positional.slice(1)
    case "cp": case "mv": case "ln": case "install": case "rsync": {
      const t = args.findIndex((a) => a === "-t" || a === "--target-directory")
      const inline = args.find((a) => a.startsWith("--target-directory="))
      const target = t >= 0 ? args[t + 1] : inline?.slice("--target-directory=".length)
      if (target !== undefined) return name === "mv" ? [...positional.filter((p) => p !== target), target] : [target]
      if (positional.length === 0) return []
      return name === "mv" ? positional : [positional[positional.length - 1]]
    }
    case "sed": case "perl": {
      if (!args.some((a) => a.startsWith("-i") || a.startsWith("--in-place"))) return null
      const files: string[] = []
      let scriptSeen = args.some((a) => a === "-e" || a === "-f" || a.startsWith("--expression"))
      for (let k = 0; k < args.length; k++) {
        const a = args[k]
        if (a === "-e" || a === "-f") { k++; continue }
        if (isOption(a)) continue
        if (!scriptSeen) { scriptSeen = true; continue }
        files.push(a)
      }
      return files
    }
    case "dd":
      return args.filter((a) => a.startsWith("of=")).map((a) => a.slice(3))
    default:
      return null
  }
}

function checkTarget(agent: TeamAgent, target: string, dir: string, ctx: ShellContext): Decision {
  if (isSpecialTarget(target)) return allow
  const abs = resolvePath(target, dir)
  const rel = toRel(ctx.root, abs)
  if (rel === null) return allow // outside the workspace: opencode's external_directory rule decides
  return canWrite(agent, rel, ctx.exists(abs))
}

function isReadOnlyGit(sub: string, rest: string[]): boolean {
  if (READ_ONLY_GIT.has(sub)) return true
  const has = (...flags: string[]) => rest.some((a) => flags.includes(a))
  if (sub === "branch")
    return rest.length === 0 || (has("--list", "-l", "-a", "--all", "-r", "-v", "-vv", "--merged", "--no-merged", "--contains", "--show-current") &&
      !has("-d", "-D", "--delete", "-m", "-M", "--move", "-c", "-C", "--copy", "-f", "--force", "-u", "--set-upstream-to", "--unset-upstream"))
  if (sub === "tag") return rest.length === 0 || (has("-l", "--list", "-n") && !has("-d", "-a", "-s", "-f", "-m"))
  if (sub === "worktree" || sub === "stash") return rest[0] === "list" || (sub === "stash" && rest[0] === "show")
  if (sub === "config") return has("--get", "--get-all", "--get-regexp", "--list", "-l")
  if (sub === "remote") return rest.length === 0 || rest[0] === "-v" || rest[0] === "show" || rest[0] === "get-url"
  if (sub === "reflog") return rest.length === 0 || rest[0] === "show"
  return false
}

function checkGit(agent: TeamAgent, args: string[], dir: string, ctx: ShellContext): Decision {
  let cwd = dir
  let k = 0
  while (k < args.length) {
    const a = args[k]
    if (a === "-C" || a === "--work-tree") { cwd = resolvePath(args[k + 1] ?? ".", cwd); k += 2; continue }
    if (a.startsWith("--work-tree=")) { cwd = resolvePath(a.slice("--work-tree=".length), cwd); k++; continue }
    if (a === "-c" || a === "--git-dir" || a === "--namespace") { k += 2; continue }
    if (a.startsWith("-")) { k++; continue }
    break
  }
  const sub = (args[k] ?? "").toLowerCase()
  const rest = args.slice(k + 1)
  if (sub === "" || isReadOnlyGit(sub, rest)) return allow
  const rel = toRel(ctx.root, cwd)
  if (rel === null) return allow
  const r = rel.toLowerCase()

  if (r === "product" || r.startsWith("product/")) {
    if (isDeveloper(agent) && (sub === "merge" || sub === "revert")) return allow
    if (agent === "scrum-master" && (["init", "worktree", "tag", "config"].includes(sub) || (sub === "commit" && rest.includes("--allow-empty"))))
      return allow
    return deny(`git ${sub} is not allowed in product/ — developers only merge or revert there during the merge window; everything else happens in your own sandbox`)
  }

  const sandbox = r.match(/^sandboxes\/([^/]+)/)
  if (sandbox) {
    if (sandbox[1] === handleOf(agent)) return allow
    if (agent === "scrum-master" && (sub === "config" || sub === "worktree")) return allow
    return deny(`git ${sub} would change ${sandbox[1]}'s sandbox — only ${sandbox[1]} may do that`)
  }

  if (agent === "scrum-master") {
    if (["add", "commit", "init"].includes(sub)) return allow
    if (sub === "restore" && rest.includes("--staged")) return allow
    if (sub === "reset" && !rest.includes("--hard")) return allow
  }
  return deny(`git ${sub} in the workspace repo is reserved for the Scrum Master — workspace files are committed at the end of each event`)
}

function checkUnknown(agent: TeamAgent, name: string, args: string[], dir: string, ctx: ShellContext): Decision {
  const rel = toRel(ctx.root, dir)
  if (rel !== null && !canWrite(agent, rel === "" ? ".probe" : `${rel}/.probe`, false).allow)
    return deny(`"${name}" may write files in ${rel || "the workspace root"}, which you don't own — run it with workdir set to your own sandbox`)
  for (const arg of args) {
    for (const piece of arg.split(/[\s'"`(),;=]+/)) {
      if (!piece.includes("/") && !piece.includes("\\")) continue
      const pieceRel = toRel(ctx.root, resolvePath(piece, dir))
      if (pieceRel === null) continue
      if (!canWrite(agent, pieceRel, true).allow)
        return deny(`"${name}" references ${pieceRel}, which you don't own — read other members' files with the read tool instead`)
    }
  }
  return allow
}

function checkCommand(agent: TeamAgent, name: string, args: string[], dir: string, ctx: ShellContext): Decision {
  if (name === "git") return checkGit(agent, args, dir, ctx)
  const targets = mutationTargets(name, args)
  if (targets) {
    for (const t of targets) {
      const d = checkTarget(agent, t, dir, ctx)
      if (!d.allow) return d
    }
    return allow
  }
  const risky =
    (name === "find" && args.some((a) => ["-delete", "-exec", "-execdir", "-ok", "-okdir"].includes(a) || a.startsWith("-fprint"))) ||
    (name === "sort" && args.some((a) => a === "-o" || a.startsWith("--output"))) ||
    (name === "env" && args.length > 0)
  if (READ_ONLY.has(name) && !risky) return allow
  if (args.length === 1 && VERSION_FLAGS.has(args[0])) return allow
  return checkUnknown(agent, name, args, dir, ctx)
}

/** Heuristic check that a shell command only writes where `agent` may write. */
export function checkShell(agent: TeamAgent, command: string, cwd: string, ctx: ShellContext, depth = 0): Decision {
  const inner: string[] = []
  const segs = segments(lex(command, inner))
  if (depth < 4) {
    for (const sub of inner) {
      const d = checkShell(agent, sub, cwd, ctx, depth + 1)
      if (!d.allow) return d
    }
  }
  let dir = cwd
  for (const seg of segs) {
    for (const target of seg.redirects) {
      const d = checkTarget(agent, target, dir, ctx)
      if (!d.allow) return d
    }
    const words = stripPrefixes(seg.words)
    if (words.length === 0) continue
    const name = commandName(words[0])
    const args = words.slice(1)
    if (name === "cd" || name === "pushd") {
      dir = args[0] && args[0] !== "-" ? resolvePath(args[0], dir) : "/~home"
      continue
    }
    const scriptFlag = args.findIndex((a) => /^-[a-z]*c$/.test(a))
    if ((name === "bash" || name === "sh" || name === "zsh") && scriptFlag >= 0 && args[scriptFlag + 1] !== undefined) {
      if (depth >= 4) return deny("shell nesting is too deep to verify")
      const d = checkShell(agent, args[scriptFlag + 1], dir, ctx, depth + 1)
      if (!d.allow) return d
      continue
    }
    const d = checkCommand(agent, name, args, dir, ctx)
    if (!d.allow) return d
  }
  return allow
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test .opencode/team-guard/shell.test.ts`
Expected: PASS (7 tests). If a case fails, fix `shell.ts` (not the test) unless the test contradicts the spec's §5.

- [ ] **Step 5: Commit**

```bash
git add .opencode/team-guard && git commit -m "feat(guard): detect writes in shell commands"
```

### Task 4: Tool evaluation, identity and direct-call cap

**Files:**
- Create: `.opencode/team-guard/guard.ts`
- Test: `.opencode/team-guard/guard.test.ts`

**Interfaces:**
- Consumes: Task 2 and Task 3 exports.
- Produces: `type GuardContext = ShellContext & { directCalls: number; directCallLimit: number }`, `type Verdict = Decision & { directCall?: boolean }`, `evaluateTool(agent: TeamAgent, tool: string, args: Record<string, unknown>, ctx: GuardContext): Verdict`, `patchTargets(patchText: string): { path: string; creates: boolean }[]`, `identityEnv(agent: TeamAgent): Record<string, string>`, `portBase(agent: TeamAgent): number | undefined`, `parseDirectCallLimit(text: string | undefined): number`. Re-exports `isTeamAgent`, `TeamAgent`.

- [ ] **Step 1: Write the failing test** `.opencode/team-guard/guard.test.ts`

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { evaluateTool, identityEnv, parseDirectCallLimit, patchTargets, portBase } from "./guard.ts"

const root = "C:/Users/jannik/scrum"
const ctx = (over: Partial<{ directCalls: number; directCallLimit: number; exists: (p: string) => boolean }> = {}) => ({
  root,
  exists: () => false,
  directCalls: 0,
  directCallLimit: 1,
  ...over,
})

test("edit and write check ownership", () => {
  assert.equal(evaluateTool("dev-2", "write", { filePath: `${root}/team/knowledge/dev-2/a.md` }, ctx()).allow, true)
  assert.equal(evaluateTool("dev-2", "write", { filePath: `${root}\\team\\knowledge\\dev-4\\a.md` }, ctx()).allow, false)
  assert.equal(evaluateTool("dev-2", "edit", { filePath: "sandboxes/dev-2/src/a.ts" }, ctx()).allow, true)
  assert.equal(evaluateTool("dev-2", "write", { filePath: "C:/Windows/x.txt" }, ctx()).allow, false)
})

test("channel files are immutable through edit", () => {
  const file = `${root}/team/channel/20260928-1412-dev-2-to-all-info-x.md`
  assert.equal(evaluateTool("dev-2", "write", { filePath: file }, ctx()).allow, true)
  assert.equal(evaluateTool("dev-2", "edit", { filePath: file }, ctx({ exists: () => true })).allow, false)
})

test("apply_patch checks every file header", () => {
  const patch = [
    "*** Begin Patch",
    "*** Update File: sandboxes/dev-2/src/a.ts",
    "@@",
    "-a",
    "+b",
    "*** Add File: team/knowledge/dev-4/stolen.md",
    "+x",
    "*** End Patch",
  ].join("\n")
  assert.deepEqual(patchTargets(patch), [
    { path: "sandboxes/dev-2/src/a.ts", creates: false },
    { path: "team/knowledge/dev-4/stolen.md", creates: true },
  ])
  assert.equal(evaluateTool("dev-2", "apply_patch", { patchText: patch }, ctx()).allow, false)
  const own = "*** Begin Patch\n*** Add File: team/knowledge/dev-2/n.md\n+x\n*** End Patch"
  assert.equal(evaluateTool("dev-2", "apply_patch", { patchText: own }, ctx()).allow, true)
})

test("bash uses workdir", () => {
  assert.equal(evaluateTool("dev-2", "bash", { command: "npm test", workdir: `${root}/sandboxes/dev-2` }, ctx()).allow, true)
  assert.equal(evaluateTool("dev-2", "bash", { command: "npm test" }, ctx()).allow, false)
})

test("direct calls are capped for developers only", () => {
  const first = evaluateTool("dev-2", "task", { subagent_type: "dev-4" }, ctx())
  assert.equal(first.allow, true)
  assert.equal(first.directCall, true)
  assert.equal(evaluateTool("dev-2", "task", { subagent_type: "dev-4" }, ctx({ directCalls: 1 })).allow, false)
  assert.equal(evaluateTool("dev-2", "task", { subagent_type: "po" }, ctx({ directCalls: 0, directCallLimit: 0 })).allow, false)
  const sm = evaluateTool("scrum-master", "task", { subagent_type: "dev-1" }, ctx({ directCalls: 9 }))
  assert.equal(sm.allow, true)
  assert.equal(sm.directCall, undefined)
})

test("other tools pass", () => {
  assert.equal(evaluateTool("dev-2", "read", { filePath: `${root}/team/knowledge/dev-4/a.md` }, ctx()).allow, true)
})

test("identity env and ports", () => {
  assert.deepEqual(identityEnv("dev-3"), {
    GIT_AUTHOR_NAME: "dev-3",
    GIT_AUTHOR_EMAIL: "dev-3@team.local",
    GIT_COMMITTER_NAME: "dev-3",
    GIT_COMMITTER_EMAIL: "dev-3@team.local",
    TEAM_MEMBER: "dev-3",
    TEAM_PORT_BASE: "3300",
  })
  assert.equal(identityEnv("scrum-master").GIT_AUTHOR_EMAIL, "sm@team.local")
  assert.equal(identityEnv("scrum-master").TEAM_PORT_BASE, undefined)
  assert.equal(portBase("product-owner"), 3900)
  assert.equal(portBase("dev-5"), 3500)
})

test("direct-call limit comes from working agreements", () => {
  assert.equal(parseDirectCallLimit("| direct_calls_per_block | 2 | 0–2 |"), 2)
  assert.equal(parseDirectCallLimit("direct_calls_per_block: 0"), 0)
  assert.equal(parseDirectCallLimit("nothing here"), 1)
  assert.equal(parseDirectCallLimit(undefined), 1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test .opencode/team-guard/guard.test.ts`
Expected: FAIL — `Cannot find module .../guard.ts`

- [ ] **Step 3: Write `.opencode/team-guard/guard.ts`**

```ts
import { allow, canWrite, deny, handleOf, isDeveloper, type Decision, type TeamAgent } from "./ownership.ts"
import { resolvePath, toRel } from "./paths.ts"
import { checkShell, type ShellContext } from "./shell.ts"

export { isTeamAgent, type TeamAgent } from "./ownership.ts"

export type GuardContext = ShellContext & { directCalls: number; directCallLimit: number }
export type Verdict = Decision & { directCall?: boolean }

export function patchTargets(patchText: string): { path: string; creates: boolean }[] {
  const targets: { path: string; creates: boolean }[] = []
  for (const line of patchText.split(/\r?\n/)) {
    const file = line.match(/^\*\*\* (Add|Update|Delete) File: (.+)$/)
    if (file) { targets.push({ path: file[2].trim(), creates: file[1] === "Add" }); continue }
    const move = line.match(/^\*\*\* Move to: (.+)$/)
    if (move) targets.push({ path: move[1].trim(), creates: true })
  }
  return targets
}

function checkFile(agent: TeamAgent, filePath: string, creates: boolean | undefined, ctx: GuardContext): Decision {
  if (!filePath) return allow
  const abs = resolvePath(filePath, ctx.root)
  const rel = toRel(ctx.root, abs)
  if (rel === null) return deny(`${filePath} is outside the team workspace`)
  return canWrite(agent, rel, creates === false ? true : ctx.exists(abs))
}

export function evaluateTool(agent: TeamAgent, tool: string, args: Record<string, unknown>, ctx: GuardContext): Verdict {
  switch (tool) {
    case "edit":
    case "write":
      return checkFile(agent, String(args.filePath ?? ""), undefined, ctx)
    case "apply_patch": {
      for (const t of patchTargets(String(args.patchText ?? ""))) {
        const d = checkFile(agent, t.path, t.creates, ctx)
        if (!d.allow) return d
      }
      return allow
    }
    case "bash": {
      const cwd = typeof args.workdir === "string" && args.workdir !== "" ? resolvePath(args.workdir, ctx.root) : ctx.root
      return checkShell(agent, String(args.command ?? ""), cwd, ctx)
    }
    case "task": {
      if (!isDeveloper(agent)) return allow
      if (ctx.directCalls >= ctx.directCallLimit)
        return deny(`direct-call limit reached (${ctx.directCallLimit} per work block) — post a message in team/channel/ instead; the Scrum Master routes it in the next help round`)
      return { allow: true, directCall: true }
    }
    default:
      return allow
  }
}

export function portBase(agent: TeamAgent): number | undefined {
  if (agent === "product-owner") return 3900
  const dev = agent.match(/^dev-(\d)$/)
  return dev ? 3000 + Number(dev[1]) * 100 : undefined
}

export function identityEnv(agent: TeamAgent): Record<string, string> {
  const email = `${handleOf(agent)}@team.local`
  const env: Record<string, string> = {
    GIT_AUTHOR_NAME: agent,
    GIT_AUTHOR_EMAIL: email,
    GIT_COMMITTER_NAME: agent,
    GIT_COMMITTER_EMAIL: email,
    TEAM_MEMBER: agent,
  }
  const base = portBase(agent)
  if (base !== undefined) env.TEAM_PORT_BASE = String(base)
  return env
}

export function parseDirectCallLimit(text: string | undefined): number {
  const m = text?.match(/direct_calls_per_block\W+(\d+)/)
  return m ? Number(m[1]) : 1
}
```

Note on `checkFile`: for `apply_patch` Update/Delete headers (`creates === false`) the file is treated as existing, so channel messages can never be modified through a patch.

- [ ] **Step 4: Run all guard tests**

Run: `node --test .opencode/team-guard/*.test.ts`
Expected: PASS (all tests in 3 files)

- [ ] **Step 5: Commit**

```bash
git add .opencode/team-guard && git commit -m "feat(guard): evaluate tool calls, identities and direct-call cap"
```

### Task 5: Plugin wiring

**Files:**
- Create: `.opencode/plugin/team-guard.ts`
- Test: `.opencode/team-guard/plugin.test.ts`

**Interfaces:**
- Consumes: `evaluateTool`, `identityEnv`, `isTeamAgent`, `parseDirectCallLimit` (Task 4).
- Produces: default export `{ id: "team-guard", server }`; hooks `chat.message`, `tool.execute.before`, `shell.env`; log file `<root>/.opencode/logs/guard.jsonl` with JSON lines `{ ts, event: "blocked" | "direct-call", agent, tool, reason?, target? }`.

- [ ] **Step 1: Write the failing test** `.opencode/team-guard/plugin.test.ts`

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import plugin from "../plugin/team-guard.ts"

async function setup() {
  const root = mkdtempSync(join(tmpdir(), "team-guard-"))
  mkdirSync(join(root, "scrum"), { recursive: true })
  writeFileSync(join(root, "scrum", "working-agreements.md"), "| direct_calls_per_block | 1 | 0–2 |\n")
  const hooks: any = await plugin.server({ directory: root, worktree: root } as any)
  const say = (sessionID: string, agent: string) => hooks["chat.message"]({ sessionID, agent }, { message: {}, parts: [] })
  const run = (sessionID: string, tool: string, args: any) =>
    hooks["tool.execute.before"]({ tool, sessionID, callID: "c1" }, { args })
  return { root, hooks, say, run }
}

test("exports only a v1 plugin module", () => {
  assert.equal(plugin.id, "team-guard")
  assert.equal(typeof plugin.server, "function")
})

test("blocks team agents writing into someone else's knowledge and logs it", async () => {
  const { root, say, run } = await setup()
  await say("s1", "dev-2")
  await run("s1", "write", { filePath: join(root, "team/knowledge/dev-2/a.md"), content: "x" })
  await assert.rejects(run("s1", "write", { filePath: join(root, "team/knowledge/dev-4/a.md"), content: "x" }), /team-guard/)
  const log = readFileSync(join(root, ".opencode/logs/guard.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l))
  assert.equal(log.length, 1)
  assert.equal(log[0].event, "blocked")
  assert.equal(log[0].agent, "dev-2")
})

test("does not restrict the user's own agents", async () => {
  const { root, say, run } = await setup()
  await say("s2", "build")
  await run("s2", "write", { filePath: join(root, "team/knowledge/dev-4/a.md"), content: "x" })
  await run("s3", "write", { filePath: join(root, "opencode.json"), content: "{}" })
})

test("caps direct calls per work block and resets on the next message", async () => {
  const { say, run } = await setup()
  await say("s4", "dev-1")
  await run("s4", "task", { subagent_type: "dev-3", prompt: "help" })
  await assert.rejects(run("s4", "task", { subagent_type: "dev-3", prompt: "again" }), /direct-call limit/)
  await say("s4", "dev-1")
  await run("s4", "task", { subagent_type: "dev-3", prompt: "next block" })
})

test("injects git identity for team shells only", async () => {
  const { hooks, say } = await setup()
  await say("s5", "dev-5")
  const out = { env: {} as Record<string, string> }
  await hooks["shell.env"]({ cwd: "x", sessionID: "s5" }, out)
  assert.equal(out.env.GIT_AUTHOR_NAME, "dev-5")
  assert.equal(out.env.TEAM_PORT_BASE, "3500")
  const other = { env: {} as Record<string, string> }
  await hooks["shell.env"]({ cwd: "x", sessionID: "unknown" }, other)
  assert.deepEqual(other.env, {})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test .opencode/team-guard/plugin.test.ts`
Expected: FAIL — `Cannot find module .../plugin/team-guard.ts`

- [ ] **Step 3: Write `.opencode/plugin/team-guard.ts`**

```ts
import type { Plugin } from "@opencode-ai/plugin"
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { evaluateTool, identityEnv, isTeamAgent, parseDirectCallLimit } from "../team-guard/guard.ts"

// Enforces the Scrum team's ownership rules (see AGENTS.md). Only the seven team agents are restricted.
const server: Plugin = async ({ directory, worktree }) => {
  const root = worktree && worktree !== "/" ? worktree : directory
  const agentBySession = new Map<string, string>()
  const directCalls = new Map<string, number>()

  const log = (entry: Record<string, unknown>) => {
    try {
      const dir = join(root, ".opencode", "logs")
      mkdirSync(dir, { recursive: true })
      appendFileSync(join(dir, "guard.jsonl"), JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n")
    } catch {
      // logging must never break a tool call
    }
  }

  const directCallLimit = () => {
    try {
      return parseDirectCallLimit(readFileSync(join(root, "scrum", "working-agreements.md"), "utf8"))
    } catch {
      return parseDirectCallLimit(undefined)
    }
  }

  return {
    "chat.message": async (input) => {
      if (input.agent) agentBySession.set(input.sessionID, input.agent)
      directCalls.set(input.sessionID, 0)
    },

    "tool.execute.before": async (input, output) => {
      const agent = agentBySession.get(input.sessionID)
      if (!isTeamAgent(agent)) return
      const args = (output.args ?? {}) as Record<string, unknown>
      const used = directCalls.get(input.sessionID) ?? 0
      const verdict = evaluateTool(agent, input.tool, args, {
        root,
        exists: (p) => existsSync(p),
        directCalls: used,
        directCallLimit: directCallLimit(),
      })
      if (!verdict.allow) {
        log({ event: "blocked", agent, tool: input.tool, reason: verdict.reason })
        throw new Error(`[team-guard] Blocked: ${verdict.reason}`)
      }
      if (verdict.directCall) {
        directCalls.set(input.sessionID, used + 1)
        log({ event: "direct-call", agent, tool: input.tool, target: args.subagent_type })
      }
    },

    "shell.env": async (input, output) => {
      const agent = input.sessionID ? agentBySession.get(input.sessionID) : undefined
      if (isTeamAgent(agent)) Object.assign(output.env, identityEnv(agent))
    },
  }
}

export default { id: "team-guard", server }
```

- [ ] **Step 4: Run all guard tests**

Run: `node --test .opencode/team-guard/*.test.ts`
Expected: PASS (all tests in 4 files)

- [ ] **Step 5: Commit**

```bash
git add .opencode/plugin .opencode/team-guard && git commit -m "feat(guard): wire ownership guard into opencode plugin hooks"
```

### Task 6: Agent configuration + consistency test

**Files:**
- Create: `opencode.json`, `.opencode/prompts/{scrum-master,product-owner,developer}.md` (one-line stubs replaced in Task 7)
- Test: `.opencode/team-guard/config.test.ts`

**Interfaces:**
- Consumes: `TEAM_AGENTS`, `canWrite` (Task 2).
- Produces: agent ids and permission blocks used by prompts/commands.

- [ ] **Step 1: Write the failing test** `.opencode/team-guard/config.test.ts`

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { TEAM_AGENTS, canWrite } from "./ownership.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const config = JSON.parse(readFileSync(join(root, "opencode.json"), "utf8"))
type Rule = { permission: string; pattern: string; action: string }

// Same semantics as opencode 1.18.16 Permission.fromConfig / evaluate / Wildcard.match (win32: case-insensitive).
function rules(permission: Record<string, unknown>): Rule[] {
  const out: Rule[] = []
  for (const [key, value] of Object.entries(permission)) {
    if (typeof value === "string") out.push({ permission: key, pattern: "*", action: value })
    else for (const [pattern, action] of Object.entries(value as Record<string, string>)) out.push({ permission: key, pattern, action })
  }
  return out
}
function match(input: string, pattern: string) {
  let escaped = pattern.replaceAll("\\", "/").replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")
  if (escaped.endsWith(" .*")) escaped = escaped.slice(0, -3) + "( .*)?"
  return new RegExp("^" + escaped + "$", "si").test(input.replaceAll("\\", "/"))
}
function evaluate(permission: string, pattern: string, rs: Rule[]) {
  return rs.findLast((r) => match(permission, r.permission) && match(pattern, r.pattern))?.action ?? "ask"
}

const SAMPLES = [
  "AGENTS.md", "opencode.json", "README.md", ".opencode/prompts/developer.md", "docs/x.md", "random.txt",
  "product/src/index.ts",
  "sandboxes/dev-1/src/a.ts", "sandboxes/dev-3/package.json", "sandboxes/po/notes.txt",
  "team/roster.md", "team/knowledge/sm/profile.md", "team/knowledge/po/profile.md",
  "team/knowledge/dev-1/notes/a.md", "team/knowledge/dev-4/journal.md",
  "team/channel/20260928-1412-sm-to-all-info-kickoff.md",
  "team/channel/20260928-1412-po-to-dev-2-acceptance-s-003.md",
  "team/channel/20260928-1412-dev-1-to-dev-2-help-db-setup.md",
  "team/channel/20260928-1412-dev-4-to-po-question-s-007.md",
  "scrum/product-vision.md", "scrum/product-backlog.md", "scrum/definition-of-ready.md",
  "scrum/definition-of-done.md", "scrum/working-agreements.md", "scrum/metrics.md",
  "scrum/sprints/sprint-01/plan.md", "scrum/sprints/sprint-01/daily/day-1.md",
  "scrum/sprints/sprint-01/backlog/dev-1.md", "scrum/sprints/sprint-01/backlog/dev-5.md",
]

test("global settings", () => {
  assert.equal(config.default_agent, "scrum-master")
  assert.equal(config.subagent_depth, 2)
  assert.equal(config.shell, "bash")
  assert.deepEqual(config.instructions, ["scrum/working-agreements.md", "scrum/definition-of-done.md"])
  assert.equal(config.permission, undefined, "team permissions must stay per agent")
  for (const file of config.instructions) assert.ok(existsSync(join(root, file)), file)
})

test("every team agent exists with a resolvable prompt", () => {
  for (const name of TEAM_AGENTS) {
    const agent = config.agent?.[name]
    assert.ok(agent, `agent ${name} missing`)
    const refs = [...String(agent.prompt).matchAll(/\{file:([^}]+)\}/g)].map((m) => m[1])
    assert.equal(refs.length, 1, `${name} must reference exactly one prompt file`)
    assert.ok(existsSync(join(root, refs[0])), `${name} prompt ${refs[0]} missing`)
  }
  assert.equal(config.agent["scrum-master"].mode, "primary")
  assert.equal(config.agent["product-owner"].mode, "all")
  for (const dev of ["dev-1", "dev-2", "dev-3", "dev-4", "dev-5"]) {
    assert.equal(config.agent[dev].mode, "subagent")
    assert.match(config.agent[dev].prompt, new RegExp(`\\*\\*${dev}\\*\\*`))
  }
})

test("no team rule ever asks, and restrictive permissions start with deny-all", () => {
  for (const name of TEAM_AGENTS) {
    const permission = config.agent[name].permission
    for (const rule of rules(permission)) assert.notEqual(rule.action, "ask", `${name} ${rule.permission} ${rule.pattern}`)
    for (const key of ["edit", "task", "external_directory"]) {
      const first = Object.entries(permission[key])[0]
      assert.deepEqual(first, ["*", "deny"], `${name}.${key} must start with "*": "deny"`)
    }
    assert.ok(permission.bash, `${name} needs explicit bash rules`)
    assert.ok(permission.question, `${name} needs an explicit question rule`)
  }
})

test("edit permissions agree with the guard's ownership model", () => {
  for (const name of TEAM_AGENTS) {
    const rs = rules(config.agent[name].permission)
    for (const sample of SAMPLES) {
      const fromConfig = evaluate("edit", sample, rs)
      const fromGuard = canWrite(name, sample, false).allow ? "allow" : "deny"
      assert.equal(fromConfig, fromGuard, `${name} → ${sample}`)
    }
  }
})

test("task permissions: SM delegates, developers may ask teammates or the PO, never themselves", () => {
  const task = (name: string, target: string) => evaluate("task", target, rules(config.agent[name].permission))
  assert.equal(task("scrum-master", "dev-3"), "allow")
  assert.equal(task("scrum-master", "product-owner"), "allow")
  assert.equal(task("scrum-master", "general"), "deny")
  assert.equal(task("product-owner", "dev-1"), "deny")
  assert.equal(task("dev-2", "dev-4"), "allow")
  assert.equal(task("dev-2", "product-owner"), "allow")
  assert.equal(task("dev-2", "dev-2"), "deny")
  assert.equal(task("dev-2", "scrum-master"), "deny")
  assert.equal(task("dev-2", "general"), "deny")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test .opencode/team-guard/config.test.ts`
Expected: FAIL — `ENOENT ... opencode.json`

- [ ] **Step 3: Write prompt stubs** (`# placeholder` one-liners in the three prompt files, replaced in Task 7) and `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "default_agent": "scrum-master",
  "subagent_depth": 2,
  "shell": "bash",
  "instructions": ["scrum/working-agreements.md", "scrum/definition-of-done.md"],
  "agent": {
    "scrum-master": {
      "description": "Scrum Master: facilitates every Scrum event, runs the sprint mechanics and drives continuous improvement. Does not assign work or write product code.",
      "mode": "primary",
      "color": "#8b5cf6",
      "steps": 500,
      "prompt": "{file:./.opencode/prompts/scrum-master.md}",
      "permission": {
        "edit": {
          "*": "deny",
          "scrum/*": "allow",
          "scrum/product-vision.md": "deny",
          "scrum/product-backlog.md": "deny",
          "scrum/definition-of-ready.md": "deny",
          "scrum/sprints/*/backlog/*": "deny",
          "team/roster.md": "allow",
          "team/knowledge/sm/*": "allow",
          "team/channel/*-sm-to-*": "allow"
        },
        "bash": { "*": "allow", "git push*": "deny" },
        "task": { "*": "deny", "product-owner": "allow", "dev-*": "allow" },
        "external_directory": { "*": "deny" },
        "question": "allow",
        "todowrite": "allow",
        "webfetch": "allow"
      }
    },
    "product-owner": {
      "description": "Product Owner: owns the product vision, the ordered Product Backlog and the Definition of Ready; accepts or rejects stories; answers product questions.",
      "mode": "all",
      "color": "#f59e0b",
      "steps": 80,
      "prompt": "{file:./.opencode/prompts/product-owner.md}",
      "permission": {
        "edit": {
          "*": "deny",
          "scrum/product-vision.md": "allow",
          "scrum/product-backlog.md": "allow",
          "scrum/definition-of-ready.md": "allow",
          "team/knowledge/po/*": "allow",
          "team/channel/*-po-to-*": "allow",
          "sandboxes/po/*": "allow"
        },
        "bash": { "*": "allow", "git push*": "deny" },
        "task": { "*": "deny" },
        "external_directory": { "*": "deny" },
        "question": "allow",
        "todowrite": "allow",
        "webfetch": "allow"
      }
    },
    "dev-1": {
      "description": "Developer dev-1 of the Scrum team (focus area: see team/roster.md). Works only in sandboxes/dev-1.",
      "mode": "subagent",
      "color": "#3b82f6",
      "steps": 80,
      "prompt": "You are **dev-1**, one of five Developers on the Scrum team. Handle: dev-1. Sandbox: sandboxes/dev-1. Knowledge folder: team/knowledge/dev-1. Sprint Backlog file: scrum/sprints/sprint-NN/backlog/dev-1.md. Port range: 3100-3199.\n\n{file:./.opencode/prompts/developer.md}",
      "permission": {
        "edit": {
          "*": "deny",
          "sandboxes/dev-1/*": "allow",
          "team/knowledge/dev-1/*": "allow",
          "scrum/sprints/*/backlog/dev-1.md": "allow",
          "team/channel/*-dev-1-to-*": "allow"
        },
        "bash": { "*": "allow", "git push*": "deny" },
        "task": { "*": "deny", "dev-*": "allow", "dev-1": "deny", "product-owner": "allow" },
        "external_directory": { "*": "deny" },
        "question": "deny",
        "todowrite": "allow",
        "webfetch": "allow"
      }
    }
  }
}
```

Add `dev-2` … `dev-5` entries identical to `dev-1` except: every `dev-1` → `dev-N`, port range `3N00-3N99`, colors dev-2 `#10b981`, dev-3 `#ef4444`, dev-4 `#06b6d4`, dev-5 `#ec4899`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test .opencode/team-guard/*.test.ts`
Expected: PASS (all 5 files)

- [ ] **Step 5: Commit**

```bash
git add opencode.json .opencode && git commit -m "feat: configure scrum team agents and permissions"
```

### Task 7: Role prompts and team handbook

**Files:**
- Create: `AGENTS.md`
- Modify: `.opencode/prompts/scrum-master.md`, `.opencode/prompts/product-owner.md`, `.opencode/prompts/developer.md` (replace stubs)

**Interfaces:**
- Consumes: agent ids, paths, channel/branch conventions (Global Constraints); playbook file names from Task 9 (`.opencode/playbooks/{kickoff,sprint,setup,planning,development-day,refinement,review,retro}.md`); template names from Task 8.
- Produces: the task-prompt header contract `PHASE / SPRINT / DAY / CONTEXT / RETURN` and the REPORT block format consumed by the SM playbooks.

- [ ] **Step 1: Write `AGENTS.md`** (≤ 90 lines; it is in every prompt) containing: team table (agent, handle, role); directory map; ownership summary (everyone reads everything; write only where you own; blocks are logged and discussed in the Retro; never work around a block — post a channel message); conventions (story ids `S-001`, sprint folders `sprint-01`, branches, commits, channel file name + front matter + reply-with-`re:` rule + "get the timestamp with `date +%Y%m%d-%H%M`, then create the file with the write tool"); "always pass `workdir` to the bash tool for sandbox commands"; where parameters/agreements/DoD live; golden rules (read knowledge before asking; short reports, details in files; flag blockers early and keep working on something else; evidence over opinion).

- [ ] **Step 2: Write `.opencode/prompts/developer.md`** covering:
  - Stance: self-managing, cross-functional, T-shaped Scrum Developer; focus area from `team/roster.md`; owns sandbox, knowledge folder, own Sprint Backlog file.
  - Call contract: every call starts with `PHASE:`; first read your Sprint Backlog file and channel messages to you/`all` newer than `last_channel_read` (front matter of your backlog file), then follow the phase section; on resumed sessions re-read before acting.
  - Phase sections: `setup-profile`, `planning`, `planning-commit`, `daily`, `work`, `help-round`, `merge`, `refinement`, `retro`, `direct-help` — each with concrete steps, including exact git commands (`git switch -c feature/S-XXX-slug main`, `git rebase main`, full test run, `git -C ../../product merge --no-ff --no-edit <branch>`, `git branch -d <branch>`, `git switch --detach main`, revert rule `git -C ../../product revert -m 1 --no-edit <merge-sha>`), review procedure (`git diff main...<branch>` from own sandbox, check acceptance criteria + DoD + tests, verdict file), help escalation (knowledge folders → channel message → at most `direct_calls_per_block` direct calls → switch task), WIP limit, TDD, knowledge notes, journal entries.
  - Rules: stay in your areas; bash `workdir` = your sandbox for builds/tests; use `$TEAM_PORT_BASE`…+99 for servers and stop them before returning; no `.env` files; never `--force`/`reset --hard` on shared refs; never commit in `product/`; if steps run low, commit WIP and report.
  - `direct-help` rules: advise only, never edit the requester's files, don't call anyone.
  - REPORT format (≤150 words):
    ```
    REPORT dev-N | phase: <phase> | story: S-xxx | status: todo|in-progress|in-review|approved|accepted|done|blocked
    done: …
    next: …
    blockers: none | …
    messages: <files posted> | none
    ready_to_merge: no | <branch> (review: <file>)
    ```

- [ ] **Step 3: Write `.opencode/prompts/product-owner.md`** covering: stance (maximize value, own the what/why, never the how); primary vs subagent behaviour (as subagent never use the question tool — record stakeholder-level questions under "Open questions for the stakeholder" in the backlog and decide provisionally); phases `planning-proposal`, `clarification`, `acceptance` (detached checkout in `sandboxes/po`, run the product/tests, criterion-by-criterion verdict, `acceptance` message with `verdict: accept|reject`), `refinement-draft`, `refinement-final`, `review-prep`, `review-feedback` (verbatim feedback → backlog changes + changelog section), `retro`; backlog rules (ordered, ids never reused, estimates only from developers, DoR); REPORT format `REPORT po | phase: … | items: …`.

- [ ] **Step 4: Write `.opencode/prompts/scrum-master.md`** covering: stance (servant leader, facilitator, process owner; never assign work, choose technical solutions or write product code; enforce timeboxes via parameters); "for every event read the matching playbook in `.opencode/playbooks/` and follow it exactly"; delegation mechanics (parallel task calls in ONE message; header contract `PHASE/SPRINT/DAY/CONTEXT/RETURN`; give paths, never paste files; resume with `task_id` from `<task id="…">` recorded in `sessions.md` within a sprint, fresh sessions each sprint; one retry on failure then impediment); state (`board.md` `Phase:` is the source of truth, set on entering a phase, phases idempotent on resume — check `git -C product log --merges` before re-merging); talking to the stakeholder (short progress lines between phases, full stop at the Review for feedback); workspace commits at the end of each event (`git add -A && git commit -m "scrum(sprint-NN): <event>"`); evidence collection for metrics.

- [ ] **Step 5: Verify and commit**

Run: `node --test .opencode/team-guard/*.test.ts` → PASS (prompt files still resolve). Check `AGENTS.md` line count ≤ 90 (`wc -l AGENTS.md`).
```bash
git add AGENTS.md .opencode/prompts && git commit -m "feat: add team handbook and role prompts"
```

### Task 8: Templates

**Files:**
- Create: `.opencode/templates/{product-vision,product-backlog,definition-of-ready,roster,profile,journal,sprint-plan,board,sessions,dev-backlog,daily,channel-message,review,retro}.md`

**Interfaces:**
- Produces: artifact formats referenced by prompts and playbooks. Key fields other files rely on: `board.md` has `Phase:` and `Started:` lines; `dev-backlog.md` front matter `owner`, `sprint`, `last_channel_read`; `channel-message.md` front matter `from`, `to`, `type`, `re`, `story`, `verdict`; `roster.md` front matter `status: ready`; backlog items `### S-001 · title` with `Status`, `Estimate`, `Blocked-by`, `Acceptance criteria`.

- [ ] **Step 1: Write each template** as a short skeleton with the fields above plus: vision (problem, users, value, scope/non-goals, tech stack, success measures); backlog (ordering rule, items, "Open questions for the stakeholder", "Changelog"); DoR (6 checks: user value stated, acceptance criteria testable, estimated ≤ `max_story_points`, dependencies known, fits a sprint, no open questions); roster (table handle/focus/ports/sandbox/knowledge); profile (focus, strengths, ask-me-about, tools/commands I know); journal (per-sprint entry: went well, didn't, learned, next time); sprint plan (goal, capacity math, forecast table owner/estimate/blocked-by, agreements in focus); board (Phase, Started, story table, impediments, merge queue); sessions (member → task id); dev backlog (items with tasks checklist, status, branch, notes); daily (per-dev lines, impediments, actions); review (increment, not done, goal met, how to try it, stakeholder feedback, backlog changes); retro (evidence, agreement check, perspectives, insights with 5-whys, decisions, parameter changes).

- [ ] **Step 2: Commit**

```bash
git add .opencode/templates && git commit -m "feat: add scrum artifact templates"
```

### Task 9: Playbooks and commands

**Files:**
- Create: `.opencode/playbooks/{kickoff,sprint,setup,planning,development-day,refinement,review,retro}.md`
- Create: `.opencode/command/{kickoff,sprint,planning,daily,review,retro,status}.md`

**Interfaces:**
- Consumes: prompts' phase names and REPORT formats (Task 7), templates (Task 8), parameters (Task 1).

- [ ] **Step 1: Write playbooks** implementing spec §9–§10 step by step:
  - `kickoff.md` (PO): existing-vision check; the two questions via the question tool (idea; tech stack with a "let the team propose" option); ≤3 follow-ups; write vision, DoR, 8–15 ordered stories with S-001 walking skeleton; hand-off message "switch to Scrum Master, run /sprint".
  - `sprint.md` (SM): preconditions; state detection (roster `status`, `product/.git`, latest sprint folder + `Phase:`); phase order `planning → day-1 … day-D → refinement → review → review-feedback → retro → done`; progress lines; stop at review; final summary.
  - `setup.md`: roster (5 stack-derived focus areas, ports); exact git commands (`git init -b main product`, `git -C product config user.name scrum-team`, `git -C product config user.email team@team.local`, `git -C product commit --allow-empty -m "chore: initialize repository"`, `git -C product config extensions.worktreeConfig true`, `git -C product worktree add --detach ../sandboxes/dev-N main` ×5 + `po`, worktree `user.name`/`user.email`), verification `git -C product worktree list`, parallel `setup-profile` calls, SM profile, set roster `status: ready`, workspace commit.
  - `planning.md`: folder + board; inputs; capacity (sprint 1 ≤ 13 points incl. skeleton; later avg of last 3 × (1 − buffer)); PO `planning-proposal`; parallel dev `planning`; estimate consensus (spread ≥ 2 Fibonacci steps → resume both extremes with each other's reasoning); PO `clarification` for questions; selection by PO order + `blocked-by`; self-selection conflict rule (preference rank → focus match → fewest points); sprint 1 skeleton-first with preparation work for others; parallel `planning-commit` (devs write their Sprint Backlog files); plan.md, board.md, sessions.md; commit.
  - `development-day.md`: A Daily (parallel, resumed), B Work block (parallel), C Help & review round (unanswered = no file with `re: <name>`; group by addressee; `to-all` help → best focus match; PO questions → PO `clarification`), D Merge window (serial: PO `acceptance` → author `merge` → verify merge commit), E end of day (board, early exit, commit).
  - `refinement.md`: PO draft → 2 focus-matched devs (parallel) → PO final → `refinement.md`.
  - `review.md`: compile increment; PO `review-prep`; write `review.md`; present + ask (question tool: "Looks good — continue" / "I have feedback"); set `Phase: review-feedback`; STOP. On feedback: PO `review-feedback`; tag `sprint-NN`; commit; continue with retro.
  - `retro.md`: evidence list with the exact sources (channel files, `git -C product log --merges`, `git -C product log --grep "^Revert"`, `.opencode/logs/guard.jsonl` since `Started:`, review.md, metrics); agreement check keep/adjust/drop; parallel perspectives (PO + devs); 5-whys; ≤3 new agreements ranked by supporters × evidence; parameter bounds; update agreements/archive/DoD/roster; metrics row; `Phase: done`; commit; keep agreements file ≤ ~60 lines.

- [ ] **Step 2: Write commands** — each with front matter `description` and `agent`, body pointing to the playbook, and `$ARGUMENTS`:
  - `kickoff.md` → `agent: product-owner`, playbook `kickoff.md`.
  - `sprint.md` → `agent: scrum-master`, playbook `sprint.md` (full cycle, resumable).
  - `planning.md`, `daily.md` (next development day A–E), `review.md` (review, or continue with feedback given as arguments), `retro.md` → `agent: scrum-master`, run only that phase of the current sprint.
  - `status.md` → `agent: scrum-master`: read board/plan/channel and print sprint, phase, story table, impediments, unanswered messages; change nothing.

- [ ] **Step 3: Verify and commit**

Run: `ls .opencode/playbooks .opencode/command` → 8 playbooks, 7 commands; `grep -L "^agent:" .opencode/command/*.md` → no output.
```bash
git add .opencode/playbooks .opencode/command && git commit -m "feat: add scrum event playbooks and commands"
```

### Task 10: README and headless verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**: what it is; quick start (open the folder in OpenCode Desktop → `/kickoff` → Tab to Scrum Master → `/sprint` → answer at the Review → `/sprint` again); commands table; how the team works (diagram of the cycle); where to look (board, channel, knowledge, metrics, agreements, guard log); tuning (parameters change only via Retro; per-agent `model` in `opencode.json`); safety (never click "Always allow"; ownership limits); running tests (`node --test .opencode/team-guard/*.test.ts`); starting over (delete `product/`, `sandboxes/`, `scrum/sprints/sprint-*`, reset scrum files via `git checkout`).

- [ ] **Step 2: Run the full unit suite**

Run: `node --test .opencode/team-guard/*.test.ts`
Expected: PASS, 0 failures.

- [ ] **Step 3: Headless opencode checks** (ask the user first; uses `npx opencode-ai@1.18.16`, no LLM calls):
  - `opencode debug config` → agents `scrum-master`, `product-owner`, `dev-1`…`dev-5` present; developer prompts contain the substituted developer prompt text.
  - `opencode debug agent dev-2 --tool write --params '{"filePath":"team/knowledge/dev-4/probe.md","content":"x"}'` → permission denied.
  - `opencode debug agent dev-2 --tool write --params '{"filePath":"team/knowledge/dev-2/probe.md","content":"x"}'` → succeeds (then delete the probe file).
  - `opencode debug agent scrum-master --tool write --params '{"filePath":"scrum/product-backlog.md","content":"x"}'` → denied.

- [ ] **Step 4: Commit**

```bash
git add README.md && git commit -m "docs: add user guide"
```
