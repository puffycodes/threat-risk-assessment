# Submission of Clarifications

## Purpose

- Allow a user to answer clarification questions in the assessment browser, and submit the answers for the next re-assessment.
- Part of the assessment browser; see features.md.

## Workflow

- Link from an "Answer clarification questions" option on each subject's Questions page.
- Ask who is answering (name or role) at the start of a session.
    - Required before submitting; it is recorded as Answered by for every answer in the submission.
- Show the list of clarification questions that are Open, in file order (the file puts the most important first).
    - Answered in part questions are not offered: the assessor adds an Open follow-up question for what is missing.
    - For each question, show the question, its Why it matters text, and any answer already given in the clarifications file or in a pending submission, so the user doesn't answer it twice by mistake.
- For each question, allow the user to:
    - Write a free-text answer
    - Mark it "Don't know"
    - Skip it
    - Edit any answer given in this session, until the session is submitted.
- Save the answers.
    - Save the session (who is answering, and the answers so far) as a draft, so the user can close the browser and later load and continue.
    - Save automatically as the user types, and also when they choose Save.
    - One draft per subject: output/{{project-description}}/answers/draft.md
- Submit the answers.
    - Before submitting, show a summary: questions answered, marked "Don't know", and skipped.
    - Write the submission as a new file: output/{{project-description}}/answers/answers-<YYYYMMDD-HHMMSS>.md
        - Never overwrite a file; if the name is taken, add a suffix (-2, -3 and so on).
    - Time stamp the submission in local time with the UTC offset, for example 2026-10-08T15:05:12+08:00.
    - Clear the draft after a successful submission, so the user starts a new session with no answers.
- Withdraw a submission.
    - A pending submission can be withdrawn from the browser before a re-assessment uses it.
    - Withdrawing sets its Status to Withdrawn; the file is kept as a record.

## Submission file format

- Header table:
    - Status: Pending, Used in TRA version X.Y (set by the assessor), or Withdrawn
    - Submitted: the time stamp
    - Answered by: name or role
    - Clarifications file: file name and the version the answers were given against
- One section per answered question, headed `### Q-NN: <short title>`, with:
    - **Question:** the question text as it was shown
    - **Answer:** the user's answer, in their words
- A list of the questions marked "Don't know", with no answer, so the assessor can suggest someone else to ask.
- Skipped questions are not listed.

## Rules

- Record answers as the user wrote them; don't add, change or interpret anything.
- Secrets:
    - Warn the user if an answer seems to contain a password, key or token, and suggest recording only that the item exists.
    - Don't accept an answer that contains what looks like a full card number.
- Questions that change before submission:
    - If the clarifications file has changed since the session started, show which of the session's questions changed, or are no longer Open, and let the user review them before submitting.
- Contradictions:
    - The browser doesn't check answers for contradictions, because it uses no agent. The assessor checks them when it uses the submission, including two pending submissions that answer the same question differently.

## Security

- The browser writes only to output/{{project-description}}/answers/, and only for a subject that has a clarifications file.
- Accept saves, submissions and withdrawals only from the browser's own page, so another website open in the same browser can't send answers.
- Limit the size of an answer and of a submission.
- Like every other output file, the answers stay out of git (output/ is git-ignored).

## Constraints

- Should not need to invoke any agents or skills.
- Should not modify the clarifications file, or any other document of the threat risk assessment; write only the draft and submission files described above.
