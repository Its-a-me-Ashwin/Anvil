# Anvil — Demo Video Script (CapCut edit copy)

Target runtime: **3:55–4:00** (only the first 4:00 is judged). Voiceover
(VO) is written to be read at a confident, even clip — not rushed.
**Burn in subtitles on every single beat**, VO and any on-screen dialogue
alike — it's a hard submission requirement, not optional polish.

Assets referenced below live in `demo-video/assets/`:
- `insert-google-stack-slide.png` — the "full Google stack" card grid
- `insert-tool-registry.png` — the 8-adapter / 65-tool registry diagram
- `insert-system-architecture.png` — the hub-and-spoke system diagram
- `end-card.png` — reused thumbnail, works as a closing card

Don't overdo on-screen graphics. Most beats need **zero** added text —
the live app UI and the VO are doing the work. Add an overlay only where
noted below.

---

## Clip inventory (the B-roll you're shooting/sourcing outside the app)

| # | Clip | Used in |
|---|---|---|
| A | Rocket launch, Utah desert, countdown audio | Cold open + closing payoff |
| B | "We love building" — model rockets, RC planes, workbench shots | Problem setup |
| C | A cluttered wall of browser tabs (CAD tool, datasheet PDFs, forums, slicer) | Problem statement, before the cut to Anvil |
| D | Someone soldering, laptop open beside them, wearing a gas mask (fumes) | Physical-build cutaway, right before the print beat |
| E | Real 3D-print timelapse of the nose cone | Print beat payoff |

---

## 0:00–0:08 — Cold open

**Clip A** — rocket launch, Utah desert. Let the countdown audio play
under the first line, cut to ignition exactly as the VO lands.

> **VO:** *"Every build like this ends in a launch. Most of them start in fifteen browser tabs."*

**On screen:** nothing added — pure clip, full bleed, real audio.
**Subtitle:** the VO line, standard lower-third caption style.

---

## 0:08–0:18 — Why we're building this

**Clip B** — quick cuts: a shelf of model rockets, an RC plane mid-build,
a workbench with tools and half-finished parts. 3–4 cuts, fast, no
lingering on any one shot.

> **VO:** *"We love building things that fly — rockets, RC planes, whatever's next on the bench. And every time, the actual engineering competes with the busywork around it."*

**On screen:** nothing added.
**CapCut note:** this is the only place personality/authenticity carries
the beat — don't caption it with icons, let the footage speak.

---

## 0:18–0:32 — The problem, stated

**Clip C** — a wall of open tabs: a CAD tool, three datasheet PDFs, a
slicer, a forum thread. Chaotic, cluttered, real. Hold for 3–4 seconds,
then **hard cut / wipe transition** into the Anvil app, idle, three-pane
workspace visible.

> **VO:** *"A CAD tool. A datasheet you can't find. A slicer. A forum thread for the one wiring gotcha nobody documented. None of those tools know about each other — or about your project. You're the integration layer."*

**On screen:** as the wipe completes into Anvil, hold on the idle
workspace for one beat before the next line.
**Subtitle:** as above.

---

## 0:32–0:50 — What Anvil is (ties straight to what's being judged)

Stay on the idle Anvil workspace, slow push-in.

> **VO:** *"Anvil is an agent that closes that gap. Not a chatbot — an agent that acts. It runs on Gemini, orchestrated through Google's Agent Development Kit, calling real tools against a real project instead of just talking about one."*

**Insert here, 3 seconds: `insert-google-stack-slide.png`** — full screen,
then cut back to the app.

> **VO (over the slide):** *"Nine pieces of the Google stack, each doing a real job — not checked off for a bonus."*

**CapCut note:** this is the one deliberate "slide" moment in the whole
video — it's fine for it to look like a slide, not live app footage.
Keep it to 3 seconds, don't linger.
**Subtitle:** both VO lines.

---

## 0:50–1:20 — Setup: one prompt, the whole project state

Live in the app. Type the prompt below. Let the tool-call cards actually
stream — don't skip ahead in the edit.

**Prompt to type:**
```
I'm building a Level 2 certification rocket. The lower section is done — fins on a carbon-fiber body tube, 66 mm ID, 67 mm OD, 38 mm motor mount. I still need the upper body, a nose cone, an avionics bay / coupler with top and bottom lids, and an electronics sled. Avionics I already have: 2× RP2040 boards with LoRa, 2× MOSFET modules, an MPU6050 IMU and a BMP390 baro (both STEMMA QT), and a UART GPS. Set up the project — capture the goal, lock the tube dimensions, and log my parts and milestones.
```

> **VO:** *"One prompt, and the agent orchestrates a whole chain of tool calls on its own — objective captured, tube dimensions locked as hard constraints, every part logged. It quietly pulls each part's own datasheet in as it goes, so later answers are grounded in the real spec instead of a guess."*

The agent closes its reply with a short calibration question. Answer it
on camera:

**Prompt to type (your answer):**
```
Pretty solid on CAD and printing — I designed and built the lower airframe myself. Newer to embedded firmware: I've done some Arduino, but not LoRa telemetry or state estimation.
```

> **VO:** *"And it asks — not assumes. One question to gauge where I actually need depth, and it remembers the answer. Every explanation from here calibrates to that, automatically."*

**On screen:** left panel filling top to bottom (objective, locked
constraint, inventory, milestone checklist) as it happens live — this
is the shot, don't cut away from it.
**Subtitle:** both VO lines, timed to the visible panel updates.

---

## 1:20–1:26 — The registry, in one shot

**Insert: `insert-tool-registry.png`**, full screen, 5 seconds.

> **VO:** *"Every one of those tool calls comes from the same place — a single registry of sixty-five tools across eight scoped adapters. Nothing reaches the model without an explicit entry here. That's the architecture, not an afterthought."*

**CapCut note:** this is the "show all the adapters" beat — let the
image breathe for the full 5 seconds, don't rush past it. This single
shot is doing double duty: it proves modularity for the architecture
criterion and it's genuinely a cool-looking diagram.
**Subtitle:** the VO line.

---

## 1:26–1:36 — Quick hits (breadth, not depth)

Rapid-fire, live in the app. Each resolves in 2–3 seconds, no dwelling.

**Prompts to type, back to back:**
```
What's a safe descent rate for a ~3 kg rocket under an 18-inch parachute?
```
```
What's still on my build to-do list?
```

> **VO:** *"A couple of quick ones to show the range — a web-grounded fact, a status check — each answered in seconds, no context-switching."*

**On screen:** tool-call cards resolving fast. No overlay needed.
**Subtitle:** the VO line.

---

## 1:36–2:00 — Parametric CAD, built live

**Prompt to type:**
```
Design the upper airframe to fit my 66/67 tube: the avionics coupler, an ogive nose cone, and the av-bay top and bottom lids. Give the lids a bolt circle so I can screw them to the coupler. Keep everything referenced to the locked tube dimensions, then show me the assembly.
```

> **VO:** *"Now it designs. Real parametric CAD, composed primitive by primitive — a tube, an ogive taper, a bolt circle — constrained to the dimensions it locked earlier, not eyeballed. This is geometry generated entirely through tool calls, and the assembly actually holds together dimensionally."*

**On screen:** STL viewport rotating the finished assembly as it
converges. This is a strong visual beat — let the model spin for a
second after it finishes.
**Subtitle:** the VO line.

---

## 2:00–2:16 — The wiring diagram

**Prompt to type:**
```
Draw me a clean wiring diagram for the avionics: the RP2040 flight computer to the MPU6050 and BMP390 over a shared I²C bus, the GPS on UART, and the LoRa radio. Colour-code power, ground, and the data lines.
```

> **VO:** *"A native, colour-coded schematic, generated from plain English — power, ground, the I²C bus, UART, LoRa — laid out and rendered right in the workspace. A diagram I could actually build from."*

**On screen:** the rendered wiring diagram, full pane.
**Subtitle:** the VO line.

---

## 2:16–2:40 — Writing the code, and proving it

**Prompt to type:**
```
Now write the code — split it into modules, not one big file: sensor acquisition from the STEMMA QT IMU and baro, GPS parsing, a state estimator, telemetry packet framing, and data logging, wired together in a main loop. Then a matching Python/Tkinter ground station that decodes the downlink and shows live altitude, GPS, and link status. Write unit tests for the state estimator and the telemetry encode/decode — the parts that don't need real hardware to test. Keep recovery actuation out of scope.
```

> **VO:** *"Here's what a chat window can't do — it writes real code. Over the filesystem tools, exposed through the Model Context Protocol, it authors the firmware as separate modules, plus its own unit tests, directly into a genuinely embedded VS Code instance. Same files, same filesystem, editable by me at the same time."*

Switch to the terminal inside the embedded VS Code:

**Prompt to type:**
```
Now open a terminal and run the test suite so I can see it pass.
```

> **VO:** *"And I don't take its word for it. I run the suite myself, right here, and watch it pass."*

**On screen:** file tree growing module by module, then the terminal
with a real green `pytest` pass, unedited.
**Subtitle:** both VO lines.

---

## 2:40–2:54 — Free before paid

**Prompt to type:**
```
Before I pack the recovery bay — how do I tie the harness knot that connects the parachute to the shock cord? Show me.
```

> **VO:** *"And when the answer is something you should learn, not generate, it doesn't generate — it finds a real tutorial first. Cheap, deterministic tools before expensive ones. That's a deliberate policy, not a default."*

**On screen:** a real YouTube tutorial loading and playing briefly in
the center pane.
**Subtitle:** the VO line.

---

## 2:54–3:10 — When nothing else exists, it generates

**Prompt to type:**
```
I couldn't find a clear video on this — animate how airflow differs over an ogive nose cone versus a conical one as the rocket goes transonic, so I can see why the ogive I just designed is the right call.
```

> **VO:** *"When no tutorial answers it, the same policy escalates — and the agent composes a small pipeline on its own: Veo renders the animation, Lyria scores it, and the two get muxed into one clip behind a single tool call. Three models, one question."*

**On screen:** the generated Veo clip playing, with its Lyria score
audible.
**Subtitle:** the VO line.

---

## 3:10–3:18 — Real hands, real hardware

**Clip D** — the soldering shot: person at the iron, laptop open beside
them (Anvil visible on screen), gas mask on for the fumes. Light,
a little funny, humanizing.

> **VO:** *"The agent designs. Someone still has to hold the iron."*

**On screen:** nothing added — let the clip carry it.
**CapCut note:** keep this short, 6–8 seconds max — it's a palate
cleanser between two technical beats, not a segment of its own.
**Subtitle:** the VO line.

---

## 3:18–3:38 — Crossing into the physical world

**Prompt to type:**
```
Export the nose cone, slice it for PLA, and send it to my Bambu printer — then watch the camera and flag it if the print fails.
```

> **VO:** *"Then it crosses all the way into the physical world. It slices the part and dispatches it through a decoupled local bridge that owns the printer connection — the cloud backend can redeploy without ever dropping that link. And a local vision-language model, running fully on-device, watches the camera the whole time. Cloud reasoning, local eyes — the right model for the job's latency, not one model doing everything by default."*

**Cut to Clip E** — the real print timelapse — for 4–5 seconds, then
back to the app showing the printer-camera tab with a live vision alert
banner.

**On screen:** slice/dispatch tool cards → real print timelapse → camera
tab with the vision status visible.
**Subtitle:** the VO line, split across the cut.

---

## 3:38–3:50 — It remembers, and it hands you the result

**Prompt to type:**
```
Where are we on the build, and what still needs my sign-off before I commit to printing the whole airframe?
```

> **VO:** *"None of this lives in a chat buffer. It's durable state — constraints, inventory, decisions, the skill profile — read back and used on every turn, with the irreversible steps gated behind my approval."*

**On screen:** Memory tab — skill radar chart, decisions log with an
approval-gated entry.
**Subtitle:** the VO line.

---

## 3:50–4:00 — Proof, and the close

Cut to the Cloud Run console: the service page, the `.run.app` URL
visible, `/health` reporting the live tool count. Then the Firestore
console showing the live project document.

> **VO:** *"And it's not running on localhost — the backend is live on Cloud Run, state in Firestore, one agent orchestrating a fleet of Google models end to end."*

**Insert: `end-card.png`**, 1–2 seconds, then hard cut back to **Clip A**
(the rocket launch) for the final second — same footage as the open, now
as a payoff.

> **VO (final line, over the rocket):** *"From a half-built airframe to a printed part. Let's launch."*

**Subtitle:** both closing lines.

---

## CapCut pass — quick checklist

- [ ] Subtitles burned in on **every** beat, VO and any spoken dialogue alike.
- [ ] The only two "slide" inserts are the Google-stack card and the tool-registry diagram — resist adding more text cards. The app itself is the visual.
- [ ] No icon overlays needed anywhere in the live-app beats — the UI already communicates state visually (cards, panels, viewports). Icons on top of a UI that already has its own icons reads as cluttered.
- [ ] Keep the two callback shots of Clip A identical footage (open + close) — the repetition is the point.
- [ ] Confirm total runtime lands at or under 4:00 before final export; trim from the "quick hits" beat (1:26–1:36) first if you're over, it's the most compressible.
