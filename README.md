# Threat Risk Assessment Workspace

A workspace for producing threat risk assessments (TRAs), and the security designs that follow from them, with two Claude Code agents:

| Agent | What it does | Input | Output |
|---|---|---|---|
| `assessor` | Runs the TRA process against a subject and writes the assessment. Questions it can't answer go into a clarifications file. | A scenario (description of the system) | TRA + clarifications file |
| `designer` | Turns a completed TRA into a target security design and a traceable list of security controls | The TRA (+ clarifications file) | Security design + security control list |

## Contents

- [Repository layout](#repository-layout)
- [Workflow](#workflow)
- [Running the agents](#running-the-agents)
- [Step-by-step example](#step-by-step-example)
- [The assessor agent](#the-assessor-agent)
- [The designer agent](#the-designer-agent)
- [Answering clarification questions](#answering-clarification-questions)
- [ID schemes](#id-schemes)
- [Versioning](#versioning)
- [Changing the agents](#changing-the-agents)
- [Limits and good practice](#limits-and-good-practice)

---

## Repository layout

```
.
├── .claude/agents/
│   ├── assessor.md                          # assessor agent (built from docs/spec/assessor.md)
│   └── designer.md                          # designer agent (built from docs/spec/designer.md)
├── docs/
│   ├── threat-risk-assessment-process.md    # the 11-step TRA process the assessor follows
│   ├── threat-risk-assessment-template.md   # the TRA document template
│   └── spec/
│       ├── assessor.md                      # spec for the assessor agent
│       └── designer.md                      # spec for the designer agent
├── scenario/<subject>/                      # input: one folder per subject   (not in git)
│   └── description.md
└── output/<subject>/                        # generated documents             (not in git)
    ├── threat-risk-assessment-<subject>.md
    ├── clarifications-needed-<subject>.md
    ├── security-design-<subject>.md
    └── security-controls-<subject>.md
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
            │                           │ human writes answers
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
```

1. **Describe the subject** in `scenario/<subject>/description.md`.
2. **Run the assessor.** It writes the TRA and a clarifications file.
3. **Answer questions** in the clarifications file.
4. **Run the assessor again.** It re-assesses using your answers, re-scores the risks, and adds follow-up questions.
5. **Repeat steps 3–4** until the questions that drive the ratings are answered.
6. **Run the designer** to produce the security design and the control list.
7. **Re-run the designer** whenever the TRA changes.

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

Both agents accept overrides in the request:

```
use the assessor agent on scenario/payroll with process docs/my-process.md
and template docs/my-template.md

use the designer agent on output/payroll/threat-risk-assessment-payroll.md
and write the design to output/payroll/design-v2.md
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

**3. Answer the most important questions.** They are listed first in the clarifications file (see [Answering clarification questions](#answering-clarification-questions)).

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

---

## The assessor agent

**Definition:** `.claude/agents/assessor.md`. **Spec:** `docs/spec/assessor.md`.

### Inputs

| Input | Default |
|---|---|
| Process | `docs/threat-risk-assessment-process.md` |
| Template | `docs/threat-risk-assessment-template.md` |
| Subject | Required: a scenario folder or file, a codebase, architecture docs, or notes in the request |
| Output | `output/<slug>/threat-risk-assessment-<slug>.md` |
| Clarifications | `output/<slug>/clarifications-needed-<slug>.md` |

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

### How it treats evidence

- Facts must come from the source material or the clarification answers, cited by file and line or question number.
- Anything else is an **assumption**. Assumptions are recorded in §2.7 and marked `(assumed)` in tables.
- Ratings are conservative. A control with no evidence is rated `Partial` or `Ineffective`, never `Effective`.
- Owners, approvers, signatures and risk acceptance are left blank or `TBD` for humans to complete.

### Re-assessment

Ask for a re-assessment whenever the scenario or the clarification answers change. The assessor reads the existing TRA and clarifications file and works out what is new. It then updates the affected sections, explains every rating change, bumps both versions, and adds follow-up questions for answers that were only partial.

---

## The designer agent

**Definition:** `.claude/agents/designer.md`. **Spec:** `docs/spec/designer.md`.

The designer needs a finished TRA. If there's no TRA for the subject, it stops and asks you to run the assessor first.

### Inputs

| Input | Default |
|---|---|
| TRA | `output/<slug>/threat-risk-assessment-<slug>.md` |
| Clarifications | `output/<slug>/clarifications-needed-<slug>.md` (read if it exists) |
| Design output | `output/<slug>/security-design-<slug>.md` |
| Controls output | `output/<slug>/security-controls-<slug>.md` |

### Outputs

**Security design.** The target architecture:
- design principles (DP-)
- the current state, from evidence only
- a target architecture diagram
- security zones and trust boundaries
- allowed data flows (F-); everything else is denied
- component designs
- design decisions (DD-) that need an owner
- residual risk if implemented
- open design questions

**Security controls.** One row per control (SC-):

| Field | Meaning |
|---|---|
| Status | **New**: nothing comparable exists today. **Strengthen**: builds on an existing TRA control (C-). **Replace**: supersedes an assumed or ineffective one. |
| Risks treated | The TRA risks (R-) the control addresses |
| Priority | From the highest current rating among those risks: P1 Critical, P2 High, P3 Medium, P4 Low |
| Target date | The earliest TRA treatment date among those risks |
| Compliance reference | Only for frameworks the TRA says apply, such as PCI DSS |
| Verification | The evidence or test that shows the control works |

The control list also has a risk-coverage table, a table showing what happens to each existing control, and the dependencies between controls.

### Rules worth knowing

- **It derives; it doesn't assess.** It never adds or re-scores risks. If it finds a gap in the TRA, it tells you to re-assess.
- **SC- IDs are stable.** They are never renumbered or reused, and a dropped control is marked `Retired`. That makes the control list safe to track in a ticketing system.
- **Compliance differences are flagged, not hidden.** If a requirement is stricter than the TRA (for example, PCI DSS requiring firewall reviews every six months when the TRA says yearly), both figures are shown. The TRA is left unchanged; fix it at the next re-assessment.

---

## Answering clarification questions

Each question in `clarifications-needed-<slug>.md` looks like this:

```markdown
### Q-03: Patching

- **Question:** How and when is the server patched? ...
- **Why it matters:** ... could lower R-01 from Likely (4) to Possible (3) ...
- **Status:** Open
- **Answer:**
```

- **Write your answer after `**Answer:**`** and leave the rest alone. The agent sets the **Status** when it uses the answer.
- **Start with the questions near the top.** They are the most likely to change a rating; the "Why it matters" line says how.
- **Partial answers are fine.** The agent uses what you give, marks the question "Answered in part", and adds a follow-up question for the rest.
- **Be specific.** "Apache 2.4.62 on Ubuntu 24.04" lets the agent check for known vulnerabilities; "Apache" does not.
- **Don't delete or renumber questions.** Appendix B in the TRA uses the same numbers.

When you've answered a batch, ask for a re-assessment.

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
| E- | Evidence reference | TRA Appendix B |
| Q- | Clarification question | Clarifications file and TRA Appendix B |
| DP-, F-, DD- | Design principle, data flow, design decision | Security design |
| SC- | Security control (recommended) | Security control list |

Every risk traces to its assets, threats, vulnerabilities and existing controls. Every SC- control traces to the risks it treats.

---

## Versioning

- **Generated documents** carry their own version and revision history. Agents bump the version on every update, starting at 0.1 with Status `Draft`. Moving to "In review" or "Approved" is a human decision.
- **Agent definitions, specs, the process and the template** are versioned in git. The generated documents are not (`output/` is git-ignored).

---

## Changing the agents

Each agent has a **spec** in `docs/spec/`, the short, human-maintained statement of what it must do. The **agent definition** in `.claude/agents/` is the detailed instruction set built from it.

To change an agent's behaviour:

1. Edit the spec in `docs/spec/<agent>.md`.
2. Ask Claude Code to rebuild the agent from the spec, for example: `rewrite the agent at docs/spec/assessor.md`.
3. Review the diff and commit both files together.

To change how assessments are done for every subject, edit `docs/threat-risk-assessment-process.md` or `docs/threat-risk-assessment-template.md`. The agents read them on every run and never modify them.

---

## Limits and good practice

- **Ratings are only as good as the evidence.** A two-line scenario produces a TRA built mostly on assumptions. Treat early versions as a list of what to find out, not a verdict.
- **Agents don't test anything.** They don't scan, probe or log in to systems. Controls stay `Partial` until someone verifies them; port scans, vulnerability scans and pen tests are recommended as evidence.
- **Agents have no shell.** They can only read, search and write files.
- **Web access is limited to public information.** The agents look up public threat intelligence, CVEs and standards such as PCI DSS, CIS and OWASP. They never send details of your system to external services.
- **Humans own the decisions.** Risk acceptance, sign-off, owners and design decisions are left blank or `TBD` on purpose.
- **Review before you rely on it.** Agent output is a draft for a qualified reviewer, not a substitute for one.
