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

// `creates === false` (patch Update/Delete) treats the file as existing, so channel messages can never be modified.
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
