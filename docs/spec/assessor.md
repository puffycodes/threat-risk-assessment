# Threat Risk Assessment Assessor

## Actions

- Take a Threat Risk Assessment Process
    - Default is docs/threat-risk-assessment-process.md

- Go through the process

- Create an output using a template
    - Default template is docs/templates/threat-risk-assessment-template.md
    - Default output is output/{{project-description}}/threat-risk-assessment-{{project-description}}.md
    - {{project-description}} is a short kebab-case slug of the subject (lowercase letters, digits and hyphens, about five words max)
    - Use the same slug for the folder and both file names
    - If the output already exists, read it first, then update it, bump the version and add a revision history row

- Clarification
    - If there are any clarifications required from the user, output it in the file output/{{project-description}}/clarifications-needed-{{project-description}}.md
    - Default template is docs/templates/clarifications-template.md
    - Always write the file; if there is nothing to ask, say so, so a reader knows the question was considered
    - If the file already exists, read it first, then update it, bump the version and add a revision history row
    - Answers a human has written in the file are source material: use them in place of the assumptions they resolve
    - Also read answer submissions from the assessment browser: output/{{project-description}}/answers/answers-*.md with Status Pending
        - Ignore draft.md and submissions with any other Status
        - Use them oldest first, by their Submitted time stamp
        - Copy each answer into the clarifications file under its question, with Answered by and Answered on from the submission, and note which submission it came from
        - If the question already has an answer, add the new one below it; never replace or delete an answer
        - If an answer in the clarifications file says it corrects a submission's answer (written by /clarify), still copy the submission's answer as a record, but use the correction as the evidence
        - If a submission answers a question that is no longer Open (for example, a re-assessment ran after it was submitted), still copy it, and treat it as new evidence
        - Check the answers for contradictions with each other and with the TRA, as for any other evidence, and record conflicts rather than resolve them
        - Questions listed under "Don't know" get no answer; mention them in the revision history row, and consider naming a different role to ask
        - Set the submission's Status to Used in TRA version X.Y; never change its answers
        - Name the submissions used in the revision history rows of the TRA and the clarifications file

- Re-assessment
    - When asked to re-assess, or when the output already exists, find what is new: compare the source material and the clarification answers against the evidence already recorded in Appendix B of the TRA
    - Record each new piece of evidence in Appendix B with an E- ID, quoting the source
    - Re-score every risk the new evidence affects
    - Explain every rating change (old score → new score, and why) in the rating history under the risk register (§8)
    - Add a "What changed in vX.Y" line to the executive summary
    - The revision history row lists the evidence used, and the items and risks that changed
    - Refresh the Why it matters text of every Open question so any ratings it quotes and any effects it predicts ("would drop to Medium") match the current TRA; leave Answered and Answered in part questions as a record
    - A re-assessment can also be asked for to fix gaps that the designer or a reviewer found, with no new evidence: check each gap against the TRA, fix the ones that hold, say why for any that don't, and handle rating changes and missing questions as above

### Clarifications file

- The layout (header table, revision history, question headings, and the field names and order) is in the clarifications template; keep it exactly, because /clarify and the assessment browser parse it
- Answered by and Answered on are added below an answer when a human answers (for example by the /clarify skill); the assessor fills them in only when it copies an answer from a browser submission, and then copies them from the submission
- When citing an answer as evidence, include who answered and when, if given
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
- Keep the templates' section headings, numbering, table columns and field names
- Replace every [placeholder]; remove example rows and guidance notes
- Keep the ID schemes (A-, T-, V-, C-, R-, AS-, SE-, E-, Q-) consistent so every risk traces back to its asset, threat, vulnerability and controls; never renumber or reuse an ID
- Write each assumption as a list item starting with its ID in bold (`- **AS-01:** ...`); when evidence resolves or withdraws one, add a note with the version instead of deleting it
- List every event that more than one risk depends on in the Shared events table in §8, numbered SE-1, SE-2 and so on
- In the treatment plan (§9), the Target date is when all of the risk's actions are due; number the actions, and give an action due earlier, or recurring, its own date or interval
- Calculate every score as Likelihood × Impact, with ratings matching the risk matrix bands
- Write the executive summary last
- Set Status to Draft and the assessment date to today
- Leave signature, approver and risk-acceptance fields blank for humans
- Don't modify the process or template files

### Evidence and honesty

- Don't invent facts; everything comes from the source material or is marked as an assumption
- Record assumptions in Assumptions and constraints (§2.7) and mark assumed items in tables with (assumed, AS-nn)
- Use TBD for anything that can't be determined; list it under Open questions in Appendix B and as a question in the clarifications file
- Cite evidence (file paths with line numbers, document names, interview notes, clarification answers such as `clarifications-needed-<slug>.md Q-03`)
- Rate conservatively: a control with no evidence is Partial or Ineffective, not Effective

### Likelihood and risk scenarios

- Every claim about threat activity used to set a likelihood (for example, "phishing is common against this sector") must cite a source: public threat intelligence, an incident history, or a clarification answer
    - Don't infer the organization's sector or profile from indirect clues, such as a job title; if it matters, raise a clarification question
    - Without a cited source, base the likelihood only on the system's own exposure and controls, and say so in the rating rationale
- Give the same event the same likelihood in every risk that depends on it (for example, a stolen administrator password used to log in), or explain the difference in the rating rationale; record it in the Shared events table (SE-)
- When one way in leads to outcomes with different impacts, either score each outcome as its own risk, or, if they are combined, say in the rating rationale why the likelihood applies to the worst outcome

### System descriptions from the summarizer

- Source material may be a system description written by the summarizer agent (its title starts "System Description:" and it has a "How to use this file" section); treat each item by its label:
    - Given: evidence. Cite the description's file and line, and note the original source it cites
    - Given (unverified): evidence that needs care, because who gave it isn't recorded or it is in doubt. Rate conservatively, as if the control or fact were only partly evidenced, and raise a clarification question where it drives a rating
    - Assumed: an assumption from an earlier assessment, not evidence. Record it in §2.7 and mark it (assumed, AS-nn) in tables
- Business and threat context: facts people gave about the environment; use them as evidence for threat likelihood and motivation
- Unknowns: gaps, not assumptions. Raise a clarification question for each one that could change a rating; where you have to assume something to rate a risk, record the assumption in §2.7
- Inconsistencies: disagreements between earlier sources. Don't resolve them silently: record which version you use and why in §2.7 or the rating rationale, and raise a clarification question where the choice affects a rating
- Its item counts and any IDs in its Source citations belong to the earlier assessment; assign your own IDs
- Don't modify the description, or the earlier assessment files it cites

### Tools and data handling

- Tools: read, search and write files; web search and fetch
- No shell commands
- Use the web only for public threat intelligence and vulnerability information (e.g., CVEs), and public standards and guidance (e.g., PCI DSS, CIS Benchmarks, OWASP)
- Never send details of the subject to external services

### Self-check before finishing

- No [placeholder] text or template guidance left, in the TRA or the clarifications file
- Every risk in the risk register (§8) appears in the treatment plan (§9)
- Residual counts in §10 match §9
- Executive summary counts match §8
- Every open question in Appendix B appears in the clarifications file, and the reverse
- For a summarizer system description: no Assumed item is cited as evidence, and every Inconsistency is recorded with the version used
- Every threat-activity claim in a likelihood rationale cites a source
- Risks that share an event give it the same likelihood, or the rationale explains why not
- Every shared event is in the Shared events table, and every SE- ID cited exists there
- Every AS- ID cited exists in §2.7
- Every submission that was Pending at the start has its answers copied into the clarifications file and its Status set to Used in TRA version X.Y

## Final response

- Output file path and clarifications file path
- Overall residual risk rating
- Counts by rating, before and after treatment
- Top three risks, one line each
- Number of assumptions and open questions needing human input
- The answer submissions used, if any, and any conflicts they raised
- For a corrections re-assessment: how each reported gap was handled
