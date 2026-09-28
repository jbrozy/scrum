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
