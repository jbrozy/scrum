---
description: Show the current sprint status (read-only)
agent: scrum-master
---
Show the stakeholder the current status. Change nothing, call nobody, commit nothing.
Read the newest `scrum/sprints/sprint-NN/board.md` and `plan.md` and list `team/channel/`, then print:
1. Sprint, Sprint Goal and `Phase:`.
2. Story table: story, owner, estimate, status.
3. Open impediments.
4. Unanswered channel messages (no other file names them in `re:`), grouped by addressee.
5. Active working agreements (titles) and current parameters.
If no sprint exists yet, say whether `/kickoff` or `/sprint` is the next step.

$ARGUMENTS
