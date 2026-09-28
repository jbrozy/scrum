# Playbook: Development day d of D (Scrum Master facilitates)

Every call below resumes the member's session with the `task_id` from `sessions.md`.
Header for every call: `PHASE`, `SPRINT: sprint-NN | DAY: d/D`, `CONTEXT`, `RETURN: REPORT`.

## A. Daily Scrum — `Phase: day-d/daily`
The Daily belongs to the Developers: it is their planning for the next block. You keep it short and collect impediments.
1. Call all five developers in ONE message: `PHASE: daily`, CONTEXT = the board path and anything new since the last
   block (merged stories, answered messages, impediments you resolved).
2. Write `daily/day-d.md` (template `daily.md`): one row per developer, pairing/help they agreed, impediments.
3. Handle impediments right away:
   - process or tooling (unclear rule, merge order, missing access) → resolve it yourself or decide with the people involved;
   - product/scope questions → resume the PO with `PHASE: clarification`;
   - technical help → post an `info` channel message to the developer whose focus fits, asking them to help in the work block.
   Record each impediment and action on the board.

## B. Work block — `Phase: day-d/work`
Call all five developers in ONE message: `PHASE: work`, CONTEXT = their stories (and what the Daily decided for them),
the Sprint Goal, and for developers whose stories are still blocked: which supporting work to pick (reviews waiting
for them, preparation, knowledge notes). Update the board's story table from the REPORTs.

## C. Help & review round — `Phase: day-d/help`
1. List `team/channel/`. A message is **unanswered** if no other file names it in `re:`.
2. Group unanswered messages by addressee:
   - `dev-N` → that developer;
   - `po` → the PO with `PHASE: clarification`;
   - `sm` → handle it yourself (reply in the channel);
   - `all` of type `help` → the developer whose focus fits best (not the author);
   - `review-request` → the named reviewer.
3. Call all addressees in ONE message with `PHASE: help-round` and CONTEXT = their list of message files.
4. Stories whose reviews came back with `verdict: changes` go back to `in-progress` on the board.

## D. Merge window — `Phase: day-d/merge` (strictly one story at a time)
Candidates: stories with at least `required_approvals` reviews with `verdict: approve`, in plan order.
For each candidate:
1. If there is no `acceptance` with `verdict: accept` yet: resume the PO with `PHASE: acceptance`, CONTEXT = story and
   branch. On `reject`: the story goes back to `in-progress`; next candidate.
2. Skip if already merged (`git -C product log --merges --oneline | grep <branch>`).
3. Resume the author with `PHASE: merge`, CONTEXT = story, branch, review file, acceptance file. Wait for the REPORT.
4. Verify: `git -C product log --merges --oneline -3` shows the merge. Set the story to `done` on the board.
5. If the author reports a conflict they could not resolve, record an impediment and continue with the next candidate.

## E. End of day
1. Board: story statuses, impediments, one log line for the day.
2. If every story is `done` → continue with refinement. Otherwise the next day (or refinement after day D).
3. Commit: `git add -A && git commit -m "scrum(sprint-NN): day d"`.
4. Tell the stakeholder one line: e.g. "Day 2/3 — 2 done, 2 in review, 1 blocked (S-006, waiting for S-004)".
