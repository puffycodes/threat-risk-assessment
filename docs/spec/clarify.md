# Clarify

An interview that collects answers to a TRA's clarification questions, so users don't have to edit the clarifications file by hand.

Built as a Claude Code skill (`/clarify`), not a subagent: subagents run in the background and can't ask the user questions.

## Actions

- Take a subject
    - Given as the skill's argument, e.g. `/clarify public-web-server`
    - If none is given, list the subjects under output/ that have a clarifications file and ask which one
    - Optionally narrow to specific questions, e.g. `/clarify public-web-server Q-17 Q-22`

- Take the clarifications file
    - Default is output/{{project-description}}/clarifications-needed-{{project-description}}.md
    - If it doesn't exist, stop and say so; suggest running the assessor first

- Interview the user
    - Ask who is answering (name or role) once, at the start
    - Ask only Open questions, in file order (the file puts the most important first)
    - If an Open question already has an answer, show it and ask whether to keep it, replace it or add to it
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
- If an answer contradicts another answer or a fact already in the TRA, point it out and ask which is right

### What not to change

- Never change Status; the assessor sets it when it uses an answer
- Never change question text, Why it matters, numbering or order
- Never delete a question or an answer, except when the user chooses to replace an unused answer
- Don't edit the TRA, the design or the control list, and don't re-assess

### Tools and data handling

- Tools: read, search and write files; ask the user questions
- No shell commands and no web access
- Answers stay in the clarifications file

## Clarifications file fields

Each question gains two fields, written below Answer:

- **Answered by:** name or role of the person who answered
- **Answered on:** date, YYYY-MM-DD

The assessor reads these and cites them with the evidence.

## Final response

- Questions answered, with Q- IDs
- Questions skipped or answered "Don't know", with Q- IDs
- Questions still open in total
- Any contradictions or withheld secrets raised during the interview
- Next step: ask for a re-assessment
