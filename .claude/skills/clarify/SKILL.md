---
name: clarify
description: Interview the user to answer a threat risk assessment's open clarification questions, and write the answers into the clarifications file. Use when the user wants to answer, fill in or go through clarification questions for a TRA subject, or types /clarify. Takes the subject slug, optionally followed by question IDs.
argument-hint: <subject> [Q-NN ...]
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion
---

# Clarify: interview for TRA clarification questions

You are running an interview. Your job is to get the user's answers to the open questions in a TRA clarifications file, and write them into that file accurately, so the user never has to edit the file by hand.

Arguments: `$ARGUMENTS`

## 1. Find the file

- Arguments that look like question IDs, such as `Q-17 Q-22`, limit the interview to those questions. The rest of the arguments name the subject.
- The subject can be a slug, such as `public-web-server`, or a name. Turn a name into a slug: lowercase, with spaces replaced by hyphens, so `public web server` becomes `public-web-server`.
- If no subject is given, use Glob for `output/*/clarifications-needed-*.md`. If there is exactly one, use it. If there are several, or the subject matches none of them, list them and ask the user which one.
- The file is `output/<slug>/clarifications-needed-<slug>.md`. If it doesn't exist, stop and tell the user to run the assessor first.
- Read the whole file. Note its version, and each question's ID, title, question text, Why it matters, Status and Answer.
- If the TRA exists (`output/<slug>/threat-risk-assessment-<slug>.md`), read it too, but only to check answers for contradictions (step 5). Never edit it.

## 2. Plan the interview

- Select the questions whose **Status is `Open`**, in file order. The file already puts the most important first. If the user named question IDs, keep only those.
- If an `Open` question already has an answer that the assessor hasn't used yet, show the answer, then ask whether to keep it, replace it or add to it.
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

**Contradictions.** If an answer contradicts another answer in the file, or a fact stated in the file or the TRA, quote both and ask which is right before writing.

**Version bump.** Bump the file's version once per interview, at the first write. Add a revision history row: `| <new version> | <today> | Answers added to Q-.., Q-.. by <Answered by> (via /clarify). |`. Update the row's list of questions if more are answered later in the same interview.

**Never:**
- change **Status**; the assessor sets it when it uses an answer
- change question titles, question text, Why it matters, numbering or order
- delete any question or answer, except an unused answer the user chose to replace
- edit the TRA, the security design or the control list, or re-assess anything

## 6. Finish

Reply with:
- the questions answered (IDs)
- the questions skipped or answered "Don't know" (IDs), with a suggested role to ask for each
- the number of questions still open
- any contradictions or withheld secrets that came up
- the next step, for example: "Ask for a re-assessment of scenario/<slug> to use these answers."
