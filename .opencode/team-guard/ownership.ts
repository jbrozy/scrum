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
