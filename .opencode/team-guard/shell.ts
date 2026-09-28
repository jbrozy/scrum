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
