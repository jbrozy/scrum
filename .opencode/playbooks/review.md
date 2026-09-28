# Playbook: Sprint Review (Scrum Master facilitates, stakeholder attends)

Goal: inspect the increment with the stakeholder and adapt the Product Backlog.

## Part 1 — `Phase: review`
1. Compile from the board: stories `done` (merged and accepted) vs. not done (why), done points vs. planned,
   Sprint Goal met (yes/partly/no).
2. Resume the PO: `PHASE: review-prep`, CONTEXT = done and not-done story ids.
3. Write `scrum/sprints/sprint-NN/review.md` from `.opencode/templates/review.md` (increment, not done,
   how to try it, backlog outlook). Leave the feedback sections empty.
4. Present to the stakeholder (≤20 lines): Sprint Goal and whether it was met, what is new (user terms), how to try it
   (commands, run in `product/`), what is not done and why, what the PO plans next, and open questions for the
   stakeholder from the backlog.
5. Ask for feedback with the question tool — options "Looks good, continue", "I have feedback" — and invite free text
   (what to change, what matters most next).
6. Set `Phase: review-feedback` and **end your turn**. Do not continue without the stakeholder's answer.

## Part 2 — `Phase: review-feedback` (after the stakeholder answered)
1. Resume the PO: `PHASE: review-feedback`, CONTEXT = the stakeholder's answer verbatim, plus the not-done stories.
2. Fill "Stakeholder feedback" (verbatim) and "Backlog changes from feedback" in `review.md`.
3. Set not-done stories to `not-done` on the board (their branches stay; the PO put the stories back into the backlog).
4. Tag the increment: `git -C product tag -a sprint-NN -m "Sprint NN increment"`.
5. Commit: `git add -A && git commit -m "scrum(sprint-NN): review"`. Continue with `retro.md`.
