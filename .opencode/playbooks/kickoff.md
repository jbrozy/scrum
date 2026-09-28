# Playbook: Kickoff (Product Owner, primary)

Goal: turn the stakeholder's idea into a vision and an ordered, partly ready Product Backlog.

## 1. Existing product?
If `scrum/product-vision.md` exists, show its first lines and ask (question tool):
- "Keep it" → stop and tell the stakeholder to run `/sprint` as the Scrum Master.
- "Refine it" → continue with step 2, but keep existing story ids.
- "Start over" → explain that starting over needs a clean workspace first (see "Starting over" in `README.md`);
  stop.

## 2. The two kickoff questions
Ask with the question tool (free-text answers allowed):
1. **Basic product idea** — "What should the product do, and for whom?"
2. **Tech stack** — "Which tech stack should the team use?" Offer an option "Let the team propose one".

If extra text was passed with `/kickoff`, treat it as the answer to question 1 and only ask what is missing.

## 3. Follow-ups (optional, at most 3, in one batch)
Only if the answers leave real gaps: target users, must-haves for a first usable version, constraints / non-goals.

If the stakeholder wants a proposal for the stack: propose one concise stack (language, framework, storage,
test runner, how it runs locally) with a one-line rationale each, and confirm it.

## 4. Write the artifacts
- `scrum/product-vision.md` from `.opencode/templates/product-vision.md`.
- `scrum/definition-of-ready.md` from `.opencode/templates/definition-of-ready.md` (adapt wording to the product if useful).
- `scrum/product-backlog.md` from `.opencode/templates/product-backlog.md` with 8–15 stories covering roughly the
  first three sprints, ordered:
  - `S-001` is the **walking skeleton**: repository scaffold, build, test runner with one passing test, a README with
    run/test commands, and one trivial end-to-end path through the stack.
  - Every story has testable acceptance criteria and `Blocked-by` where needed. No estimates (Developers estimate).
  - Vertical slices (user-visible value) over technical layers.
- A short `team/knowledge/po/profile.md` from `.opencode/templates/profile.md` (the product in one paragraph, what to ask the PO about).

## 5. Hand-off
Summarize for the stakeholder in ≤10 lines: the vision in one sentence, the stack, the top 5 stories.
Then say: **"Switch to the Scrum Master (Tab) and run `/sprint` to set up the team and start Sprint 1."**
