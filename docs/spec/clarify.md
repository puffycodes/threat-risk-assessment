# Clarify

An interview that collects answers to a TRA's clarification questions, so users don't have to edit the clarifications file by hand.

Built as a Claude Code skill (`/clarify`), not a subagent: subagents run in the background and can't ask the user questions.

## Actions

- Take a subject
    - Given as the skill's argument, e.g. `/clarify public-web-server`
    - Accept the slug or the subject's name; turn a name into its slug (e.g. `public web server` → `public-web-server`)
    - If none is given, use the only subject under output/ that has a clarifications file; if there are several, or the name matches none, list them and ask which one
    - Optionally narrow to specific questions, e.g. `/clarify public-web-server Q-17 Q-22`
    - Optionally review the browser's pending submissions instead of interviewing, e.g. `/clarify public-web-server --review-submissions` (see Reviewing submissions)

- Take the clarifications file
    - Default is output/{{project-description}}/clarifications-needed-{{project-description}}.md
    - If it doesn't exist, stop and say so; suggest running the assessor first
    - Also read the TRA, if it exists, but only to check answers for contradictions

- Take the pending submissions from the assessment browser
    - output/{{project-description}}/answers/answers-*.md with Status Pending, oldest first by their Submitted time stamp
    - Ignore submissions with Status Used or Withdrawn: their answers are already in the clarifications file or no longer count
    - Don't read draft.md, which nobody has submitted; if it exists, say so at the start, so two people don't answer the same questions without knowing

- Interview the user
    - Ask who is answering (name or role) once, at the start
    - Ask only Open questions, in file order (the file puts the most important first)
    - If an Open question already has an answer, show it and ask whether to keep it, replace it or add to it
    - If an Open question has an answer in a pending submission, show that answer, who gave it, when, and the submission file, and ask whether to:
        - Keep it: skip the question (the default)
        - Add to it: record the new answer as usual; the assessor uses both
        - Correct it: record the new answer with a note naming the submission it corrects
    - Do this for questions named in the arguments too
    - Ask up to four questions at a time, as multiple choice where sensible
    - The user can always give a free-text answer, skip a question, or stop

- Write the answers to the clarifications file
    - Write after each batch, so stopping part-way loses nothing
    - For each answered question, fill in Answer, Answered by and Answered on (today)
    - Bump the version once per interview and add a revision history row

- Finish with a summary and suggest a re-assessment

## Rules

### Asking questions

- Show the question and a one-line version of its Why it matters before asking it
- Split a question with several parts into one ask per part, then combine the parts into one answer
- Multiple-choice options:
    - Two to four realistic, neutral options that cover the common cases
    - Include a "Don't know" option
    - Never mark an option as recommended; the answer is a fact, not a choice
    - Free text is always available for anything the options don't cover
- Don't lead the user toward an answer that would lower a rating

### Recording answers

- Record the user's answer faithfully: the option they chose, plus any detail they added, in their words
- Don't add facts, interpretation or inferred answers
- "Don't know" or a skip leaves Answer blank; list these in the summary
- Don't record secrets: passwords, keys, tokens or full card numbers. Warn the user and record only that the item exists
- If an answer contradicts another answer, an answer in a pending submission, or a fact already in the TRA, point it out and ask which is right
- When the user corrects a pending answer, note it in the answer, e.g. "Corrects the pending answer in answers-20261008-150512.md", so the assessor knows which is later even when both are dated the same day

### What not to change

- Never change Status; the assessor sets it when it uses an answer
- Never change question text, Why it matters, numbering or order
- Never delete a question or an answer, except when the user chooses to replace an unused answer
- Don't edit the TRA, the design or the control list, and don't re-assess
- Never edit, withdraw or delete a submission file or the browser's draft; a submission is withdrawn only in the browser, and only the assessor marks it as used

### Tools and data handling

- Tools: read, search and write files; ask the user questions
- No shell commands and no web access
- Answers stay in the clarifications file

## Reviewing submissions

With `--review-submissions`, review the pending submissions instead of interviewing:

- Ask no questions and write nothing
- For each pending submission, oldest first, check its answers and report:
    - Answers that contradict each other, an answer in another pending submission, an answer in the clarifications file, or a fact in the TRA
    - Answers that seem to contain secrets: passwords, keys, tokens or full card numbers
    - Answers too vague to change a rating, e.g. "Apache" with no version, with the follow-up to ask
    - Answers to questions that are no longer Open or Answered in part
- For each point, suggest who should confirm it (name the role, e.g. System owner) and how: correct it with `/clarify`, or withdraw the submission in the browser
- If there are no pending submissions, say so and stop

## Clarifications file fields

The file's layout is in docs/templates/clarifications-template.md; keep it exactly. Each question gains two fields, written below Answer:

- **Answered by:** name or role of the person who answered
- **Answered on:** date, YYYY-MM-DD

The assessor reads these and cites them with the evidence.

## Final response

- Questions answered, with Q- IDs
- Questions skipped or answered "Don't know", with Q- IDs and a suggested role to ask
- Questions still open in total
- Any contradictions or withheld secrets raised during the interview
- Questions not asked because a pending submission answers them, with Q- IDs
- Pending answers the user added to or corrected, with Q- IDs and the submission file
- Contradictions found with pending answers
- With `--review-submissions`: the findings for each submission, in place of the interview items above
- Next step: ask for a re-assessment
