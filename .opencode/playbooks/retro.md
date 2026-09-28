# Playbook: Sprint Retrospective (Scrum Master facilitates) — `Phase: retro`

Goal: find the workflows that did not work, change at most three things, and check next sprint whether the changes worked.

## 1. Evidence (you, before anyone else speaks)
Create `scrum/sprints/sprint-NN/retro.md` from `.opencode/templates/retro.md` and fill the Evidence table:
- planned vs. done points, carry-over — `plan.md`, `board.md`;
- acceptance rejections — channel files of type `acceptance` with `verdict: reject`;
- review turnaround — for each `review-request`, in which day's help round its `review` appeared (0 = same day);
- help messages — count this sprint, unanswered at sprint end;
- direct calls — `.opencode/logs/guard.jsonl`, `"event":"direct-call"` since the board's `Started:`;
- guard blocks — same file, `"event":"blocked"`: count per agent and the distinct reasons;
- rebase conflicts and other impediments — board;
- reverts on main — `git -C product log --grep "^Revert" --oneline`;
- stakeholder feedback — `review.md`.

## 2. Did last sprint's changes work?
For every active agreement in `scrum/working-agreements.md` whose "Check in" is this sprint: compare its success signal
with the evidence and decide **keep**, **adjust** or **drop**. Write the table "Check of active agreements".

## 3. Perspectives (6 calls in ONE message)
PO and all five developers (resumed):
```
PHASE: retro
SPRINT: sprint-NN | DAY: –
CONTEXT: evidence in scrum/sprints/sprint-NN/retro.md; agreements checked: <…>
RETURN: REPORT — went well / didn't (with evidence) / at most 2 proposals as problem → change → success signal
```
Fill the Perspectives table.

## 4. Insights
Cluster the "didn't go well" points. Pick the top **three at most** unsuccessful workflows, ranked by how many members
raised them and how strong the evidence is. For each, write a short 5-whys chain down to a root cause.

## 5. Decide
- At most **3 new** agreements per Retro (adjustments of existing ones don't count). Prefer proposals that address a
  root cause and have a measurable success signal. Proposals supported by more members win ties.
- Allowed parameter changes (stay inside the ranges in the parameter table): `days_per_sprint`, `wip_limit_per_dev`,
  `max_story_points`, `required_approvals`, `capacity_buffer_percent`, `review_routing`, `direct_calls_per_block`.
- Also possible: Definition of Done changes, focus-area changes in the roster (with a history row).
- Changes to prompts, playbooks, permissions or the guard are **not** yours to make: write them as
  "Proposals for the stakeholder" at the end of `retro.md` and mention them in the summary.

## 6. Record
- `scrum/working-agreements.md`: add `WA-NN` blocks (format in the file, numbering continues across sprints; set
  "Since" to the next sprint and "Check in" to the sprint after it), apply adjustments and parameter changes.
  Move dropped agreements to `scrum/agreements-archive.md` with the reason. Keep the file under ~60 lines.
- `scrum/definition-of-done.md` / `team/roster.md` if decided.
- `retro.md`: Decisions section.
- `scrum/metrics.md`: append this sprint's row.

## 7. Close the sprint
Set `Phase: done` on the board. Commit: `git add -A && git commit -m "scrum(sprint-NN): retro"`.
Then give the stakeholder the sprint summary described in `sprint.md` §6.
