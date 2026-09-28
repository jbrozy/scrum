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
