# Playbook: Sprint Planning (Scrum Master facilitates)

Goal: a Sprint Goal, a forecast the Developers believe in, and a Sprint Backlog file per developer.

## 1. Prepare
1. Create `scrum/sprints/sprint-NN/` with `plan.md` (template `sprint-plan.md`), `board.md` (template `board.md`,
   `Phase: planning`, `Started:` from `date -Iminutes`), `sessions.md` (template `sessions.md`) and folders
   `daily/` and `backlog/`.
2. Read `scrum/working-agreements.md` (parameters, agreements in focus), the previous sprint's `retro.md` (decisions)
   and `scrum/metrics.md`.
3. Capacity:
   - sprint 1: forecast limit 13 points including the walking skeleton;
   - later: average done points of the last ≤3 sprints × (1 − `capacity_buffer_percent`/100), rounded; minimum 5.

## 2. Product Owner proposes (1 call)
```
PHASE: planning-proposal
SPRINT: sprint-NN | DAY: –
CONTEXT: capacity <N> points, last review scrum/sprints/sprint-<NN-1>/review.md (if any)
RETURN: REPORT with Sprint Goal and ordered story ids
```
Record the PO's `task_id` in `sessions.md`.

## 3. Developers estimate and choose (5 calls in ONE message)
```
PHASE: planning
SPRINT: sprint-NN | DAY: –
CONTEXT: Sprint Goal "<…>"; candidate stories S-…, S-… (read them in scrum/product-backlog.md);
         capacity <N> points; max_story_points <M>
RETURN: REPORT (one line per story: estimate, risks, blocked-by, questions) + your top 2 preferences
```
Record each developer's `task_id` in `sessions.md`.

## 4. Consolidate
1. **Estimates:** take the value most developers gave. If the spread is ≥ 2 steps on 1-2-3-5-8, resume the highest and
   the lowest estimator (parallel) with each other's reasoning and ask for one agreed number. Write the discussion into
   the plan's notes.
2. **Too big:** stories above `max_story_points` go back to the PO to split (resume PO, `PHASE: clarification`) —
   or are left out of this sprint.
3. **Questions for the PO:** resume the PO once with all questions (`PHASE: clarification`).
4. **Selection:** take stories in the PO's order while the sum stays within the forecast limit and every
   `blocked-by` is either done or also selected earlier in the order.
5. **Self-selection:** give each story to the developer who ranked it higher; ties → better focus-area fit
   (roster) → fewer points already taken. A developer may own several stories but works on at most
   `wip_limit_per_dev` at a time. Developers without a story get supporting work (reviews, spikes, test plans,
   knowledge notes).
6. **Sprint 1:** S-001 (walking skeleton) goes to the developer whose focus is closest to tooling/build. Every other story
   is `blocked-by: S-001`; their owners do preparation that does not touch the repository scaffold until S-001 is merged.

## 5. Developers commit (5 calls in ONE message, resumed with task_id)
```
PHASE: planning-commit
SPRINT: sprint-NN | DAY: –
CONTEXT: your stories: S-… (estimate, blocked-by); Sprint Goal "<…>"; supporting work: <…>
RETURN: REPORT
```
If someone objects, resolve it with one more resume of the people involved, then continue.

## 6. Record
- `plan.md`: goal, capacity math, forecast table, supporting work, agreements in focus, planning notes.
- `board.md`: story table (status `todo`), empty impediments, `Phase: day-1/daily`.
- Tell the stakeholder the Sprint Goal and the forecast (story → owner) in ≤8 lines.
- Commit: `git add -A && git commit -m "scrum(sprint-NN): planning"`.
