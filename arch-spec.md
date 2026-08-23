Yes. I would stop thinking of the center panel as “an iframe area” and instead call it the Workspace Surface.

Each integration gets its own wrapper. Some wrappers happen to use an iframe; others render a native React UI backed by an API; others connect to a local machine. That solves the Onshape problem permanently rather than fighting CSP headers.

The architecture I would use is:

                    FORGE UI
                       │
              Workspace Surface
                       │
       ┌───────────────┼──────────────────┐
       │               │                  │
  Embedded App     Native Wrapper    Browser Companion
  we control       API-backed UI      arbitrary websites
       │               │                  │
  code-server       Zoo CAD           Amazon/etc.
  YouTube           DigiKey
  PDFs              Search
                    JLCPCB
                       │
                Local Workshop Bridge
                       │
            Printer / USB / Serial / Camera
The tool map I recommend
Engineering function	Product/service	What agent controls	What appears in center pane	Wrapper we build	Recommendation
General web research	Brave Search API	Queries, filters, result selection	Our own search-result UI	SearchWorkspace React component + API adapter	Use
Agent-focused research/extraction	Tavily	Search, extract/crawl pages	Usually hidden; results shown in our UI	ResearchService	Optional
YouTube context	YouTube embed/API	URL, timestamp ranges, metadata	YouTube player	Real iframe/embed + context overlay	Use
PDFs	PDF.js	pages, selections, extraction	Native PDF viewer	PdfWorkspace	Use
Articles/web pages	Browser / companion	selected text/DOM sections	iframe when allowed; otherwise reader view	BrowserWorkspace + extension	Use
3D CAD	Zoo Engine API / KCL	geometry, parameters, export, edits	Native live CAD viewport	CadWorkspace + Zoo API	Best fit
CAD alternate	CadQuery / build123d	Python parametric CAD	Our Three.js/BREP preview + Python	CadCodeWorkspace	Very strong fallback
Existing professional CAD	Onshape	API/MCP edits, exports	mirrored preview; external editor button	OnshapeAdapter	Keep as optional
Coding	code-server	filesystem, terminal, builds	Real VS Code-like browser IDE	self-hosted iframe	Use
Firmware compile	PlatformIO / CLI	compile, libraries, builds	code-server + build status	BuildService	Use
Firmware flashing / serial	Local machine	flash, serial monitor, USB device	terminal/telemetry panel	WorkshopBridge	Use
Electronic parts discovery	DigiKey API	search, price, stock, quote	native product cards/table	PartsWorkspace	Use
Multi-vendor electronics search	Nexar / Octopart	MPN lookup, offers, availability	native comparison UI	PartsSearchAdapter	Useful
General consumer parts	Amazon/etc.	cart interaction	browser companion/external page	CommerceBrowserAdapter	Demo only / secondary
PCB manufacture	JLCPCB API	Gerber upload, quote, configuration, order preparation	native order/configuration UI	ManufacturingWorkspace	Use if access approved
External 3D manufacture	JLCPCB 3D Printing API	upload, quote, order	same manufacturing UI	same wrapper	Optional
Slicing	Bambu Studio CLI or PrusaSlicer	orientation, process settings, slicing	custom 3D preview + settings	SlicerService	Use
Printer control — open ecosystem	OctoPrint	upload, print, pause, temperatures, status	native printer page	PrinterAdapter	Excellent
Printer control — Klipper	Moonraker	jobs, status, webcam, printer commands	native printer page	PrinterAdapter	Excellent
Bambu printer	Bambu Studio + local bridge	slicing + limited LAN control	native printer page	BambuAdapter	Use for your actual demo
Printer camera	WebRTC/MJPEG/RTSP bridge	select stream	camera feed	CameraWorkspace	Use
Git/repository	GitHub API/git CLI	clone, commit, issue/PR	code-server + small status cards	RepoService	Useful
Project/inventory memory	our database	constraints, parts, decisions	left pane	ProjectStateService	Core

That gives us essentially every minimum capability you described without depending on arbitrary website embedding.

CAD: Zoo is probably the answer

I looked into Zoo/KittyCAD specifically, and it is considerably better suited to what we're building than I expected.

Zoo exposes a real Engine API for creating/editing CAD, backed by their cloud CAD kernel. Their documentation explicitly describes it as infrastructure for building your own CAD applications, rather than merely automating their UI.

Even better, their TypeScript quickstart mentions:

@kittycad/web-view

which lets an application submit KCL and attach the live engine view directly to a <video> element.

That's almost exactly what we need.

Instead of:

FORGE
  ↓
iframe
  ↓
Zoo website

we can do:

FORGE
  ↓
our CadWorkspace
  ↓
┌─────────────────────────────────────┐
│ CAD viewport provided by Zoo engine │
│                                     │
│        actual interactive model     │
│                                     │
├─────────────────────────────────────┤
│ Ratio   Bearing   OD   Thickness    │
└─────────────────────────────────────┘
            ↓
         Zoo API

The agent changes KCL / engine state, and our UI remains the CAD application.

That's substantially cleaner.

And yes: Zoo is free to start

As of August 2026, Zoo says the core Design Studio is available free, with the free plan including all core CAD workflows and 20 minutes/month of Zookeeper reasoning.

Their developer APIs are separately metered: $10 of free API usage each month, then approximately $0.0083/sec for billed processing if you enable pay-as-you-go.

So for a hackathon/demo:

Yes, absolutely practical.

One caveat: Zoo says its full browser version of Design Studio is primarily a testing environment. I therefore would not iframe their entire web CAD application. Use their Engine API/web-view and create our own CAD surface.

And KCL is unusually nice for an agent

This also fits our design philosophy.

A design could become:

motor_mount_diameter = 42mm       // LOCKED
housing_od = 85mm                 // LOCKED

bearing_od = 22mm                 // EDITABLE
wall_thickness = 2.8mm            // EDITABLE
reduction_ratio = 9.8             // EDITABLE
shaft_diameter = 8mm              // EDITABLE

Zoo describes KCL as the textual source of truth for its models and specifically supports reusable parameters, formulas and version-controlled CAD-as-code.

That is exactly what we wanted Gemini/Gemma to manipulate.

And because we control the parameter UI, the user doesn't even need to know KCL exists.

CAD alternative #2: build123d / CadQuery

There is another route I actually like a lot.

Run:

Python + build123d

or:

Python + CadQuery

on our backend.

Both produce real BREP geometry using OpenCascade, support parametric CAD, and can export manufacturing formats.

CadQuery is Apache 2.0 licensed and explicitly designed to run without a GUI, including server integrations.

build123d is also Apache 2.0, Python-based, parametric BREP CAD built on OpenCascade.

So this:

HOUSING_OD = 85
BEARING_OD = 22
SHAFT_OD = 8
WALL = 2.8

becomes a true agent-editable CAD program.

Then our backend exports STEP/STL/glTF and the browser renders it.

Benefits
completely under our control
no iframe
no vendor UI
Python, which Gemini is excellent at
basically free/self-hosted
deterministic
easy to diff/version
easy for an agent to modify
Downside

We would have to build more of the human CAD experience.

Zoo already gives us geometry rendering and interactive infrastructure.

So I'd rank:

1. Zoo Engine/KCL — hackathon choice

2. build123d — open-source fallback

3. Onshape API/MCP — integration with existing professional CAD

I wouldn't completely throw away Onshape

Instead, change what its integration means.

Don't embed Onshape.

Have:

Agent
 ↓
Onshape API/MCP
 ↓
Onshape document

      +

FORGE
 ↓
export / preview
 ↓
our CAD viewer

Center pane could show:

Onshape — Robot Actuator V3
Synced 3 seconds ago

with the latest rendered model.

And:

Open full editor ↗

Human editing happens in Onshape's own tab.

Agent operations still happen programmatically.

That is a perfectly valid architecture, especially later.

Search: don't iframe Google at all

I would solve search in exactly the same way.

The center pane should look like a search engine, but it should be ours.

For example:

┌──────────────────────────────────────────────┐
│ 🔎  compact 10:1 cycloidal reducer bearing │
├──────────────────────────────────────────────┤
│                                              │
│ ▣ Hackaday                                  │
│ Compact Cycloidal Reducer...                │
│ useful snippets...                          │
│                           [+ Context]        │
│                                              │
│ ▣ RobotShop                                 │
│ Design considerations...                    │
│                           [+ Context]        │
│                                              │
└──────────────────────────────────────────────┘

Behind it:

SearchWorkspace
       ↓
Brave Search API
       ↓
normalized SearchResult[]
       ↓
our UI

That is vastly better than trying to embed a search engine.

Brave would be my default

Brave exposes web, news, image, video and AI-oriented search endpoints from its own search index.

Current Search pricing is $5 / 1,000 requests with $5 of monthly free credit, i.e. roughly 1,000 normal search calls worth of free credit per month.

More importantly for us, it has an LLM Context endpoint specifically optimized for agents.

So we could actually have:

Human search UI
       ↓
Brave Web Search

Agent research
       ↓
Brave LLM Context

same provider.

That's clean.

Tavily is also a good option

Tavily is more explicitly agent-oriented and currently gives 1,000 free API credits/month with no credit card required.

It also supports things like extraction/crawling.

My preference would be:

Brave

Visible search engine experience.

Tavily

Optional deep extraction/research backend.

But I wouldn't use both in V1 unless we need them.

Start with Brave.

Sourcing gets much better if we abandon Amazon as the primary demo

This was another good finding.

For an engineering product, DigiKey is much better than Amazon.

DigiKey officially offers APIs for:

product search
real-time availability
pricing
quotes
placing orders
order status

and states that its APIs are available at no cost.

So imagine the UI:

Need: AS5600 encoder

┌────────────────────────────────────┐
│ AMS AS5600-ASOT                    │
│ DigiKey                            │
│ Stock: 18,302                      │
│ Qty 1: $3.12                       │
│                                    │
│ ✓ compatible                       │
│ ✓ in stock                         │
│                                    │
│ [Add to Project Order]             │
└────────────────────────────────────┘

The agent isn't clicking pixels.

It's manipulating actual engineering supply-chain data.

Much stronger.

Nexar/Octopart handles broad component comparison

Nexar gives API access to Octopart's supply-chain data, including sellers, inventory, prices and component information. Their developer flow allows free signup and application creation.

So:

Find 8mm shaft encoder
        ↓
Nexar / Octopart
        ↓
compare:
DigiKey
Mouser
Newark
Arrow
...

Then use DigiKey's API when actually purchasing from DigiKey.

JLCPCB surprised me too

JLCPCB now has an official API platform.

It supports:

PCB upload
automated quoting
order creation
order tracking
3D printing quotations/orders
component data

So our original demo:

“I like this open-source controller. Get its fabrication files and prepare a JLCPCB order.”

can potentially be implemented without browser automation at all:

GitHub Repo
   ↓
Gerbers / BOM
   ↓
JLCPCB Adapter
   ↓
upload
   ↓
quote
   ↓
configure
   ↓
READY FOR APPROVAL
Catch

API access isn't automatically guaranteed. JLCPCB says applications are reviewed and approval may consider ordering history/business context.

So apply now, but don't make hackathon success depend on approval.

If rejected/not approved in time:

use browser companion for the final JLCPCB interaction.

Coding is the easiest piece

Run code-server ourselves.

It is specifically built to provide VS Code in a browser.

Because we own the deployment, we can set CSP/frame headers appropriately and embed it inside our workspace.

Then:

FORGE page
   ↓ iframe
code.forge.local/project/actuator

But here's the key:

The agent should NOT manipulate the code-server UI.

Both human and agent share the same filesystem.

             shared project directory
                     │
             ┌───────┴───────┐
             │               │
       code-server         Agent
          UI          filesystem tools

The iframe is only for the human.

The agent directly edits:

/src/main.cpp
/platformio.ini
/test/...

That is dramatically more reliable than using browser actions.

Slicing: use CLI, not another iframe

Bambu Studio now documents a proper command-line workflow including loading machine/process/filament configs, arranging models and slicing/exporting 3MF.

So:

CAD
 ↓
actuator.stl
 ↓
SlicerService
 ↓
Bambu Studio CLI
 ↓
actuator_print.3mf

Then our UI renders:

PRINT PREVIEW

Material       PLA
Layer          0.20 mm
Walls          4
Infill         35%
Time           41 min
Material       48 g

           [Start Print]

No need to embed Bambu Studio.

That is cleaner.

Printer control needs a local gateway

For a hackathon/product architecture, I'd create one very small process:

forge-workshop-agent

running on the local workshop PC / Raspberry Pi.

It exposes:

GET  /printers
GET  /printer/:id/status

POST /printer/:id/upload
POST /printer/:id/start
POST /printer/:id/pause
POST /printer/:id/cancel

GET  /serial-devices
POST /flash

GET  /cameras

Then adapters underneath can vary:

WorkshopBridge
      │
 ┌────┼──────────┐
 │    │          │
Bambu OctoPrint Klipper

OctoPrint is extremely agent-friendly because it has an official REST API covering files, jobs, printer state and printer commands.

Klipper + Moonraker is even nicer architecturally: Moonraker provides HTTP/WebSocket JSON-RPC APIs specifically so external applications can control Klipper.

For your actual Bambu

Bambu is slightly uglier.

Bambu officially provides a Developer Mode that leaves MQTT, live stream and FTP accessible on the LAN, but explicitly says those communication protocols aren't officially supported for developers.

So I'd architect the adapter as:

BambuAdapter
 ├── Bambu Studio CLI     → slicing
 ├── local LAN bridge     → status / start / pause
 └── camera               → video feed

and hide all that mess behind:

interface PrinterAdapter {
  getStatus(): Promise<PrinterStatus>
  upload(file): Promise<Job>
  start(job): Promise<void>
  pause(): Promise<void>
  cancel(): Promise<void>
}

If later you switch to Klipper, nothing above that interface changes.

So the center panel no longer has one implementation

This is the conceptual change I'd make in your code now:

type WorkspaceSurface =
  | "iframe"
  | "search"
  | "cad"
  | "pdf"
  | "code"
  | "sourcing"
  | "manufacturing"
  | "slicer"
  | "printer"
  | "camera"

Then:

YouTube
→ iframe

PDF
→ native PDF component

Search
→ native Brave-powered component

Zoo CAD
→ native CAD component

Code
→ iframe to our code-server

DigiKey
→ native sourcing component

JLCPCB
→ native manufacturing component

Slicer
→ native preview component

Printer
→ native status component

Camera
→ video component

Random Website
→ iframe if possible
→ browser companion otherwise

That's the architecture I'd lock.

My actual V1 integration choices

If I were building the real version this weekend, I'd choose only these:

Capability	V1
Research	Brave Search API
YouTube	YouTube embed
Docs	PDF.js
CAD	Zoo Engine API + KCL + web-view
Code	code-server
Parts	DigiKey API
PCB orders	JLCPCB API if approved; companion fallback
General shopping	browser companion
Slicing	Bambu Studio CLI
Printing	local WorkshopBridge
Monitoring	camera + printer status
Firmware	PlatformIO + WorkshopBridge
GitHub	git/GitHub API