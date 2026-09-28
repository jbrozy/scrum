# Playbook: Team setup (Scrum Master, first `/sprint` only)

Goal: roster, product repository, one git sandbox per developer plus one for the PO, and developer profiles.
Every step is safe to repeat: skip it when its result already exists.

## 1. Roster
Read `scrum/product-vision.md` (tech stack, scope). Choose 5 focus areas that together cover the product, derived from
the stack. Examples: web app → UI components, client state & UX, API/backend, data & persistence, quality & tooling
(CI, test strategy, build). CLI tool → command UX, core domain, I/O & integrations, packaging/release, testing.
Write `team/roster.md` from `.opencode/templates/roster.md` but keep `status: not-set-up` until step 5.

## 2. Product repository and sandboxes
Run in the workspace root (bash, no workdir), one command at a time, and check each result:
```
git init -b main product
git -C product config user.name "scrum-team"
git -C product config user.email "team@team.local"
git -C product config extensions.worktreeConfig true
git -C product config core.autocrlf false
git -C product commit --allow-empty -m "chore: initialize repository"
git -C product worktree add --detach ../sandboxes/dev-1 main
git -C product worktree add --detach ../sandboxes/dev-2 main
git -C product worktree add --detach ../sandboxes/dev-3 main
git -C product worktree add --detach ../sandboxes/dev-4 main
git -C product worktree add --detach ../sandboxes/dev-5 main
git -C product worktree add --detach ../sandboxes/po main
```
Then for each `h` in `dev-1 … dev-5, po`:
```
git -C sandboxes/<h> config --worktree user.name "<agent name>"
git -C sandboxes/<h> config --worktree user.email "<h>@team.local"
```
(`po` → agent name `product-owner`.) Verify with `git -C product worktree list` (7 lines: product + 6 sandboxes).

## 3. Profiles (parallel)
Call all five developers in ONE message:
```
PHASE: setup-profile
SPRINT: – | DAY: –
CONTEXT: roster team/roster.md, vision scrum/product-vision.md
RETURN: REPORT
```
Do not record these session ids (sprints start fresh sessions).

## 4. Your own profile
Write `team/knowledge/sm/profile.md` from `.opencode/templates/profile.md`: how the team's process runs, where to find
things, how to raise an impediment.

## 5. Finish
Set `status: ready` in `team/roster.md`. Commit the workspace: `git add -A && git commit -m "scrum: team setup"`.
Tell the stakeholder: the roster (handle → focus area) in a small table, then continue with Sprint Planning.
