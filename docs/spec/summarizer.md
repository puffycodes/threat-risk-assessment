# Summarizer

## Purpose

- Summarize the assessment so far to generate a list of system information, including but not limited to the following:
    - System design
    - Controls
    - Data Flow
- Risk assessment should not be included.

## Requirements

- The file should be in a form that can be used by the assesser agent.
- All necessary information must be included.
- Clearly indicate whether the information are given or assumed.
- Do not add information that are not in the assessment.
- Create the summary under a new name on every run; never overwrite an earlier summary.
    - Use the name given by the user, if any
    - Otherwise, default to output/{{project-description}}/system-summary-{{project-description}}-v<version_number>.md, where the version starts at 0.1 and goes up by 0.1 on each run
