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
