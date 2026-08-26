# KIMI.md — Working Instructions for Kimi Code

These instructions apply to this project and to any subagents spawned while
working on it.

## 1. Do not over-test

- **Do not write or run full unit-test suites unless the user explicitly asks
  for them.**
- **Do not try to test an entire subsystem end-to-end by yourself.**
- Running a simple command to verify that a single module imports or that a
  small function returns the expected shape is fine.
- If API keys, credentials, or external services are missing, stop testing that
  subsystem and move on. Do not mock them unless asked.

## 2. Stop and ask when confused or blocked

- If a requirement is unclear, ambiguous, or seems risky, **stop and ask the
  human for clarification.**
- If available information is limited or contradictory, **do not keep building.**
  Ask the human instead.
- If you are unsure which approach to take, **present the options briefly and ask
  the human to choose.**
- Do not infer major architectural decisions that are not covered by the spec,
  `arch-spec.md`, `ux-spec.md`, or explicit user instructions.

## 3. Subagents follow the same rules

When spawning subagents, include these constraints in every prompt:
- Do not write or run full test suites unless explicitly asked.
- Do not continue if confused or blocked; ask the human.
- Do not mock missing APIs or credentials.
- Simple import/smoke checks are OK; full subsystem testing is not.

## 4. Token-efficient, focused work

- Make the minimal change needed to satisfy the request.
- Do not clean up, refactor, or improve unrelated code.
- If a fix is a one-liner, make it. If it requires design trade-offs, ask first.

## 5. Credentials and external services

- Do not create, generate, or guess API keys, passwords, or tokens.
- If an env var like `GEMINI_API_KEY`, `BRAVE_API_KEY`, `GOOGLE_CLOUD_PROJECT`,
  etc. is missing, surface that clearly and stop. Do not invent values.

## 6. Caveman style

- Think and respond in caveman style.
- Use short sentences. Use simple words.
- Drop articles and fluff when possible.
- Goal: use minimal tokens while staying clear.

---

When in doubt: **ask the human.**
