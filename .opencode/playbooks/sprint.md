# Playbook: Sprint (Scrum Master) — one full cycle, resumable

## 1. Preconditions
If `scrum/product-vision.md` or `scrum/product-backlog.md` is missing, tell the stakeholder to run `/kickoff`
(it switches to the Product Owner) and stop.

## 2. Where are we?
1. If `team/roster.md` has `status: not-set-up` or `product/.git` does not exist → run `setup.md` first.
2. Find the newest `scrum/sprints/sprint-NN/`.
   - None, or its `board.md` says `Phase: done` → start sprint NN+1 (`sprint-01` first) at `planning`.
   - Otherwise resume the phase in its `board.md`. Tell the stakeholder: "Resuming sprint-NN at <phase>."

## 3. Phase order
```
planning → day-1 … day-D → refinement → review → review-feedback → retro → done
```
`D` = `days_per_sprint` from `scrum/working-agreements.md` (read it at planning; keep it for the whole sprint).
Each `day-d` has sub-phases `day-d/daily`, `day-d/work`, `day-d/help`, `day-d/merge`.

| phase | playbook |
|---|---|
| planning | `planning.md` |
| day-d/… | `development-day.md` |
| refinement | `refinement.md` |
| review, review-feedback | `review.md` |
| retro | `retro.md` |

Set `Phase:` in `board.md` whenever you enter a phase or sub-phase. After each phase give the stakeholder one
progress line.

## 4. Early end
If every forecast story is `done` before day D, skip the remaining days and continue with refinement.
If no story can progress (all blocked) for a whole day, skip to refinement and make it a Retro topic.

## 5. The Review pause
In `review` you present the increment and ask for feedback, then set `Phase: review-feedback` and **end your turn**.
When the stakeholder answers (in this conversation, or later via `/review <feedback>` or `/sprint`), continue at
`review-feedback`, then `retro`.

## 6. Finish
After the Retro set `Phase: done` and give the stakeholder a summary (≤12 lines):
goal met?, done vs planned points, what was not finished, agreements added/changed/dropped, parameter changes,
and "Run `/sprint` to start sprint-NN+1."
