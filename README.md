# Threat Risk Assessment Workspace

A workspace for producing threat risk assessments (TRAs), and the security designs that follow from them, with three Claude Code agents and one skill:

| Agent / skill | What it does | Input | Output |
|---|---|---|---|
| `assessor` | Runs the TRA process against a subject and writes the assessment. Questions it can't answer go into a clarifications file. | A scenario (description of the system) | TRA + clarifications file |
| `designer` | Turns a completed TRA into a target security design and a traceable list of security controls | The TRA (+ clarifications file) | Security design + security control list |
| `summarizer` | Summarizes the assessment so far into a description of the system (design, controls, data flows), with no risk assessment in it. Marks each item as given or assumed, and can be fed back to the assessor | The TRA (+ clarifications file) | System description |
| `/clarify` (skill) | Interviews you to answer the open clarification questions, and writes your answers into the clarifications file | The clarifications file | Updated clarifications file |

To read the results, the [assessment browser](#browsing-the-assessments) shows every subject's documents in a web browser. It's a small local web server and doesn't use any agent or skill.

## Contents

- [Repository layout](#repository-layout)
- [Workflow](#workflow)
- [Running the agents](#running-the-agents)
- [Step-by-step example](#step-by-step-example)
- [The assessor agent](#the-assessor-agent)
- [The designer agent](#the-designer-agent)
- [The summarizer agent](#the-summarizer-agent)
- [Answering clarification questions](#answering-clarification-questions)
- [Browsing the assessments](#browsing-the-assessments)
- [ID schemes](#id-schemes)
- [Versioning](#versioning)
- [Changing the agents](#changing-the-agents)
- [Limits and good practice](#limits-and-good-practice)

---

## Repository layout

```
.
├── .claude/
│   ├── agents/
│   │   ├── assessor.md                      # assessor agent (built from docs/spec/assessor.md)
│   │   ├── designer.md                      # designer agent (built from docs/spec/designer.md)
│   │   └── summarizer.md                    # summarizer agent (built from docs/spec/summarizer.md)
│   └── skills/clarify/
│       └── SKILL.md                         # /clarify skill (built from docs/spec/clarify.md)
├── docs/
│   ├── threat-risk-assessment-process.md    # the 11-step TRA process the assessor follows
│   ├── templates/
│   │   ├── threat-risk-assessment-template.md  # the TRA document template
│   │   ├── security-design-template.md         # the security design template
│   │   └── security-controls-template.md       # the security control list template
│   └── spec/
│       ├── assessor.md                      # spec for the assessor agent
│       ├── clarify.md                       # spec for the /clarify skill
│       ├── designer.md                      # spec for the designer agent
│       ├── summarizer.md                    # spec for the summarizer agent
│       └── assessment-browser/features.md   # spec for the assessment browser
├── tools/assessment-browser/
│   ├── serve.py                             # assessment browser: local web server
│   └── static/                              # the browser app (HTML, JavaScript, CSS)
├── scenario/<subject>/                      # input: one folder per subject   (not in git)
│   └── description.md
└── output/<subject>/                        # generated documents             (not in git)
    ├── threat-risk-assessment-<subject>.md
    ├── clarifications-needed-<subject>.md
    ├── security-design-<subject>.md
    ├── security-controls-<subject>.md
    ├── system-summary-<subject>-v<version>.md
    └── answers/                             # answers given in the assessment browser
        ├── draft.md                         #   the answers being written, not yet submitted
        └── answers-<YYYYMMDD-HHMMSS>.md     #   one file per submission
```

`scenario/` and `output/` are listed in `.gitignore`. They can contain sensitive details about real systems, so they stay out of version control. Back them up separately if you need to.

---

## Workflow

```
 scenario/<subject>/description.md
            │
            ▼
   ┌──────────────────┐      clarifications-needed-<subject>.md
   │     assessor     │────► (questions for a human)
   └──────────────────┘                 │
            │                           │ /clarify interview
            │                           │ or assessment browser
            │                           │ (or edit the file)
            ▼                           ▼
 threat-risk-assessment-<subject>.md ◄── re-assessment (assessor again)
            │                             repeat until the open questions
            │                             that matter are answered
            ▼
   ┌──────────────────┐
   │     designer     │
   └──────────────────┘
            │
            ├──► security-design-<subject>.md
            └──► security-controls-<subject>.md

 At any point after the first assessment:

 threat-risk-assessment-<subject>.md
 + clarifications-needed-<subject>.md
            │
            ▼
   ┌──────────────────┐
   │    summarizer    │
   └──────────────────┘
            │
            └──► system-summary-<subject>-v<version>.md
                 (copy to scenario/<new-subject>/description.md
                  to assess it afresh)
```

1. **Describe the subject** in `scenario/<subject>/description.md`.
2. **Run the assessor.** It writes the TRA and a clarifications file.
3. **Answer questions** with `/clarify <subject>`, in the [assessment browser](#in-the-assessment-browser), or by editing the clarifications file.
4. **Run the assessor again.** It re-assesses using your answers, re-scores the risks, and adds follow-up questions.
5. **Repeat steps 3–4** until the questions that drive the ratings are answered.
6. **Run the designer** to produce the security design and the control list.
7. **Re-run the designer** whenever the TRA changes.

At any point after the first assessment, **run the summarizer** for a one-document description of what is known about the system so far. The assessor can use it as source material for a fresh assessment (see [Feeding it to the assessor](#feeding-it-to-the-assessor)).

At any step, **read the results in the [assessment browser](#browsing-the-assessments)**. It shows the risk matrix, the open questions and the documents, with every ID linked to where it's defined, and it updates while the agents work.

---

## Running the agents

The agents are Claude Code subagents, defined in `.claude/agents/`. Start Claude Code in this folder and ask for the task in plain language. Claude picks the matching agent from its description:

```
do a threat risk assessment for scenario/public-web-server
```

To be sure a particular agent is used, name it, or @-mention it:

```
use the assessor agent to do a re-assessment for scenario/public-web-server
@agent-designer create the security design and controls for public-web-server
```

The agent runs in its own context and reports back a short summary when it finishes. The full results are in the files under `output/<subject>/`.

### Overriding defaults

All three agents accept overrides in the request:

```
use the assessor agent on scenario/payroll with process docs/my-process.md
and template docs/my-template.md

use the designer agent on output/payroll/threat-risk-assessment-payroll.md
and write the design to output/payroll/design-v2.md

use the summarizer agent for payroll and write it to output/payroll/payroll-baseline.md
```

---

## Step-by-step example

**1. Create the scenario.** Write what you know, one fact per line. Short is fine; the assessor records everything else as an assumption.

```markdown
<!-- scenario/public-web-server/description.md -->
# Web Server Connected to the Internet

- A web server connected to the Internet and is accessible by the public.
- A firewall controls the access to only port 80 and 443 of the web server.
```

**2. Assess.**

```
do a threat risk assessment for scenario/public-web-server
```

This produces `output/public-web-server/threat-risk-assessment-public-web-server.md` (version 0.1) and `clarifications-needed-public-web-server.md`.

**3. Answer the questions.**

```
/clarify public-web-server
```

Claude interviews you, most important questions first, and saves your answers with who answered and when. People who don't use Claude Code can answer in the assessment browser instead, and you can also edit the file by hand (see [Answering clarification questions](#answering-clarification-questions)).

**4. Re-assess.**

```
do a re-assessment for scenario/public-web-server
```

The TRA version goes up. A revision-history row and a "What changed" line in the executive summary list which answers were used and which risks moved.

**5. Design.**

```
use the designer agent for public-web-server
```

This produces `security-design-public-web-server.md` and `security-controls-public-web-server.md`.

**6. Review.** In a terminal, outside Claude Code:

```
python tools/assessment-browser/serve.py
```

Open the subject to see the risk matrix and register, then go through the TRA, design and controls. Hover over an ID such as `R-03` to see its definition, or click it to go there. The **Questions** tab shows which answers are still waiting for a re-assessment.

---

## The assessor agent

**Definition:** `.claude/agents/assessor.md`. **Spec:** `docs/spec/assessor.md`.

### Inputs

| Input | Default |
|---|---|
| Process | `docs/threat-risk-assessment-process.md` |
| Template | `docs/templates/threat-risk-assessment-template.md` |
| Subject | Required: a scenario folder or file, a codebase, architecture docs, or notes in the request |
| Output | `output/<slug>/threat-risk-assessment-<slug>.md` |
| Clarifications | `output/<slug>/clarifications-needed-<slug>.md` |
| Answer submissions | `output/<slug>/answers/answers-*.md`, from the assessment browser (read if any exist) |

`<slug>` is a short kebab-case name for the subject, such as `public-web-server`. Name the scenario folder with the slug you want, because the output folder name follows it.

### What it does

1. Follows the 11 process steps in order: scope → assets → threats → vulnerabilities → controls → likelihood → impact → risk rating → treatment → report → monitoring.
2. Fills in the template, keeping all of its sections, numbering and table columns.
3. Scores each risk as Likelihood × Impact on the template's 5 × 5 matrix: Low 1–4, Medium 5–9, High 10–15, Critical 16–25.
4. Writes every unanswerable question twice: in Appendix B of the TRA and in the clarifications file, with matching Q- numbers.
5. Checks itself before finishing:
   - no placeholders are left
   - every risk appears in the treatment plan
   - the counts in the summaries match the risk register
   - Appendix B matches the clarifications file
   - every claim about threat activity behind a likelihood cites a source
   - risks that share an event give it the same likelihood, or explain why not

### How it treats evidence

- Facts must come from the source material or the clarification answers, cited by file and line or question number.
- Anything else is an **assumption**. Assumptions are recorded in §2.7 and numbered AS-01, AS-02 and so on, and marked `(assumed, AS-nn)` in tables.
- Ratings are conservative. A control with no evidence is rated `Partial` or `Ineffective`, never `Effective`.
- Likelihoods are argued from evidence:
  - A claim about threat activity, such as "phishing is common against this sector", needs a source: threat intelligence, incident history or a clarification answer. Without one, the likelihood rests on the system's own exposure and controls.
  - The organization's sector or profile is never guessed from clues such as a job title; if it matters, it becomes a clarification question.
  - An event shared by several risks, such as a stolen admin password, gets the same likelihood in each, or the rationale explains why not.
  - Where one way in leads to outcomes with different impacts, they are scored as separate risks, or the rationale explains why the worst outcome is as likely as the easiest way in.
- A system description from the summarizer is read by its labels: Given items are evidence, Given (unverified) items are rated conservatively, and Assumed items stay assumptions. Its Unknowns become clarification questions, and for each of its Inconsistencies the TRA records which version it used and why.
- Owners, approvers, signatures and risk acceptance are left blank or `TBD` for humans to complete.

### Re-assessment

Ask for a re-assessment whenever the scenario or the clarification answers change, including when answers are submitted in the assessment browser. The assessor reads the existing TRA and clarifications file and works out what is new. It then:

- copies the answers from pending browser submissions into the clarifications file, oldest first, with who answered and when, and marks each submission `Used in TRA version X.Y` (see below)
- records each new answer in Appendix B with an E- ID, quoting it with who answered and when
- updates the affected sections and re-scores the affected risks
- explains every rating change in the §8 rating history and in a "What changed" line in the executive summary
- marks the answers it used as `Answered` or `Answered in part`, and adds follow-up questions for what is still missing
- refreshes the "Why it matters" text of the remaining open questions, so the ratings they quote stay current
- bumps the version of both files

You can also ask for a re-assessment to fix gaps the designer reports, with no new answers. The assessor checks each gap against the TRA, fixes the ones that hold, and says why for any it leaves.

A re-assessment can raise ratings as well as lower them: an answer can reveal a new weakness, or even a new risk.

**Browser submissions.** The assessor uses only submissions whose Status is `Pending`; it ignores the draft and withdrawn submissions. Each answer goes under its question, followed by "(from answers-<…>.md)". If the question already has an answer, the new one is added below it as a **Further answer**, so nothing is replaced. Answers to questions that have since closed are still copied, as new evidence. If `/clarify` recorded a correction to a submitted answer, the submitted answer is still copied as a record, but the correction is the one used as evidence. The assessor changes only the submission's Status row, never its answers.

---

## The designer agent

**Definition:** `.claude/agents/designer.md`. **Spec:** `docs/spec/designer.md`.

The designer needs a finished TRA. If there's no TRA for the subject, it stops and asks you to run the assessor first. It runs on Sonnet (set by `model: sonnet` in its definition); the assessor uses the same model as your Claude Code session.

### Inputs

| Input | Default |
|---|---|
| TRA | `output/<slug>/threat-risk-assessment-<slug>.md` |
| Clarifications | `output/<slug>/clarifications-needed-<slug>.md` (read if it exists) |
| Design template | `docs/templates/security-design-template.md` |
| Controls template | `docs/templates/security-controls-template.md` |
| Design output | `output/<slug>/security-design-<slug>.md` |
| Controls output | `output/<slug>/security-controls-<slug>.md` |

### Outputs

**Security design.** The target architecture:
- design principles (DP-)
- the current state, from evidence only
- a target architecture diagram
- security zones and trust boundaries
- allowed data flows (F-); everything else is denied
- data classification and handling
- identity and access, including service accounts and API keys
- cryptography and secrets
- logging and monitoring
- component designs
- design decisions (DD-) that need an owner
- residual risk if implemented
- open design questions
- assumptions inherited from the TRA, and any the design adds

**Security controls.** One row per control (SC-):

| Field | Meaning |
|---|---|
| Status | **New**: nothing comparable exists today. **Strengthen**: builds on an existing TRA control (C-). **Replace**: supersedes an assumed or ineffective one. **Retired**: no longer needed; kept with the reason, and the ID is never reused. |
| Risks treated | The TRA risks (R-) the control addresses |
| Priority | From the highest current rating among those risks: P1 Critical, P2 High, P3 Medium, P4 Low |
| Target date | The earliest TRA treatment date among the actions the control implements: an action's own date where the TRA gives one, otherwise its risk's target date |
| Compliance reference | Only for frameworks the TRA says apply, such as PCI DSS |
| Verification | The evidence or test that shows the control works |

The control list also has a risk-coverage table, a table showing what happens to each existing control, and the dependencies between controls.

### Rules worth knowing

- **It derives; it doesn't assess.** It never adds or re-scores risks. If it finds a gap in the TRA, it tells you to re-assess.
- **SC- IDs are stable.** They are never renumbered or reused, and a dropped control is marked `Retired`. That makes the control list safe to track in a ticketing system.
- **Compliance differences are flagged, not hidden.** If a requirement is stricter than the TRA (for example, PCI DSS requiring firewall reviews every six months when the TRA says yearly), both figures are shown. The TRA is left unchanged; fix it at the next re-assessment.

---

## The summarizer agent

**Definition:** `.claude/agents/summarizer.md`. **Spec:** `docs/spec/summarizer.md`.

```
use the summarizer agent for public-web-server
```

It needs a TRA, and it can run at any stage after the first assessment. It runs on Sonnet.

### Inputs

| Input | Default |
|---|---|
| TRA | `output/<slug>/threat-risk-assessment-<slug>.md` |
| Clarifications | `output/<slug>/clarifications-needed-<slug>.md` (read if it exists) |
| Source material | The files the TRA cites as evidence, such as `scenario/<slug>/description.md` |
| Output | `output/<slug>/system-summary-<slug>-v<version>.md`, or the file name you give |

Every run writes a new file and leaves earlier summaries as they are. The version goes up by 0.1 each time, starting at 0.1, and the default file name ends with it, for example `system-summary-public-web-server-v0.2.md`. To choose the name yourself, give it in the request:

```
use the summarizer agent for public-web-server and write it to output/public-web-server/web-server-baseline.md
```

The summarizer won't overwrite an existing file; if the name is taken, it asks for another.

It doesn't read the security design or the control list: they hold recommendations, not facts about the system as it is.

### Output

A description of the system as it is, laid out like a scenario file: one item per line, covering components, network and zones, technology, data and data flows, controls in place, people and access, operations, obligations, business and threat context, unknowns and inconsistencies. Every item is labelled and cites its source:

| Label | Meaning | Source |
|---|---|---|
| **Given** | Stated in the scenario or a clarification answer | The original file and line, or the Q- answer with who answered and when |
| **Assumed** | Assumed or inferred by the TRA | The TRA version and section, such as `TRA v0.3 §2.7 AS-04` |

A Given item is tagged **Given (unverified)** when its source doesn't say who gave it, or when another source doubts it. An Item counts table near the top gives the number of items of each kind in each section.

### Rules worth knowing

- **No risk assessment.** It leaves out the TRA's threat analysis, vulnerability findings, asset valuations, control effectiveness, ratings, risks and treatments, and the public research the TRA did, such as end-of-life dates and CVEs. A vulnerability becomes the plain fact behind it, such as "Admin accounts use passwords only". The test for a borderline item: would it still be true if nobody had assessed the system?
- **Context is kept separately.** Facts people gave about the threat environment, such as the organization's sector, go in a Business and threat context section, as Given items only.
- **It adds nothing.** Anything not in the documents is listed under Unknowns, not filled in.
- **It doesn't resolve conflicts.** Disagreements between sources are listed with both citations.
- **It doesn't reuse TRA IDs.** The assessor assigns its own A-, C- and other IDs when it reads the summary.

### Feeding it to the assessor

To assess the system afresh from what is known so far, copy the summary into a new scenario folder and run the assessor on it:

```
copy output/public-web-server/system-summary-public-web-server-v0.2.md
  to scenario/public-web-server-detail/description.md
do a threat risk assessment for scenario/public-web-server-detail
```

The new folder name gives the assessment its own slug, so it writes to `output/public-web-server-detail/` and leaves the original TRA alone. The assessor recognises the summary and treats each item by its label (see [How it treats evidence](#how-it-treats-evidence)). The summary's citations still point at the original subject's files, so they stay traceable, but line numbers can drift if those files change later.

The new subject gets its own clarifications file. Answers given there, for example with `/clarify public-web-server-detail`, apply only to the new subject: the original TRA doesn't receive them unless you answer its questions too.

---

## Answering clarification questions

### With the interview (recommended)

Type `/clarify` and the subject in Claude Code:

```
/clarify public-web-server
/clarify public-web-server Q-17 Q-22      # only these questions
/clarify public web server                # the subject's name works too
```

Claude asks who is answering, then goes through the open questions, most important first. It asks up to four at a time and offers multiple-choice answers where they fit. Type your own answer whenever the options don't fit, choose "Don't know", or type `stop` to finish early. Answers are saved to the clarifications file after each batch, with **Answered by** and **Answered on**, so nothing is lost if you stop part-way.

If an answer contradicts an earlier answer or a fact in the TRA, Claude quotes both and asks which is right before saving. If you confirm that something has changed since, for example a control added after the TRA was written, the answer says so. The earlier statement isn't edited, so the record shows both.

The assessor takes answers at face value. If an answer would lower a rating and it overturns what someone else said, such as the System owner, have that person confirm it, or supply evidence like a configuration export or a log sample, before you re-assess. The interview never changes a question's status, never re-assesses, and never records secrets such as passwords or full card numbers. It is a skill rather than an agent because it needs to ask you questions as it goes, and agents run in the background.

If someone has answered a question in the assessment browser and the answer is still pending, the interview shows that answer and asks whether to keep it (the question is skipped), add to it, or correct it. To check pending answers without answering anything, run `/clarify <subject> --review-submissions`. It reports contradictions, possible secrets and answers too vague to change a rating, and writes nothing.

### In the assessment browser

For people who don't use Claude Code. Start the [assessment browser](#browsing-the-assessments), open the subject's **Questions** tab and choose **Answer clarification questions**.

- Enter who is answering (name or role). It is recorded with every answer.
- For each Open or Answered in part question, write an answer, choose **Don't know**, or **Skip** it. Answers already given, in the clarifications file or in a pending submission, are shown so you don't answer twice.
- Your answers are saved as a draft while you type (`output/<subject>/answers/draft.md`), so you can close the browser and continue later.
- **Review and submit** shows what you answered, marked "Don't know" and skipped, then writes a new file, `output/<subject>/answers/answers-<YYYYMMDD-HHMMSS>.md`, and clears the draft. An earlier submission is never overwritten.
- A submission stays **Pending** until the next re-assessment. The assessor then copies its answers into the clarifications file, with who answered and when, and marks it **Used in TRA version X.Y**. Until then you can **Withdraw** it from the Questions tab; the file is kept as a record.

The browser doesn't change the clarifications file or any other assessment document. It won't save or submit an answer that looks like a full card number, and it warns about anything that looks like a password, key or token. It can't check answers for contradictions, because it uses no agent; the assessor does that when it uses them, and `/clarify --review-submissions` can do it sooner. If the clarifications file changes while you're answering, for example after a re-assessment, the browser shows which of your questions changed and asks you to review them before you submit.

### By editing the file

Each question in `clarifications-needed-<slug>.md` looks like this:

```markdown
### Q-03: Patching

- **Question:** How and when is the server patched? ...
- **Why it matters:** ... could lower R-01 from Likely (4) to Possible (3) ...
- **Status:** Open
- **Answer:**
```

- **Write your answer after `**Answer:**`**, then add `- **Answered by:** <name or role>` and `- **Answered on:** <YYYY-MM-DD>` below it. Leave the rest alone. The agent sets the **Status** when it uses the answer.
- **Start with the questions near the top.** They are the most likely to change a rating; the "Why it matters" line says how.
- **Partial answers are fine.** The agent uses what you give, marks the question "Answered in part", and adds a follow-up question for the rest.
- **Be specific.** "Apache 2.4.62 on Ubuntu 24.04" lets the agent check for known vulnerabilities; "Apache" does not.
- **Don't delete or renumber questions.** Appendix B in the TRA uses the same numbers.

When you've answered a batch, ask for a re-assessment.

---

## Browsing the assessments

**Code:** `tools/assessment-browser/`. **Spec:** `docs/spec/assessment-browser/features.md`.

The assessment browser shows the documents in `scenario/` and `output/` in a web browser, with the IDs linked together. It needs only Python 3.7 or later (no packages to install) and a current web browser, and it doesn't use any agent or skill. Start it from the repository root:

```
python tools/assessment-browser/serve.py
```

It opens http://127.0.0.1:8765/ in your browser. Use `--port <n>` to pick another port and `--no-open` to skip opening the browser. Press Ctrl+C to stop it.

What it shows:

- **Subjects:** every folder under `scenario/` or `output/`, with the TRA version, risk counts and open questions.
- **Overview** for a subject: risk counts before and after treatment, a risk matrix (current or after treatment), a risk register you can sort and filter, and the list of documents. The matrix uses the bands from the TRA's own §3.4 risk matrix.
- **Questions:** the clarification questions, filtered by status. *Answered, not yet assessed* means the question has an answer, in the file or in a pending submission, that no re-assessment has used yet. From here you can also [answer the questions](#in-the-assessment-browser), and see and withdraw submissions.
- **Documents:** each document rendered, with a table of contents. Every ID (R-, A-, T-, V-, C-, AS-, E-, Q-, SC-, DP-, F-, DD-, SE-) links to where it's defined, in whichever document defines it, and shows the definition when you hover over it. File references such as `clarifications-needed-<subject>.md:52` open the source at that line. *Source* shows the Markdown with line numbers.
- **Search** across all of a subject's documents.

The page reloads documents when they change on disk, so you can leave it open while an agent works.

The server listens on 127.0.0.1 only, so other machines can't reach it. It serves only the `.md` files under `scenario/` and `output/`, and the pages load nothing from the Internet. The only files it writes are answer drafts and submissions in `output/<subject>/answers/`. It accepts those writes only from its own page, so another website open in the same browser can't send answers. If you restart the server, reload the page before saving.

### What it relies on

The browser reads the documents as the templates lay them out. If a page looks wrong after a template change, check these:

| Feature | Needs |
|---|---|
| Version, status and date | A `Field \| Value` table with `Version`, `Status` and `Date` (or `Assessment date`) rows |
| Risk register and matrix | In the TRA, a table whose first column is `Risk ID` with `L`, `I`, `Score` and `Rating` columns (§8) |
| Ratings after treatment | A `Risk ID` table with `Residual L`, `Residual I`, `Residual score` and `Residual rating` columns (§9) |
| Matrix colours | A table whose first heading contains `Likelihood`, with cells such as `15 H` (§3.4) |
| Questions | In the clarifications file, `### Q-nn: Title` headings followed by `- **Status:**`, `- **Answer:**` and other `- **Field:**` lines |
| ID links | An ID is defined by a table row whose first cell starts with it, a heading that starts with it (`### Q-01: ...`), or a list item that starts with it in bold (`- **AS-01:** ...`) |
| Document type | The file names shown in [Repository layout](#repository-layout); other `.md` files are shown under their own name |

---

## ID schemes

| Prefix | Meaning | Defined in |
|---|---|---|
| A- | Asset | TRA §4 |
| T- | Threat | TRA §5 |
| V- | Vulnerability | TRA §6 |
| C- | Existing control | TRA §7 |
| R- | Risk | TRA §8 (treatment in §9) |
| AS- | Assumption | TRA §2.7 |
| SE- | Shared event: a way in that several risks depend on, with one likelihood | TRA §8 |
| E- | Evidence reference | TRA Appendix B |
| Q- | Clarification question | Clarifications file and TRA Appendix B |
| DP-, F-, DD- | Design principle, data flow, design decision | Security design |
| SC- | Security control (recommended) | Security control list |

Every risk traces to its assets, threats, vulnerabilities and existing controls. Every SC- control traces to the risks it treats.

---

## Versioning

- **Generated documents** carry their own version and revision history. Agents bump the version on every update, starting at 0.1 with Status `Draft`. The summarizer is the exception to updating in place: each version is a new file, and earlier ones are kept. Moving to "In review" or "Approved" is a human decision.
- **Agent definitions, specs, the process, the templates and the assessment browser** are versioned in git. The generated documents are not (`output/` is git-ignored).

---

## Changing the agents

Each agent and skill has a **spec** in `docs/spec/`, the short, human-maintained statement of what it must do. The **agent definition** in `.claude/agents/` (or the skill in `.claude/skills/`) is the detailed instruction set built from it.

To change an agent's behaviour:

1. Edit the spec in `docs/spec/<agent>.md`.
2. Ask Claude Code to rebuild the agent from the spec, for example: `rewrite the agent at docs/spec/assessor.md`.
3. Review the diff and commit both files together.

To change how assessments are done for every subject, edit `docs/threat-risk-assessment-process.md` or the templates in `docs/templates/`. The agents read them on every run and never modify them. If you rename a table column or change how questions are laid out, check that the assessment browser still reads them (see [What it relies on](#what-it-relies-on)).

### Changing the assessment browser

The browser is code, not an agent, but it follows the same pattern: `docs/spec/assessment-browser/features.md` says what it must do.

1. Edit the spec.
2. Ask Claude Code to update the browser to match, for example: `update the assessment browser to match docs/spec/assessment-browser/features.md`.
3. Run it against the subjects in `output/` and check the pages, then commit the spec and the code together.

---

## Limits and good practice

- **Ratings are only as good as the evidence.** A two-line scenario produces a TRA built mostly on assumptions. Treat early versions as a list of what to find out, not a verdict.
- **Answers are taken at face value.** The assessor uses clarification answers as given, recording who answered and when. Ask the person who actually knows; for example, Security may not know the payment integration as well as the application owner. Answers from more than one person, and verification by scans, make the ratings more reliable.
- **Agents don't test anything.** They don't scan, probe or log in to systems. Controls stay `Partial` until someone verifies them; port scans, vulnerability scans and pen tests are recommended as evidence.
- **Agents have no shell.** They can only read, search and write files.
- **Web access is limited to public information.** The assessor and designer look up public threat intelligence, CVEs and standards such as PCI DSS, CIS and OWASP. They never send details of your system to external services. The summarizer has no web access.
- **Humans own the decisions.** Risk acceptance, sign-off, owners and design decisions are left blank or `TBD` on purpose.
- **Review before you rely on it.** Agent output is a draft for a qualified reviewer, not a substitute for one.
