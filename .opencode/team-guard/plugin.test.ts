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
