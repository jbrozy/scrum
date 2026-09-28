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
