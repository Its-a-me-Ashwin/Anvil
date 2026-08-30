# Devpost submission — master checklist

Deadline: **August 31, 2026, 5:00 PM PDT**. This folder is local-only
(`.gitignore`'d) — nothing here gets pushed.

How to use this: work top to bottom. Each `.md` file in this folder has
the drafted content for one part of the form, ready to copy-paste, plus
its own inline action items for anything only you can fill in (personal
info, dropdowns, dates). This file is the cross-cutting list — the things
that don't belong to one form field.

---

## 0. Blockers — do these first

- [ ] **CONFIRMED, not hypothetical: `backend/agent.py` (line ~348) still
      defaults to `model="gemini-flash-lite-latest"`.** All submission
      content in this folder says **Gemini 3.7**, per what you told me —
      but the code comment right above that line says the actual tested
      swap target was `gemini-3.5-flash-lite`. Three different answers in
      three different places. Pick the real one and:
      1. Update `agent.py`'s default to it.
      2. Update the four `.md` files in this folder if it isn't 3.7 —
         search for "3.7" across `submission/*.md`.
      3. Update the demo-video script if you're using it — same mismatch
         exists there.
      Do this before recording the video — what's claimed must match
      what's actually running when a judge checks.
- [ ] **Record and upload the demo video.** Nothing else in the form can
      be finalized without its URL (it's linked in three places: Project
      Media, Additional Info testing section implicitly, and it's the
      single most heavily-weighted piece of the whole submission — 30% of
      score is Demo & Production Readiness). Upload early — YouTube/Vimeo
      processing can take a while, and the deadline doesn't wait for it.
- [ ] **Deploy the frontend + backend somewhere public.** Backend → Cloud
      Run (`deploy.md` has the steps). Frontend → Firebase Hosting or
      similar. Without this, "Hosted project URL" stays blank and the
      video's required Cloud Run proof shot has nothing to point at.

---

## 1. Content files in this folder

| File | Covers |
|---|---|
| `01-project-overview.md` | Project name, elevator pitch |
| `02-project-story.md` | The big public "About the project" field — Inspiration / What it does / How we built it / Challenges / Accomplishments / Learnings / What's next |
| `03-built-with-and-links.md` | Built-with tags, Try It Out links, image gallery order, video link |
| `04-additional-info.md` | Every judge-only field — category, SDK, cloud services, models, architecture diagram upload, dates |

Read each, adjust anything that should be in your own voice (flagged
inline), then paste into the matching Devpost form section.

---

## 2. Assets in `assets/`

- [ ] `assets/architecture-diagram-overview.png` — **ready to upload,
      required field.** 4000×2600, system-level: the five decoupled
      services and how they connect. Hand-laid-out (not auto-generated)
      from `assets/_render/architecture.html` for full control over label
      placement — avoids the overlapping edge-labels that Mermaid's
      auto-layout produced in an earlier draft.
- [ ] `assets/architecture-diagram-tools.png` — **ready to upload,
      supplementary.** 4000×2600, tool-level: every adapter in
      `backend/adapters/registry.py` and a sample of the functions it
      exposes, fanning out from the ADK agent. Source at
      `assets/_render/architecture-tools.html`. Upload alongside the
      overview diagram if the Additional Info field takes multiple files;
      otherwise it's already queued in the Image gallery order.
      Re-render either diagram after an edit with:
      ```bash
      npx -y capture-website-cli submission/assets/_render/<file>.html \
        --output=submission/assets/<matching-output>.png \
        --width=2000 --height=1300 --overwrite
      ```
      (Needs Node ≥20 — the system default here was 18; use
      `~/.nvm/versions/node/v22.23.1/bin` or whatever newer version is on
      this machine if the default fails with an engine error. After any
      edit, re-check by reading the rendered PNG back for overlaps before
      trusting it — the coordinates are hand-placed, so a moved box can
      silently collide with a line or another box.)
- [ ] `assets/thumbnail.png` — **ready to use as the cover image** for the
      gallery (first upload in the Image gallery). 3000×2000 (3:2), source
      HTML at `assets/_render/thumbnail.html` if you want to tweak text,
      the adapter labels, or colors before re-rendering (same command
      pattern and Node-version note as above).
- [ ] `assets/screenshots/` — **empty, needs your captures.** Take these
      once the app is running (local or hosted) and drop them in, in this
      order for the gallery:
  - [ ] Three-pane workspace mid-conversation, tool-call cards visible
        streaming in the right panel
  - [ ] CAD viewport showing a generated multi-part assembly
  - [ ] Wiring diagram workspace
  - [ ] Memory tab — skill radar chart populated
  - [ ] Printer Camera tab with a Gemma alert banner visible
  - [ ] Cloud Run console showing the live, running service (this one
        doubles as evidence for judges — keep a clean, readable capture)

`assets/_render/` is scratch (the HTML/mmd sources used to generate the
two PNGs above) — not something to upload anywhere, just kept in case you
need to regenerate.

---

## 3. Fields no draft can fill in for you

These need a real decision or real credentials — flagged again here so
nothing gets missed on a rushed final pass:

- [ ] Submitter Type (dropdown)
- [ ] Submitter country of residence (dropdown)
- [ ] Project start date — **checked: first commit is 2026-08-21**, inside
      the required Aug 3–31 window. Enter `08-21-26` (MM-DD-YY).
- [ ] Organization name — leave blank (not submitting on behalf of a company)
- [ ] Startup Prize opt-in — **skip, confirmed not applicable**
- [ ] Hosted project credentials, if the deployed instance ends up behind
      a login — goes in the private "Testing instructions" field, not
      anywhere public

---

## 4. Bonus items — placeholders for now, fill in later

Per plan: these go in **after** the core submission is solid, but the
fields are there and ready:

- [ ] **Published content link** (blog/podcast/video) — must be public
      (not unlisted), and must state it was created for this hackathon.
      Field is in `04-additional-info.md`.
- [ ] **Social media post link** — must include
      `#AllThingsAgenticHackathon`. Same file.

Both are optional for Stage One but scored in Stage Three (up to +0.2
points each) — worth coming back to before the deadline if there's time,
but they will not block a valid submission if skipped.

---

## 5. Final pass before hitting Submit

- [ ] All three mandatory-tech boxes true in the actual running code:
      Gemini 3.5+, a Google Agent Framework, a Google Cloud service
- [ ] Category selected: **The Collaborative Partner**
- [ ] Code repo link opens correctly in an incognito window
- [ ] README has real spin-up instructions a stranger could follow
- [ ] Architecture diagram uploaded (not just linked/described)
- [ ] Demo video: public, ≤4 min, shows the problem + value prop + a live
      unedited demo + visible Google Cloud proof
- [ ] All teammates have **accepted** their team invite (not just been
      added — an unaccepted invite is the most common way someone gets
      left off a finished submission)
- [ ] Everything above still reads true after the final deploy — a
      submission that matches what the video/description claim
