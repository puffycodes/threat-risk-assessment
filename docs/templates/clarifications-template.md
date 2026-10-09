# Clarifications Needed: [System / Project Name]

> Template. Replace everything in `[brackets]` and delete guidance notes (lines starting with `>`) before issuing.
> This file holds the questions a TRA ([threat-risk-assessment-template.md](threat-risk-assessment-template.md)) needs a human to answer. The assessor writes it; people answer with /clarify, in the assessment browser, or by editing it.
> This template defines the layout only. How the file changes over time (statuses, follow-ups, copying browser submissions) is in the assessor's rules.
> The assessment browser and /clarify parse this layout. If you change it, check that they still read it (README, "What it relies on").

| Field | Value |
|---|---|
| Version | [0.1] |
| Date | [YYYY-MM-DD] |
| Related TRA | [threat-risk-assessment-<slug>.md (0.1)] |

## Revision history

| Version | Date | Changes |
|---|---|---|
| 0.1 | [YYYY-MM-DD] | [First version: Q-01 to Q-nn, raised by TRA v0.1] |

## Questions

> One section per question, headed `### Q-nn: <short title>`, numbered Q-01, Q-02 and so on, with the questions most likely to change a rating first. The same numbers are used in Appendix B of the TRA. Never delete or renumber a question.
> Fields, in this order. Each is a list item starting with its name in bold:
> - **Question:** the question. Name the role to ask if it isn't obvious.
> - **Why it matters:** the assumptions (AS-), controls (C-) and risks (R-) it affects, and how the answer could change a rating.
> - **Status:** `Open`, `Answered (used in TRA version X.Y)` or `Answered in part (used in TRA version X.Y; follow-up Q-nn)`. Only the assessor sets it.
> - **Answer:** blank until someone answers.
> - **Answered by:** and **Answered on:** (YYYY-MM-DD), directly below the answer they belong to.
> - **Further answer:** a later answer to the same question, followed by its own Answered by and Answered on. An answer copied from a browser submission ends with "(from answers-<YYYYMMDD-HHMMSS>.md)".
> A follow-up question adds "(follow-up to Q-nn)" to its title and goes after the existing questions.
> If there is nothing to ask, replace the questions with: "No questions: [why nothing needs a human answer]."

### Q-01: [Short question title]

- **Question:** [The question]
- **Why it matters:** [AS-01 assumes X. If the answer is Y, R-01 would fall from High (12) to Medium (8).]
- **Status:** Open
- **Answer:**

### Q-02: [Short question title] (follow-up to Q-01)

- **Question:** [The question]
- **Why it matters:** [Effect on assumptions, controls and risks]
- **Status:** Answered in part (used in TRA version [0.2]; follow-up Q-03)
- **Answer:** [The answer, in the answerer's words]
- **Answered by:** [Name or role]
- **Answered on:** [YYYY-MM-DD]
- **Further answer:** [A later answer] (from answers-[YYYYMMDD-HHMMSS].md)
- **Answered by:** [Name or role]
- **Answered on:** [YYYY-MM-DD]
