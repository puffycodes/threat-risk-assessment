# Design Considerations

Decisions about how this workspace is built, and the findings behind them. Each topic records the question, what was found, and what was decided or recommended, so the same ground doesn't have to be covered again.

## Contents

- [Agent vs Skill](#agent-vs-skill)

---

## Agent vs Skill

**Question:** Should an agent, chiefly the assessor, also exist as a skill, with the agent calling the skill?

**Checked:** 2026-11-26, against Claude Code 2.1.332. The fields below were confirmed by searching the installed `claude.exe` for their schema descriptions and the code that handles them. Neither design has been run yet.

**Status:** Not built. A short test run is needed before relying on either design.

### How things stand

The three agents (`assessor`, `designer`, `summarizer`) are subagents in `.claude/agents/`. Each holds its whole procedure in its body. Each is built from its spec in `docs/spec/`, and runs in its own context with a fixed tool list. `/clarify` is the only skill, in `.claude/skills/clarify/SKILL.md`.

Running each agent as a subagent matters for two reasons:

- **Tool limit.** The agent's `tools` list, such as `Read, Glob, Grep, Write, Edit, WebSearch, WebFetch` for the assessor, is a hard limit. It supports the rule that details of the subject are never sent to external services. The agent has no Bash or PowerShell, for example.
- **Context.** An assessment reads the process file, the templates, the existing TRA, the clarifications, the answer submissions and all the evidence. In its own context, none of that fills up the main conversation.

### Fields confirmed in 2.1.332

| Where | Field | What it does |
|---|---|---|
| Agent | `skills` | "Array of skill names to preload into the agent context." The skill's full text is loaded when the agent starts. |
| Skill | `context` | `inline` or `fork`. "`inline` expands into the current conversation; `fork` spawns a subagent." |
| Skill | `agent` | "Agent type to spawn when `context: fork`." |
| Skill | `background` | Only for `context: fork`. A forked skill runs in the background by default and reports back when it finishes. `false` makes it wait for the result. |
| Skill | `disable-model-invocation` | Hides the skill from Claude, so Claude never picks it on its own, but `/name` still works. |
| Skill | `allowed-tools` | Pre-approves tools. **It doesn't limit the skill to them** (see below). |
| Skill | `disallowed-tools` | "Tools removed from the model while this file is active… Cleared when the user sends the next message." |
| Skill | `model`, `effort`, `argument-hint` | As their names say. |

An agent can also call a skill while it runs, if `Skill` is in its `tools`. Loading the skill with `skills:` is more reliable, because the agent doesn't have to remember to call it.

### Tool limits: agent vs skill

| | What decides the tools | Does it limit them? |
|---|---|---|
| Agent | `tools` in the agent's frontmatter | Yes: the agent has only those tools, for the whole run. |
| Skill, `allowed-tools` | Added to the session's allow rules | No: the tools run without prompts, but every other tool in the session is still available. |
| Skill, `disallowed-tools` | Added to the session's deny rules | Yes, but only until the user sends their next message. |

A skill running in the main conversation therefore can't match an agent's tool limit. `disallowed-tools` gets close for one run, but the limit stops as soon as the user replies.

### Designs

**A. The agent loads the skill (what was asked about).**

- `.claude/skills/assess/SKILL.md` holds the whole procedure. It runs inline, with `disable-model-invocation: true` and `disallowed-tools` listing the tools the assessor shouldn't have.
- `.claude/agents/assessor.md` keeps its frontmatter (`name`, `description`, `tools`, `model`), adds `skills: [assess]`, and its body says only "Follow the assess skill."

Gains:
- `/assess <subject>` can run in the main conversation, where you can watch it, and go straight on to `/clarify` in the same session.
- One copy of the procedure, shared by the agent and the slash command.
- Other agents could load the same rules, such as the ID schemes, instead of repeating them.

Costs and risks:
- In the main conversation, the tool limit is weaker (see above). The data flow diagram would need a flow for the new path.
- An assessment fills up the main conversation quickly.
- If the skill could be picked by Claude, the agent and the skill would both match "perform a TRA". `disable-model-invocation: true` avoids that.
- `docs/spec/assessor.md` would produce two files. The README (layout, "Running the agents", "Changing the agents") and `tools/data-flow-diagram/` would need updating.
- The procedure's "Final response" section is a report for whoever called the agent. In the main conversation, a different ending suits better.

**B. The skill starts the agent (the other way round).**

- `.claude/skills/assess/SKILL.md` is a few lines, with `context: fork`, `agent: assessor` and `background: false`, and passes its arguments on as the request.
- `.claude/agents/assessor.md` stays as it is.

Gains: `/assess <subject>` works as a slash command, the agent keeps its tool limit and its own context, and nothing is copied or moved.

Cost: there's no way to run the assessment in the main conversation. Given the rule against sending subject details out, that's probably an advantage.

**Don't combine them.** If the skill has `context: fork` + `agent: assessor` and the assessor also has `skills: [assess]`, the two point at each other. Pick one design.

### Recommendation

- **Assessor:** use design B if the goal is a slash command. Use design A only if running in the main conversation is really wanted, and accept the weaker tool limit. In that case, set `disable-model-invocation: true` and `disallowed-tools`.
- **Designer and summarizer:** neither is worth it. No one needs to run them in the main conversation, and both pin `model: sonnet`, which a skill would have to repeat.

### Before building either design

1. Test-run it on one subject and check that the outputs match a run of the agent as it is.
2. Update the spec in `docs/spec/`, the README and the data flow diagram, as "Changing the agents" in the README describes.
3. After a Claude Code upgrade, check these fields again. They change between versions.
