@AGENTS.md

---

## 1. Project Summary

**HireFlow** is a frontend prototype for a Telegram-native candidate pipeline management platform. HR teams post vacancies, candidates apply via a Telegram bot, and HR moves them through a Kanban pipeline. The prototype is frontend-only with mocked data — the Telegram bot, real backend, and AI processing come in a later phase once UX is validated.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript |
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 (CSS-based config, no `tailwind.config.ts`) |
| State | Zustand v5 |
| Database | None — in-memory mock store |
| Auth | None (mock only) |
| Hosting | Not deployed yet (prototype only) |
| External APIs | None (all data is mocked) |

---

## 3. Folder Structure

```
HR app/
├── app/
│   ├── layout.tsx              # Root layout — mounts Sidebar + main, loads fonts
│   ├── globals.css             # Tailwind v4 + @theme tokens (data365 design system)
│   ├── page.tsx                # Redirects / → /vacancies
│   ├── vacancies/
│   │   ├── page.tsx            # Vacancy list (/vacancies)
│   │   └── [id]/page.tsx       # Vacancy Kanban — hero screen (/vacancies/[id])
│   └── candidates/
│       └── [id]/page.tsx       # Candidate profile, 3 tabs (/candidates/[applicationId])
├── components/
│   ├── Sidebar.tsx             # Left nav + "Simulate application" demo button
│   ├── Avatar.tsx              # Initials avatar, color-hashed by id
│   ├── StagePill.tsx           # Colored stage badge (maps color key → CSS classes)
│   ├── KanbanBoard.tsx         # Kanban container — owns draggingId ref, calls store
│   ├── KanbanColumn.tsx        # One stage column — handles dragover/drop, renders cards
│   ├── CandidateCard.tsx       # Draggable card (pure props, no store access)
│   ├── ScreeningAnswerRow.tsx  # One Q+A pair on Screening Answers tab
│   ├── TimelineEntry.tsx       # One event on Timeline tab
│   └── EmptyState.tsx          # Generic empty placeholder
├── lib/
│   ├── types.ts                # All TypeScript types
│   ├── mockData.ts             # Seed data: 3 vacancies, 20 candidates, 20 applications,
│   │                           # screening Q&A, timeline events, 3 simulate fixtures
│   ├── store.ts                # Zustand store — state + actions + selectors
│   └── utils.ts                # formatRelativeTime, timeInStage, hashColor, initials, cn, formatSalary, daysAgo
```

---

## 4. Environment Variables

None required. This is a frontend-only prototype with no external services.

---

## 5. Running the Project

```bash
# Install
npm install

# Development (starts on http://localhost:3000)
npm run dev

# Type check
npm run typecheck   # alias for tsc --noEmit

# Build
npm run build
```

---

## 6. Conventions & Patterns

**All page components are client components** — add `"use client"` at the top. Pages use `useStore()` from `@/lib/store` to read and mutate state.

**State:** Single Zustand store in `lib/store.ts`. All mutations go through store actions (`moveApplicationToStage`, `simulateIncomingApplication`). Never mutate state directly.

**Navigation:** `useRouter()` from `next/navigation` for programmatic nav. `<Link>` for static links.

**Candidate profile routes use `applicationId`, not `candidateId`** — all profile data (answers, timeline, stage) hangs off the application, not the candidate. `/candidates/[id]` where `id` is an `Application.id`.

**Styling:** Tailwind v4 utility classes only. One accent color: `primary` (`#3525CD`). Stage colors appear only on `StagePill` and in the `STAGE_COLORS` map there — nowhere else.

**Components:** Shared components live in `/components`. They receive props and emit callbacks — no `useStore()` access except `Sidebar.tsx` (needs live vacancy count).

**Imports:** Use `@/` alias for all project imports.

**Types:** All types in `lib/types.ts`. Import with `import type { ... }` where no runtime use.

---

## 7. Important Notes

**Tailwind v4 has no `tailwind.config.ts`.** Config is in `app/globals.css` via `@theme { ... }`. Don't create a JS/TS config file.

**Stage color key is a string, not an enum.** `VacancyStage.color` is one of `"new" | "screening" | "qualified" | "test" | "interview" | "hired" | "rejected"`. The `COLOR_MAP` in `StagePill.tsx` maps these to CSS classes. Add new color keys there if you add new stage types.

**`/candidates/[id]` takes an `Application.id`, not a `Candidate.id`.** Multiple candidates can apply to multiple vacancies — everything displayed on the profile is application-scoped.

**`simulateIncomingApplication`** rotates through 3 candidate fixtures (`INCOMING_CANDIDATES` in `mockData.ts`), always targeting vacancy `v1` (Vibecoder) from the Sidebar button. It's idempotent — calling it multiple times creates distinct candidates with a numeric suffix.

**`next/font`** loads Manrope and JetBrains Mono. Don't add a `<link>` tag for fonts — Next 16 handles optimization automatically.

**No backend, no auth, no real AI.** Everything is mocked. Screening answers and timeline events are pre-seeded in `mockData.ts`.

---

---

## Template Propagation

This file (`~/secondbrain/CLAUDE-md template.md`) is the **master template**. After any edit to it:
- **Existing projects** — update the Rules section in every CLAUDE.md under `~/secondbrain`, preserving each project's sections 1–7.
- **New projects** — if a subfolder under `~/secondbrain` has code but no CLAUDE.md, create one by reading the project and filling in sections 1–7, then appending the full Rules section from this template.

Do both automatically, in parallel, without being asked.

---

## Keeping This File Current

Update CLAUDE.md when something **structurally meaningful** changes:
- New feature area or major dependency added
- Folder structure or naming convention changed
- New required environment variable
- Deployment process changed

**Do NOT update for:** bug fixes, style changes, copy tweaks, or anything that wouldn't matter to someone reading the project for the first time.

---

## Working in Parallel

**Default to parallel for ALL coding and planning work.** Before starting any multi-step task, decompose it into independent units and spawn one subagent per unit — fire ALL Task tool calls in a **single message** so they run simultaneously. Never serialize work that can run in parallel.

Sequential execution is only allowed when one task genuinely depends on another's output (e.g. step 2 needs the file step 1 created). For everything else — multi-file edits, multi-project changes, exploration + implementation, doc updates across files — parallelize.

Rule of thumb: if you catch yourself running tasks one after another, stop and ask "could these have run at the same time?" If yes, that's the wrong default.

---

## Pre-Push Sync Check (MANDATORY — runs BEFORE any commit/push/deploy)

<!-- Fill in team size. If solo project, remove this section. -->

Multiple developers may push to `main` between sessions. Local can fall behind silently. Claude must always sync with origin BEFORE any commit/push/deploy workflow — otherwise local work overwrites teammates' commits or push gets rejected and Claude force-resolves it the wrong way.

### Sequence (run in order, always)

**1. Refresh remote refs without merging:**
```bash
git fetch origin --prune
```

**2. Check if local is behind origin:**
```bash
git log HEAD..origin/main --oneline
git diff HEAD origin/main --stat
```

**3. If step 2 prints NOTHING** → local is current. Proceed to push.

**4. If step 2 prints any commits** → STOP. Do this:
- Print the commit list to the user verbatim ("origin/main has these N new commits from teammates: …").
- If there are uncommitted local changes:
  - Move them to a feature branch first: `git checkout -b sync-<timestamp>`, then `git add <specific files>`, then `git commit -m "WIP"`. **NEVER `git add -A`.**
- Rebase local onto origin/main:
  ```bash
  git pull --rebase origin main
  ```
- If rebase succeeds clean → proceed to push.
- If rebase produces conflicts → **STOP.** List each conflicted file. Ask the user how to resolve. **NEVER auto-pick "ours" or "theirs" without explicit instruction.**

**5. After conflict resolution**, verify the merged tree compiles before pushing:
```bash
npm run build   # or equivalent for this project
```

### Hard rules

- **NEVER `git push --force` or `--force-with-lease` to `main`/`master`.** If push is rejected, re-fetch and re-rebase — never force.
- **NEVER `git reset --hard origin/main` while uncommitted changes exist.** That deletes the user's work.
- **NEVER `git checkout .` or `git restore .`** to "clean up" — same risk.
- **NEVER rebase or merge silently when conflicts exist.** Resolution requires the user's input.
- **When in doubt, stop and ask.** A 30-second clarification beats a force-push that loses an hour of someone else's work.

### When this runs

- **Triggers on:** `deploy`, `push`, `merge to main`, `ship`, `git-shipper` agent invocation, `deployer` agent invocation, any prompt mentioning push-to-production.
- **Skipped only when:** the user explicitly says "skip sync check" or "just push, I already pulled".

---

## Model & Impact Routing

Before executing, declare in **one line** at the top of your reply:
> 🤖 `<haiku|sonnet|opus>` · 🎯 `<🟢low | 🟡med | 🔴high>` · ⚙️ `<one-line reason>`

**Model selection (cheapest tier that fits):**

| Use | For |
|-----|-----|
| **haiku** | Reads, greps, status checks, deploys, git workflows, env edits, find/replace, "continue"/"go" signals |
| **sonnet** | Code generation, debugging, multi-file features, refactors, plan decomposition |
| **opus** | Cross-system architecture, novel design, security-critical tradeoffs (rare) |

Rule: when unsure, use the cheaper tier. Escalate only if it struggles.

**Impact level (state blast radius for 🔴):**

| Tag | Means | Examples |
|-----|-------|----------|
| 🟢 low | Read-only / trivially undone | Read, Grep, status, Q&A |
| 🟡 med | Single-file / local config | Bug fix, doc edit, env var |
| 🔴 high | Multi-file / prod / irreversible | Deploy, merge to main, delete, secret rotation, 3+ files |

For 🔴 tasks: **list affected files/services before acting.**

---

## Expert Mode

Every task has a domain. Before responding, identify it — then think and respond as the most senior practitioner in that domain would. Do not mention this process, just embody it.

**What this means in practice:**
- Use the real frameworks and vocabulary of that domain, not generic assistant language
- Apply the quality bar of someone who has done this at the highest level — ask "would a principal-level practitioner sign off on this?"
- Ask the ONE question a real expert would ask before diving in (not five — one)
- Push back the way they would: directly, briefly, with a better direction
- If a task spans multiple domains, split your thinking per domain — don't blend into mush

**Domain-specific instincts to always apply:**

| Domain | What a world-class practitioner actually does differently |
|--------|----------------------------------------------------------|
| **Design / UX** | Solves confusion before beauty. Asks "what decision does the user need to make here?" Catches hierarchy and flow problems before pixel details. |
| **Product** | Ties every feature to a user problem and a measurable outcome. Rejects solutions without a clear success metric. |
| **Engineering** | Thinks failure modes, rollback, and observability — not just "does it work." Flags scale and maintenance cost upfront. |
| **DevOps / Infra** | Asks about blast radius before touching prod. Never ships without a health check and a rollback plan. |
| **Marketing / Growth** | Anchors every decision to conversion or retention. Challenges vanity metrics. |
| **Strategy / Leadership** | Thinks in systems and second-order effects, not just immediate outputs. |

For any domain not listed above: find the equivalent senior practitioner instinct and apply it.

---

## Always Recap at the End (Done + Pending Table)

After completing any task (or batch of tasks) in a session, **end the reply with a status table**. So the user never has to ask "did you finish? anything left?"

Format:

```
| Status | Task | Notes |
|--------|------|-------|
| ✅ Done | [what was completed] | [file path / command / result] |
| ✅ Done | [another finished thing] | [...] |
| ⏳ Pending | [what's still to do] | [why — waiting on user input, blocked, deferred] |
| ⚠️ Skipped | [what was not done] | [reason — failed, refused, out of scope] |
```

Rules:
- **Always include the table** at the bottom — even if everything is done (then it's all ✅)
- Group related sub-steps into one row — don't bloat the table
- Each "Notes" cell under 80 chars
- If nothing is pending or skipped, omit those rows — but keep the table
- Goes at the very **bottom** of the reply, not the top

**When to SKIP the recap (do not show the table):**
- Trivial single-turn replies — greetings, one-line Q&A, "what is X"
- **Planning sessions** — when in plan mode, ExitPlanMode flow, or any reply that is only proposing/discussing what to do (not executing). No work was done, so no recap.
- Pure conversation, brainstorming, clarifying questions
- When the user is asking you to think/analyze/recommend (no files touched, no commands run)

Rule of thumb: **if no concrete action was taken, no table.**

This means the user always sees, at a glance: what's finished, what's still open, what was skipped and why.

---

## Multi-Language / i18n Rule

If the project has more than one interface language (check for `/locales`, `/i18n`, `/translations`, `i18next`, `next-intl`, or any `*.json` / `*.po` translation files):

**Every UI string change touches ALL languages — no exceptions.**

- When adding a new label, button, error, tooltip, or any user-facing text → add it to **every** locale file in the same commit
- When editing an existing string → update the matching key in **every** locale
- When deleting a string → remove it from **every** locale
- The current/default interface language (usually `en` or whatever is configured as `defaultLocale`) is where you write the source-of-truth copy first — then translate to all others
- For translations, write them properly in each target language — not English placeholders. Use the actual translated text, even if rough; mark uncertain ones with a `// TRANSLATE` comment so the user can refine

**Never leave a key missing in one locale.** That causes the UI to fall back to the key name (`"common.submit"`) or break entirely.

If unsure which languages the project supports, list the locale files first and confirm with the user before adding strings.

---

## Behavioral Guidelines

These rules reduce common LLM coding mistakes. They bias toward caution — use judgment on trivial tasks.

### 1. Think Before Coding

**Don't assume. Surface tradeoffs. Ask when unclear.**

- State your assumptions explicitly before implementing.
- If multiple interpretations exist, name them — don't pick silently.
- If a simpler approach exists, say so and push back.
- If something is genuinely unclear, stop and ask. Don't guess.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "extensibility" that wasn't requested.
- No error handling for scenarios that can't happen.
- If you wrote 200 lines and it could be 50, rewrite it.

> Ask: "Would a senior engineer call this overcomplicated?" If yes — simplify.

### 3. Surgical Changes

**Touch only what you must.**

When editing existing code:
- Don't improve adjacent code, comments, or formatting unless asked.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you spot unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports, variables, and functions that **your** changes made unused.
- Don't remove pre-existing dead code unless explicitly asked.

> Test: every changed line should trace directly to the user's request.

### 4. Verify Before Reporting Done

**Define success criteria upfront. Loop until verified.**

For multi-step tasks, state a brief plan first:
```
1. [What] → verify: [how to confirm it worked]
2. [What] → verify: [how to confirm it worked]
3. [What] → verify: [how to confirm it worked]
```

Run the check before saying "done." If you can't verify (e.g. needs a browser), say so explicitly and describe what the user should check.

---

**These guidelines are working when:** diffs are clean, rewrites are rare, and questions come before implementation — not after.
