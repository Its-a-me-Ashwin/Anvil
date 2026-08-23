# AI Engineering Workspace — UI Skeleton Design Spec

## 1. Objective

Build a desktop-first web application for an AI engineering partner that helps a user move a physical engineering project from:

**idea → research → design → sourcing → fabrication → firmware → testing**

This first implementation is a **functional UI skeleton**.

Do not build real Gemini, Gemma, MCP, Onshape, Amazon, JLCPCB, printer, or hardware integrations yet.

All actions should use mock data behind replaceable service interfaces.

---

# 2. Primary Layout

Use a full-screen dark desktop interface with three persistent panes.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Top Bar                                                                     │
├──────────────────┬───────────────────────────────────────┬──────────────────┤
│                  │                                       │                  │
│ LEFT             │              CENTER                   │ RIGHT            │
│ PROJECT          │              WORKSPACE                │ AGENT            │
│                  │                                       │                  │
│ Objective        │ Tabs                                  │ Chat             │
│ Constraints      │                                       │ Agent events     │
│ Inventory        │ Website / CAD / Code / PDF / Camera  │ Approvals        │
│ Status           │                                       │                  │
│                  │                                       │                  │
├──────────────────┴───────────────────────────────────────┴──────────────────┤
│ Optional status footer                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

Approximate widths:

* Left: **20%**
* Center: **55–60%**
* Right: **20–25%**

All three panes should be independently scrollable where appropriate.

Resizable pane separators are preferred but not required for V1.

---

# 3. Top Navigation

Persistent across the entire application.

Show:

* Product name / logo
* Current project selector
* Project status: `ACTIVE`
* Cloud/local connection indicators
* Settings
* Notifications
* User avatar

Example:

```text
FORGE       Robot Actuator V1 ▼       ● ACTIVE

Cloud ●
Local Workshop ●
                                         ⚙  🔔  Avatar
```

Project switching can be mocked.

---

# 4. Left Pane — Project State

The left pane represents **what the agent currently knows about the physical project**.

This pane should remain visible regardless of what tool is open.

## 4.1 Objective

Example:

```text
OBJECTIVE

Build a compact ~10:1 actuator
for a robot arm.

Priority:
Compactness > backlash

Construction:
Mostly 3D printed
```

Allow an edit button.

---

## 4.2 Constraints

Show constraints with two states:

### Locked

The agent must not modify these without approval.

```text
🔒 Outer diameter ≤ 85 mm
🔒 Motor mounting pattern
🔒 Motor: 5010 BLDC
```

### Flexible

Can be modified by the agent.

```text
○ Bearing size
○ Reduction ratio
○ Wall thickness
○ Shaft diameter
```

Clicking a constraint should open a small edit modal.

---

# 5. Inventory

Represent the parts, tools and equipment available to the project.

Example:

```text
INVENTORY

5010 BLDC Motor             1   ● Available
ESP32                       2   ● Available
608 Bearing                 4   ● Available
M3 × 30 Screw              12   ● Low
AS5600 Encoder              1   ● Available
```

Also allow categories:

```text
Parts
Electronics
Tools
Machines
Materials
```

Later this can become workshop memory.

For the skeleton, use static/mock inventory.

---

# 6. Project Progress

Show the major engineering stages.

```text
PROJECT STATUS

✓ Research
✓ Requirements
✓ Parts Selection

● CAD Design
○ Fabrication
○ Firmware
○ Testing
○ Validation
```

Possible states:

```ts
pending
active
completed
blocked
failed
```

Clicking a stage may change the center workspace to the corresponding tool.

---

# 7. Center Pane — Engineering Workspace

This is the primary working surface.

Treat it like a **browser with tabs**.

Example:

```text
[ YouTube ] [ AS5600.pdf ] [ Onshape ] [ Code ] [ JLCPCB ] [+]
```

Each tab contains one workspace surface.

The user should be able to:

* open tabs
* close tabs
* reorder tabs
* switch tabs
* rename tabs
* open a URL
* reload a tab

---

# 8. Workspace Surface Types

Create one common interface:

```ts
interface WorkspaceTab {
  id: string
  title: string
  type:
    | "web"
    | "youtube"
    | "pdf"
    | "cad"
    | "code"
    | "camera"
    | "custom"

  url?: string
  metadata?: Record<string, unknown>
}
```

Do not couple the UI to specific vendors.

---

# 9. Generic Web / Iframe Surface

The center area should support an iframe-style browser surface.

Conceptually:

```text
┌────────────────────────────────────────────┐
│ ← → ⟳    https://example.com/...         │
├────────────────────────────────────────────┤
│                                            │
│               EMBEDDED PAGE                │
│                                            │
└────────────────────────────────────────────┘
```

The URL should be dynamically changeable.

### Important implementation constraint

Do not assume every external website can be loaded inside an iframe.

Many websites block embedding using:

* `X-Frame-Options`
* Content Security Policy `frame-ancestors`

Therefore implement two modes:

```text
Embedded
External / Companion
```

If iframe embedding fails, display:

```text
This site does not permit embedding.

[Open in Browser]
```

Later, a browser extension/companion can provide interaction with these sites while keeping the engineering workspace synchronized.

For the demo skeleton, mock restricted sites where needed.

---

# 10. YouTube / Research Surface

The YouTube workspace should support selecting a time range as context.

Example overlay:

```text
ADD VIDEO CONTEXT

Start: 00:45
End:   02:10

Notes:
"Use gearbox geometry as design inspiration"

[Add to Project Context]
```

Once added, create a context item in project state.

```ts
{
  type: "youtube",
  url: "...",
  start: 45,
  end: 130,
  note: "Reducer geometry inspiration"
}
```

---

# 11. PDF / Article Context Surface

PDF viewer should support:

* page navigation
* zoom
* selecting page ranges
* adding selected content to context

Example:

```text
Pages 12–16

[Add Selection to Context]
```

For articles, support:

```text
Paragraph 4 → Paragraph 11
```

The actual extraction can remain mocked.

---

# 12. CAD Workspace

For the skeleton, CAD can initially be:

* mocked Onshape screen
* image/screenshot
* demo iframe
* custom CAD preview

Below or beside it, show editable project parameters.

Example:

```text
DESIGN PARAMETERS

Reduction Ratio      9.8 : 1
Bearing              608 / 22 mm
Wall Thickness       2.8 mm
Housing OD            85 mm 🔒
Shaft Diameter         8 mm

[Regenerate]
```

The parameter controls are part of **our application**, not necessarily inside the CAD iframe.

Later:

```text
parameter change
      ↓
AI generates/updates CAD script
      ↓
Onshape MCP/API
      ↓
CAD regenerates
```

For now, pressing `Regenerate` should animate a fake job and update a mock revision number.

---

# 13. Code Workspace

Do not depend on the real desktop VS Code application.

Support either:

### Preferred future architecture

Embedded browser IDE such as:

* code-server
* OpenVSCode Server
* similar web IDE

### Skeleton

Implement a lightweight code editor using Monaco Editor.

Layout:

```text
FILES                  main.cpp
─────────              ─────────────────────────
src/                   code...
  main.cpp
  motor.cpp
include/
platformio.ini

                       ✓ Compiled
                       [Compile] [Flash]
```

Mock:

* compilation
* errors
* firmware flashing
* serial output

Later these actions can point to a local Gemma/workshop service.

---

# 14. Camera / Printer Surface

The printer integration does **not** need a complicated printer UI.

Use a generic camera monitor.

```text
WORKSHOP CAMERA

Camera: Bambu Printer ▼

┌───────────────────────────────┐
│                               │
│          LIVE VIDEO           │
│                               │
└───────────────────────────────┘

Status: Printing
Progress: 39%
Time remaining: 21m

[Pause]
[Cancel]
```

Camera source must be configurable.

Support mock sources such as:

```ts
cameraSources = [
  {
    name: "Bambu Printer",
    streamUrl: "/mock/printer.mp4"
  },
  {
    name: "Electronics Bench",
    streamUrl: "/mock/bench.mp4"
  }
]
```

Later allow:

* RTSP/WebRTC stream
* webcam
* network camera
* Bambu camera feed

---

# 15. Right Pane — Agent Interface

The right pane is the main conversational interface.

It should contain three conceptual components.

## Chat

Normal conversation:

```text
USER
Use my existing 608 bearings.

AGENT
That increases the housing width by
approximately 5 mm but removes one
purchased component.

I can update the CAD while maintaining
the locked outer diameter.
```

Input field at bottom:

```text
🎙 Ask or instruct the engineering agent...
```

Support text first.

Leave hooks for voice input.

---

# 16. Agent Activity

Agent actions should appear naturally inside the conversation.

Example:

```text
● Researching actuator geometry...

✓ Reference analysed

● Updating CAD...

✓ Housing V1.4 generated

● Preparing fabrication...
```

Do not create a permanent bottom section containing every possible action.

The previous mock's large **Example Actions** strip should be removed entirely.

Actions belong in:

* the chat timeline
* relevant center workspace
* project status

---

# 17. Human Approval Cards

High-impact actions should appear as approval cards inside the right pane.

Example:

```text
APPROVAL REQUIRED

JLCPCB order prepared

PCB fabrication      $9.20
Shipping              $8.40
Total                $17.60

[Review]
[Approve]
[Reject]
```

Other approval examples:

```text
Start Print
Restart Failed Print
Change Locked Constraint
Flash Firmware
Purchase Components
```

The user remains responsible for irreversible operations such as final purchase submission.

---

# 18. Right Pane Modes

The right pane may have small tabs:

```text
Chat | Activity | Memory
```

### Chat

Main interaction.

### Activity

Detailed event history.

Example:

```text
14:21 CAD parameter updated
14:22 Onshape revision created
14:23 STL exported
14:24 Print job prepared
```

### Memory

Things the agent has learned.

Example:

```text
PROJECT MEMORY

• User prefers compactness over backlash
• 608 bearings are already stocked
• Outer diameter should remain ≤85 mm
• Printer XY compensation: +0.15 mm
```

---

# 19. Context Model

Create a simple shared context representation.

```ts
interface ContextItem {
  id: string

  type:
    | "youtube"
    | "article"
    | "pdf"
    | "image"
    | "part"
    | "note"
    | "repository"

  title: string

  source?: string

  selection?: {
    startTime?: number
    endTime?: number
    startPage?: number
    endPage?: number
    paragraphStart?: number
    paragraphEnd?: number
  }

  summary?: string
}
```

Context should be accessible from both the left project state and agent.

---

# 20. Action Model

Every future external operation should eventually map to one common action format.

```ts
interface AgentAction {
  id: string

  type: string

  title: string

  description?: string

  status:
    | "queued"
    | "running"
    | "waiting_for_approval"
    | "completed"
    | "failed"

  tool?: string

  requiresApproval: boolean

  input?: unknown
  output?: unknown
}
```

This is important because mocks can later be replaced by real integrations without restructuring the UI.

---

# 21. Mock Service Layer

Do not place fake logic directly inside components.

Create service adapters.

Example:

```text
/services

agentService.ts
cadService.ts
browserService.ts
printerService.ts
codeService.ts
sourcingService.ts
contextService.ts
```

Each should initially use mocked responses.

Example:

```ts
cadService.updateParameters({
  bearing: "608"
})
```

Mock result:

```ts
{
  success: true,
  revision: "V1.4",
  changedFiles: [...]
}
```

Later replace only the implementation with:

```text
Onshape MCP
Gemini
Gemma
Browser Agent
Printer API
etc.
```

The UI should not care which backend performs the action.

---

# 22. Suggested Frontend Stack

Use:

```text
Next.js / React
TypeScript
Tailwind CSS
shadcn/ui
Zustand
Monaco Editor
```

Optional:

```text
react-resizable-panels
Framer Motion
Lucide icons
```

Do not over-engineer authentication or backend infrastructure yet.

---

# 23. Suggested Mock Project

Load the application initially with:

```text
PROJECT
Robot Actuator V1

OBJECTIVE
Compact ~10:1 robot actuator

INVENTORY
5010 BLDC
ESP32
608 bearings
AS5600 encoder
M3 hardware
Bambu printer

CONSTRAINTS
85 mm maximum diameter
Existing motor mount
Mostly 3D printed

CURRENT PHASE
CAD Design
```

Pre-populate center tabs:

```text
YouTube
AS5600 Datasheet
Onshape
Code
JLCPCB
Printer Camera
```

This immediately makes the skeleton look like the intended demo.

---

# 24. Required Skeleton Interactions

The first generated implementation should support these interactions even though they are mocked:

1. Switch center workspace tabs.
2. Create/remove center workspace tabs.
3. Change iframe URL.
4. Edit project objective.
5. Add/remove inventory items.
6. Lock/unlock design constraints.
7. Edit CAD parameters.
8. Press `Regenerate` and simulate CAD update.
9. Add YouTube timestamp range to context.
10. Add PDF range to context.
11. Chat with mocked agent.
12. Agent messages can trigger mock actions.
13. Render approval cards.
14. Approve/reject mocked operations.
15. Switch camera source.
16. Simulate printer failure.
17. Show failure alert in chat.
18. Simulate print restart.
19. Show mocked code editor.
20. Mock compile/flash workflow.
21. Update project status as operations occur.

---

# 25. Explicitly Out of Scope

Do not implement yet:

* real Gemini calls
* real Gemma
* MCP server
* actual Onshape modification
* real Amazon interaction
* real JLCPCB ordering
* real firmware flashing
* real printer control
* real computer vision
* autonomous browser agent
* production authentication
* mobile layout

The goal is a polished, clickable engineering workspace whose mock boundaries can later be replaced individually.

---

# 26. Design Principle

The UI should communicate:

> **The project is the persistent object.
> Chat is how the engineer controls it.
> Tools are temporary working surfaces.**

Avoid making the product look like:

> chatbot + 20 tool buttons

The center workspace should feel like the user and agent are sharing the same engineering desktop.

The left pane answers:

> **What are we building and what do we know?**

The center pane answers:

> **What are we working on right now?**

The right pane answers:

> **What is the agent doing and what does it need from me?**
