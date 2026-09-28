# sprint-NN — Sprint Retrospective

## Evidence

| metric | value | source |
|---|---|---|
| planned / done points | | plan.md, board.md |
| carry-over stories | | board.md |
| acceptance rejections | | channel `acceptance` with `verdict: reject` |
| review turnaround (blocks) | | channel review-request → review |
| help messages (unanswered at end) | | channel |
| direct calls | | `.opencode/logs/guard.jsonl` event direct-call |
| rebase conflicts / impediments | | board.md, channel impediments |
| reverts on main | | `git -C product log --grep "^Revert" --oneline` |
| guard blocks (by agent, reason) | | `.opencode/logs/guard.jsonl` event blocked |
| stakeholder feedback | | review.md |

## Check of active agreements

| agreement | success signal | observed | decision (keep / adjust / drop) |
|---|---|---|---|

## Perspectives

| member | went well | didn't go well | proposals |
|---|---|---|---|

## Insights (top unsuccessful workflows)

### 1. <problem>
Why? → <…> → Why? → <…> → Why? → <root cause>

## Decisions
- New: WA-NN — <title>
- Adjusted: WA-NN — <what changed>
- Dropped: WA-NN — <reason> (moved to the archive)
- Parameters: <name: old → new>
- Definition of Done / roster changes: <…>
