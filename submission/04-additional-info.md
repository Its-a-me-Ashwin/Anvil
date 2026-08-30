# Additional info

Form: **Additional info** (judges/organizers only, except where noted
"Appears in project gallery")

---

### Sponsor / Special Prizes
*(select all that apply)*

Suggested: select **Best Architectural Design** and **Best Multimodal UX**
if they appear as selectable options here — Anvil is a strong fit for both
regardless of main category (see `submission/CHECKLIST.md` for why).

**Action for you:** open the dropdown and check what's actually listed —
select any that apply. Do **not** select Startup Excellence (confirmed
not applicable).

---

### Submitter Type *(required, appears in gallery)*
**Action for you:** select from dropdown — Individual or Team, whichever
matches how you're submitting.

### Submitter country of residence *(required, appears in gallery)*
**Action for you:** your call — personal info, not something I can fill in.

### Which Category are you submitting to? *(required, appears in gallery)*
```
The Collaborative Partner
```

### If submitting on behalf of an Organization *(required field, but can be blank if N/A)*
**Action for you:** leave blank unless submitting on behalf of a company.

### What date did you start this project? *(required, MM-DD-YY)*
```
08-21-26
```
*(Checked directly — first commit is 2026-08-21, inside the required
Aug 3–31 Submission Period. No action needed unless the repo history
changes before you submit.)*

---

### URL to your public or private code repo *(required)*
```
https://github.com/Its-a-me-Ashwin/Anvil
```
**Action for you:** if kept private, share with `testing@devpost.com` and
`cloudhackathons@google.com` before submitting, and test the link in an
incognito window.

### Did you add Reproducible Testing instructions to your README? *(required, appears in gallery)*
```
Yes
```
*(True — `local-deploy.md` + the Getting Started section of `README.md`
cover full spin-up.)*

### Hosted project URL if available *(optional but strongly recommended)*
**Action for you:** same URL as in `03-built-with-and-links.md` — fill in
once deployed.

### Testing instructions *(optional, seen by Devpost/judges only, not public)*
```
No login required. Clone the repo and follow README.md's "Getting
Started" section, or run `./anvil-run --start` after the one-time setup
in local-deploy.md. Health check: GET /health on the backend should
return {"status":"ok","tools":N}.
```
**Action for you:** adjust if the hosted demo needs credentials — add them
here (this field isn't public).

---

### Which Google SDK did you use? *(required — select all that apply)*
```
Google ADK
```
**Action for you:** select from the dropdown — confirm it's the only one
listed among the four accepted (ADK, GenAI SDK, Antigravity SDK, Genkit).
We use ADK; also select **GenAI SDK** if it's offered as a separate
option, since the `google-genai` client library is used directly for Veo
and Lyria calls alongside ADK.

### Which Google Cloud Service(s) did you use? *(required — select all that apply)*
```
Cloud Run
Firestore
```
**Action for you:** select both from the dropdown.

---

### Architecture diagram *(required upload — pdf/ppt/pptx/png/jpg/jpeg, 35 MB max)*
```
submission/assets/architecture-diagram-overview.png
```
The system-level diagram — five decoupled services, how they connect.
There's a second, more detailed one at
`submission/assets/architecture-diagram-tools.png` (the ADK agent's full
tool/adapter registry). **Action for you:** upload the overview one here;
if this field accepts multiple files, add the tools one too — otherwise
put it in the Image gallery instead (already in the upload order in
`03-built-with-and-links.md`).

### Startup Prize opt-in
**Action for you:** skip both fields — confirmed not applicable.

---

### Which Google AI Models did you use? *(required — Gemini 3.5+ mandatory, more boosts score)*
```
Gemini 3.7, Gemma 3, Veo 3.1, Lyria 3
```
**Action for you:** paste as-is, or match whatever format the field
expects (free text vs. multi-select — screenshot didn't show the input
type clearly). This is the field that captures the bonus-model scoring —
double check all three (Gemma, Veo, Lyria) are named, not just Gemini.

### OPTIONAL — Link to a piece of content (blog, podcast, video)
```
<-- placeholder: add once published -->
```
**Action for you:** per our plan, this comes later. Must be public (not
unlisted), and must state it was created for this hackathon.

### OPTIONAL — Link to a social media post
```
<-- placeholder: add once posted -->
```
**Action for you:** comes later too. Must include `#AllThingsAgenticHackathon`.
