---
name: clarify
description: Interview the user to answer a threat risk assessment's open clarification questions, and write the answers into the clarifications file. Also reviews answers submitted from the assessment browser. Use when the user wants to answer, fill in or go through clarification questions for a TRA subject, review pending answer submissions, or types /clarify. Takes the subject slug, optionally followed by question IDs or --review-submissions.
argument-hint: <subject> [Q-NN ...] [--review-submissions]
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion
---

# Clarify: interview for TRA clarification questions

You are running an interview. Your job is to get the user's answers to the open questions in a TRA clarifications file, and write them into that file accurately, so the user never has to edit the file by hand.

Arguments: `$ARGUMENTS`

## 1. Find the file

- Arguments that look like question IDs, such as `Q-17 Q-22`, limit the interview to those questions. `--review-submissions` switches to review mode (step 7) instead of an interview. The rest of the arguments name the subject.
- The subject can be a slug, such as `public-web-server`, or a name. Turn a name into a slug: lowercase, with spaces replaced by hyphens, so `public web server` becomes `public-web-server`.
- If no subject is given, use Glob for `output/*/clarifications-needed-*.md`. If there is exactly one, use it. If there are several, or the subject matches none of them, list them and ask the user which one.
- The file is `output/<slug>/clarifications-needed-<slug>.md`. If it doesn't exist, stop and tell the user to run the assessor first.
- Read the whole file. Note its version, and each question's ID, title, question text, Why it matters, Status and Answer. Its layout is defined in `docs/templates/clarifications-template.md`; write answers in exactly that layout, because the assessor and the assessment browser parse it.
- If the TRA exists (`output/<slug>/threat-risk-assessment-<slug>.md`), read it too, but only to check answers for contradictions (step 5). Never edit it.
- **Pending submissions.** People can also answer in the assessment browser. Use Glob for `output/<slug>/answers/answers-*.md` and read each file. Its header table has Status, Submitted (a time stamp), Answered by and the clarifications file version; each answer is under a `### Q-NN: <title>` heading, with `- **Question:**` and `- **Answer:**`; questions marked "Don't know" are listed under `## Don't know`.
  - Use only submissions whose Status is `Pending`, oldest first by Submitted. Ignore `Used in TRA version X.Y` and `Withdrawn`: their answers are already in the clarifications file or no longer count.
  - Don't read `output/<slug>/answers/draft.md`; nobody has submitted it. If Glob finds it, tell the user at the start that someone has unsubmitted answers in the browser, so two people don't answer the same questions without knowing.
- With `--review-submissions`, go to step 7 now.

## 2. Plan the interview

- Select the questions whose **Status is `Open`**, in file order. The file already puts the most important first. If the user named question IDs, keep only those.
- If an `Open` question already has an answer that the assessor hasn't used yet, show the answer, then ask whether to keep it, replace it or add to it.
- If an `Open` question has an answer in a pending submission, show that answer, who gave it, when, and the submission file. Then ask, with AskUserQuestion, whether to:
  - **Keep it** (the first option): skip the question.
  - **Add to it**: ask the question as usual and record the new answer; the assessor uses both.
  - **Correct it**: ask the question as usual and record the new answer with a note (step 5).
  Do this for questions named in the arguments too. Questions where the user keeps the pending answer aren't asked.
- Tell the user, in one line, how many questions there are, and that they can skip any question or stop at any time.

## 3. Ask who is answering

Ask once, with AskUserQuestion: "Who is answering these questions?" Offer up to three roles that fit the questions, such as `System owner`, `Security`, `Business owner`. The user can also type a name or another role. Record the reply exactly as **Answered by**.

## 4. Ask the questions

Use AskUserQuestion, with **up to four questions per call**.

Before each call, show the questions in that batch as text. For each one, give its ID and title, the full question, and a one-line version of its "Why it matters".

For each question:
- **Split multi-part questions.** If a question has several parts, as Q-17 does (fields collected, where card data is entered, whether it is stored, which provider), ask each part as its own item, then combine the replies into one answer.
- **Write good options.** Give two to four realistic, neutral options that cover the common cases, plus `Don't know` (it counts toward the limit of four). The user can always type their own answer with "Other".
  - Example for "Are critical vulnerabilities patched outside the six-month cycle?": `No, only in the six-month cycle` / `Yes, within a month` / `Yes, within a week or less` / `Don't know`.
- **Stay neutral.** Never mark an option as recommended. Never suggest an answer, or steer the user toward one that would lower a rating.
- **Use the header chip** to show the question ID, such as `Q-20`.
- **Free-text questions** (versions, names, numbers) still need two options. Offer `Don't know` and `Skip for now`, and say the real answer goes in "Other".
- **Stopping.** If the user types "stop" in any reply, stop asking, write what you have, and go to step 6.

## 5. Record the answers

After **each** batch, write the answers to the file with Edit, so stopping part-way loses nothing.

**What to record.** For each answered question, replace the empty `- **Answer:**` line with the user's answer:
- Use the option they chose, plus any detail they added, in their words.
- Combine the parts of a split question into one answer, for example: "Card number, expiry and security code are entered on the application's own page. Not stored. Provider: (as given)."
- Don't add interpretation, inferred facts or your own wording of what they "meant".

**Answer metadata.** Directly below the Answer line, add:
```
- **Answered by:** <reply from step 3>
- **Answered on:** <today, YYYY-MM-DD>
```

**Skipped questions.** `Don't know`, `Skip for now` or no reply leaves the Answer blank, with no metadata.

**Secrets.** If an answer contains a password, private key, API token or full card number, don't write it. Tell the user it was left out, and record only that the item exists, such as "A database password exists (value withheld)".

**Corrections to pending answers.** When the user chose **Correct it**, end the answer with a note naming the submission, for example: "Corrects the pending answer in answers-20261008-150512.md." The assessor then uses this answer instead, even when both are dated the same day.

**Contradictions.** If an answer contradicts another answer in the file, an answer in a pending submission, or a fact stated in the file or the TRA, quote both and ask which is right before writing.

**Version bump.** Bump the file's version once per interview, at the first write. Add a revision history row: `| <new version> | <today> | Answers added to Q-.., Q-.. by <Answered by> (via /clarify). |`. Update the row's list of questions if more are answered later in the same interview.

**Never:**
- change **Status**; the assessor sets it when it uses an answer
- change question titles, question text, Why it matters, numbering or order
- delete any question or answer, except an unused answer the user chose to replace
- edit the TRA, the security design or the control list, or re-assess anything
- edit, withdraw or delete a submission file or the browser's draft. A submission is withdrawn only in the browser, and only the assessor marks it as used.

## 6. Finish

Reply with:
- the questions answered (IDs)
- the questions skipped or answered "Don't know" (IDs), with a suggested role to ask for each
- the number of questions still open
- any contradictions or withheld secrets that came up
- the questions not asked because a pending submission answers them (IDs)
- the pending answers the user added to or corrected (IDs, with the submission file)
- any contradictions found with pending answers
- the next step, for example: "Ask for a re-assessment of scenario/<slug> to use these answers."

## 7. Review submissions (`--review-submissions`)

Review the pending submissions instead of interviewing. **Ask no questions and write nothing**: no Edit or Write.

- If there are no pending submissions, say so and stop.
- For each pending submission, oldest first, check every answer and report:
  - **Contradictions**: with another answer in the same submission, an answer in another pending submission, an answer in the clarifications file, or a fact in the TRA. Quote both.
  - **Possible secrets**: passwords, keys, tokens or full card numbers. Name the question; don't repeat the value.
  - **Vague answers**: too vague to change a rating, such as "Apache" with no version. Give the follow-up to ask.
  - **Questions no longer open**: answers to questions that are now `Answered`, or not `Open` or `Answered in part`.
- For each finding, suggest who should confirm it (a role, such as System owner) and how: correct it with `/clarify <slug> Q-NN`, or withdraw the submission in the assessment browser and submit again.
- Finish with, for each submission: its file, who answered, when, the number of answers and "Don't know" questions, and its findings, or "No issues found". End with the next step, for example: "Ask for a re-assessment of scenario/<slug> to use these answers."
