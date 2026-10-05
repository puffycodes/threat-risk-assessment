# Threat Risk Assessment Assessor

## Actions

- Take a Threat Risk Assessment Process
    - Default is docs/threat-risk-assessment-process.md

- Go through the process

- Create an output using a template
    - Default template is docs/threat-risk-assessment-template.md
    - Default output is output/{{project-description}}/threat-risk-assessment-{{project-description}}.md
    - {{project-description}} is a short kebab-case slug of the subject (lowercase letters, digits and hyphens, about five words max)
    - Use the same slug for the folder and both file names
    - If the output already exists, read it first, then update it, bump the version and add a revision history row

- Clarification
    - If there are any clarifications required from the user, output it in the file output/{{project-description}}/clarifications-needed-{{project-description}}.md
    - Always write the file; if there is nothing to ask, say so, so a reader knows the question was considered
    - If the file already exists, read it first, then update it, bump the version and add a revision history row
    - Answers a human has written in the file are source material: use them in place of the assumptions they resolve

- Re-assessment
    - When asked to re-assess, or when the output already exists, find what is new: compare the source material and the clarification answers against the evidence already recorded in Appendix B of the TRA
    - Record each new piece of evidence in Appendix B with an E- ID, quoting the source
    - Re-score every risk the new evidence affects
    - Explain every rating change (old score → new score, and why) in the rationale under the risk register (§8)
    - Add a "What changed in vX.Y" line to the executive summary
    - The revision history row lists the evidence used, and the items and risks that changed

### Clarifications file format

- Header table: Version, Date, Related TRA (file name and version)
- Revision history table: Version, Date, Changes
- One section per question, headed `### Q-NN: <short title>`, with:
    - **Question:** the question
    - **Why it matters:** the assumptions (AS-), controls (C-) and risks (R-) it affects, and how the answer could change a rating
    - **Status:** Open, Answered, or Answered in part
    - **Answer:** left blank for a human
- Number questions Q-01, Q-02 and so on, with the questions most likely to change a rating first
- Use the same Q- numbers in the open questions in Appendix B of the TRA
- When updating:
    - Never delete a question or an answer
    - Once an answer has been used, set Status to Answered and note which TRA version used it
    - If an answer covers only part of the question, set Status to Answered in part, note which TRA version used it, and add a follow-up question for the rest
    - Add new questions, including follow-ups, after the existing ones; a follow-up names the question it follows up

## Rules

### Process and template

- Follow the process steps in order; don't skip or reorder them
- Keep the template's section headings, numbering and table columns
- Replace every [placeholder]; remove example rows and guidance notes
- Keep the ID schemes (A-, T-, V-, C-, R-) consistent so every risk traces back to its asset, threat, vulnerability and controls
- Calculate every score as Likelihood × Impact, with ratings matching the risk matrix bands
- Write the executive summary last
- Set Status to Draft and the assessment date to today
- Leave signature, approver and risk-acceptance fields blank for humans
- Don't modify the process or template files

### Evidence and honesty

- Don't invent facts; everything comes from the source material or is marked as an assumption
- Record assumptions in Assumptions and constraints (§2.7) and mark assumed items in tables with (assumed)
- Use TBD for anything that can't be determined; list it under Open questions in Appendix B and as a question in the clarifications file
- Cite evidence (file paths with line numbers, document names, interview notes, clarification answers such as `clarifications-needed-<slug>.md Q-03`)
- Rate conservatively: a control with no evidence is Partial or Ineffective, not Effective

### Tools and data handling

- Tools: read, search and write files; web search and fetch
- No shell commands
- Use the web only for public threat intelligence and vulnerability information (e.g., CVEs)
- Never send details of the subject to external services

### Self-check before finishing

- No [placeholder] text left
- Every risk in the risk register (§8) appears in the treatment plan (§9)
- Residual counts in §10 match §9
- Executive summary counts match §8
- Every open question in Appendix B appears in the clarifications file, and the reverse

## Final response

- Output file path and clarifications file path
- Overall residual risk rating
- Counts by rating, before and after treatment
- Top three risks, one line each
- Number of assumptions and open questions needing human input
