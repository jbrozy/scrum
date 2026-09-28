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
