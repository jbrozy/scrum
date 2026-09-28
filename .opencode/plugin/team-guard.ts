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
