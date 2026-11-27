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

### Exporting the agents as skills for other environments

**Question:** Can a script convert the three agents, and `/clarify`, into skills for environments that support only skills, such as Claude Code in another project, Cursor and GitHub Copilot, while this project keeps running them as agents?

**Checked:** 2026-11-26, against the Cursor and GitHub documentation and the Agent Skills specification (sources below). Nothing has been built or tested in Cursor or Copilot yet.

**Status:** Built as `tools/agent-to-skill/convert.py` (see "Exporting the agents as skills" in the README), to the recommended design below. Two additions: each skill gets a "How this skill runs" note listing the tools it may use and repeating the rule against sending subject details out, and a failed build leaves the previous one in place. Since then, the checks also cover the process and template files a skill copies, and the links between them (see the dry run under [A generic build](#a-generic-build-with-no-environment-in-mind)). The built skills haven't been test-run in any of the three environments yet.

#### Where the environments agree

All three use the open Agent Skills format: a folder holding a `SKILL.md`, with `name` and `description` in its frontmatter and optional files beside it.

| Environment | Where project skills go | Notes |
|---|---|---|
| Claude Code | `.claude/skills/` | Reads every field in "Fields confirmed in 2.1.332" above. |
| Cursor | `.cursor/skills/` | Also loads `.claude/skills/` and `.codex/skills/`. A skill can be started by typing `/` and its name. |
| GitHub Copilot | `.github/skills/` | Used by the cloud agent, the Copilot CLI and agent mode in VS Code. One GitHub page still called VS Code stable support "coming soon". `allowed-tools` only skips confirmations, and GitHub advises against pre-approving `shell`. |
| Agent Skills specification | | Defines only `name`, `description`, `license`, `compatibility`, `metadata` and an experimental `allowed-tools`. Some tools reject frontmatter keys they don't know. |

#### What breaks outside Claude Code

| Issue | Where it is | Claude Code | Cursor / Copilot | What a script would do |
|---|---|---|---|---|
| **Claude Code-only frontmatter**: `model`, `argument-hint`, `context` | `model: sonnet` (designer, summarizer), `argument-hint` (clarify) | Works | Ignored, or rejected | Keep them for Claude Code. Remove them for the others. |
| **Tool names in `allowed-tools`** | All four | `Read, Glob, …` | Different names (Copilot uses names like `shell`), and the list only pre-approves tools | Map them, or remove the field. |
| **Tool names in the text**: "Use Glob", "Use AskUserQuestion", WebSearch/WebFetch | All four | Works | These tools don't exist there | Replace them with neutral wording ("search for files matching…", "ask the user"). Fail if a tool name it doesn't know is left in. |
| **`$ARGUMENTS`** | `/clarify` | Filled in with what the user typed | Left as the literal text | Replace it with "the subject and question IDs the user gave". |
| **Asking questions in a dialog**: up to four per call, with options, via `AskUserQuestion` | `/clarify`, built around it | Works | No equivalent dialog | Ask in plain chat, one question at a time. It works, but it's slower and less structured. |
| **Files under `docs/`**: the process and four templates | Assessor, designer, clarify | | | Copy them into each skill's folder and rewrite the paths. |
| **The working folders**: `output/<slug>/`, `scenario/` | All four | Works | Works in the IDEs, which have a project folder. In Copilot's cloud agent, they're folders in the repository. | Unchanged. |
| **Names of the other agents**: "the summarizer agent", "the assessor agent" | Assessor, summarizer | | | Fixed list of replacements, changing "agent" to "skill". |

#### Risks a script can't remove

1. **No tool limit, anywhere.** In all three environments, the skill runs in the main conversation with whatever tools that environment has. The rule that details of the subject are never sent to external services would rest on the instructions alone. That's the biggest change from running as agents, and it needs stating wherever the skills are used.
2. **Which model runs them.** The procedures need exact work: Likelihood × Impact arithmetic, consistent IDs, counts that match, and an exact layout, because `/clarify` and the assessment browser parse the file. In Cursor or Copilot, the user's chosen model runs them. A weaker model will drift, and the self-check steps help but don't guarantee the result.
3. **Context.** Without a separate subagent context, an assessment fills the chat quickly, especially in IDEs with smaller context windows.
4. **Keeping step with the agents.** The text rewrites rely on the agents' current wording. When an agent changes, the script must fail loudly rather than build a half-converted skill.

#### How each environment would do

| Environment | How well it would work |
|---|---|
| Claude Code, another project | **Fully.** Same frontmatter and tools. Only the tool limit and the separate context are lost. |
| Cursor | **Works, with reduced protections.** The assessor, designer and summarizer run, though output quality depends on the model. `/clarify` falls back to asking in plain chat. |
| GitHub Copilot (CLI, VS Code agent mode) | **Same as Cursor.** It's the least predictable of the three, because the cloud agent works in a repository rather than a local folder. |

#### Recommended design

- **A new tool, `tools/agent-to-skill/convert.py`.** Python 3 with the standard library only, like `tools/data-flow-diagram/generate.py`.
- **Source.** It reads `.claude/agents/*.md` and `.claude/skills/clarify/SKILL.md`, and changes neither. This project keeps running the agents exactly as it does now.
- **One build per environment:** `dist/claude-code/.claude/skills/`, `dist/cursor/.cursor/skills/`, and `dist/copilot/.github/skills/`. Each holds `assessor`, `designer`, `summarizer` and `clarify`, with the process and templates copied into each skill that needs them. Cursor can also read the Claude Code build, but that build carries Claude Code tool names Cursor doesn't have, so a separate neutral build is cleaner.
- **Checks.** It fails if any build still has a Claude Code tool name, `$ARGUMENTS` or a `docs/` path, or if a copied file is missing.
- **Testing.** Before relying on a build, run it once in each environment on one subject, such as `public-web-server`, and compare the output with this project's.
- **When the agents change.** Run the script again, and update the README for the new environments. The data flow diagram (`docs/project-data-flow.html`) leaves the export out on purpose (decided 2026-11-27).

#### Sources

- [Cursor – Agent Skills](https://cursor.com/docs/skills)
- [GitHub Docs – Adding agent skills for Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills)
- [GitHub Docs – Adding agent skills for Copilot cloud agent](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills)
- [Microsoft Learn – Copilot agent skills in Visual Studio](https://learn.microsoft.com/en-us/visualstudio/ide/copilot-agent-skills)
- [Agent Skills specification](https://agentskills.io/specification.md)

### A generic build, with no environment in mind

**Question:** Can the converter also build a generic version of the skills, with no dependency on any one environment?

**Checked:** 2026-11-26, against the output of `tools/agent-to-skill/convert.py` and the assessment browser's code.

**Status:** Built as the `generic` target of `tools/agent-to-skill/convert.py`, writing to `dist/generic/skills/`, with the changes below. The `cursor` and `copilot` targets are unchanged and still use `/clarify`. The generic build has had one dry run, described below, but hasn't been test-run on any host other than Claude Code.

#### What the current builds show

- **The Cursor and Copilot builds are already nearly generic.** Their skill folders are identical (`diff -r` finds no differences); only the folder they're placed in differs. Both keep only `name` and `description` in the frontmatter, and use plain wording in place of Claude Code tool names.
- **The `/clarify` slash command is the only host-specific wording left.** It appears 3 times in the assessor and 3 times in clarify (once in its description), including the `(via /clarify)` note clarify writes into the revision history.
- **The assessment browser only displays that text.** It mentions `/clarify` in messages (`tools/assessment-browser/serve.py`, `static/app.js`) but never parses it, so the wording can change without breaking the browser.

#### What a generic target would change

| Change | Why |
|---|---|
| Write to `dist/generic/skills/<name>/`, with no environment's folder around it | The user copies the folders into wherever the host looks: `.cursor/skills/`, `.github/skills/`, `.claude/skills/` or a host's upload form. |
| Add the specification's `compatibility` field (max 500 characters), for example *"Needs a project folder it can read and write. Web search is optional."* | It's the standard way for a skill to state what it needs. The Cursor and Copilot builds leave it out because their docs don't list it, but a generic build should follow the specification exactly. |
| Replace `/clarify` with "the clarify skill", including in the revision history note | How a skill is started varies, and some hosts choose skills only from their description. |
| Reword the "How this skill runs" note to describe what the skill does, not which tools it uses | The current note forbids shell commands. That would block hosts where file access goes through a shell (see below). |

The converter's checks would also fail if `/clarify`, or a tool name from any host, is left in a generic skill.

#### What a generic skill still depends on

These are things the host must be able to do, not dependencies on a particular product. No conversion can remove them.

1. **A project folder it can read and write.** Every skill reads `scenario/` or `output/` and writes to `output/<subject>/`. A host with no file access, such as a plain chat, can't run them.
2. **Hosts where file access goes through a shell.** In the Claude API and claude.ai, a skill reads and writes files by running commands in a sandbox. The current note's "Don't run shell commands" would stop it working there. The generic note would instead say: use whatever the host provides only to read, search and write files in the project folder, and never use it to fetch from or send to the network. That's looser than the current note, and still relies on the instructions alone.
3. **A conversation with the user, for clarify.** Every host has one, and the neutral clarify already asks one question at a time in the chat.
4. **Web search, for the assessor and designer.** It's optional. Both work without it, with less to cite.
5. **A capable model.** As for the other builds, the exact scoring and layout depend on it.

#### Recommendation

- **Add a `generic` target** to `convert.py`, with the changes above.
- **Keep the `cursor` and `copilot` targets** for convenience: they put the same content in the right folder, so installing stays a single copy. They could take the `/clarify` change too, so the three neutral builds differ only in where they're placed and in the `compatibility` field.
- **Keep the `claude-code` target separate.** It's the only one that keeps `model`, `argument-hint`, `allowed-tools` and the question dialog.

#### Dry run of the generic build

**Run:** 2026-11-26. The generic skills were installed in `tmp/generic-test/`, a scratch project that git ignores, with the `public-web-server` scenario. Claude Code followed each `SKILL.md` as written, reading only the skill's own folder.

**What it shows, and what it doesn't.** The skill folders are complete and self-contained, and their procedures can be carried out to the end. It doesn't show how another host finds, starts or follows a skill. The run was in Claude Code, by a model that already knew the original agents, so it leans toward success.

| Step | Result |
|---|---|
| Specification check | All four skills have valid frontmatter, names that match their folders, and every file they name |
| Assessor, first assessment | TRA v0.1 and clarifications v0.1 passed the self-check, and the assessment browser's parser read them as it reads this project's output |
| Designer and summarizer, first run | Both passed their self-checks |
| Clarify, review mode | Caught the three problems planted in a test submission (a vague answer, a password and a contradiction) and changed no file |
| Clarify, interview | Asked one question at a time in the chat, split a three-part question, saved after each answer and stopped cleanly on "stop" |
| Assessor, re-assessment | Used the interview answers and the pending submission, recorded the SSH contradiction as an assumption rather than settle it, and passed the self-check |
| Designer and summarizer, update | The designer kept its IDs stable and retired one control; the summarizer wrote a new version and left the earlier one unchanged |

**Problems found, and fixed:**

- **Copied templates still named `/clarify`.** The converter rewrote it in each `SKILL.md` but not in the files a skill copies. The generic target now rewrites the copied clarifications template too, and the checks cover copied files.
- **Copied templates had broken links.** Their links pointed at places in `docs/` that the skill folders don't have. The converter now points each link at the copy, or drops a link to a file the skill doesn't copy, and fails the build on a link that leads outside the skill's folder. This affected every target, not only generic.
- **The assessor had no rule for secrets.** It copied submitted answers exactly, so a password typed in the assessment browser would have reached the clarifications file and the TRA. The assessor now withholds the value, records the disclosure as a vulnerability, and recommends changing the secret and withdrawing the submission. This was a gap in the agent itself, so the fix applies to the agents too.

**Still to do:** a test run on a host other than Claude Code, such as Cursor or GitHub Copilot.

### Versioning the exported skills

**Question:** Once the skills are copied into another project, how do you tell which version they are, whether they are current, and whether anyone has edited them?

**Decided:** 2026-11-26. Built into `tools/agent-to-skill/convert.py` (see "Versions of the exported skills" in the README).

| Option | Decision | Why |
|---|---|---|
| Stamp each build with a version taken from git | **Done** | Needs no version kept by hand. The stamp goes in each `SKILL.md`'s "Generated by" comment, which every host keeps, and for generic also in the specification's `metadata` field. Cursor and Copilot don't document `metadata`, so their builds leave it out, as they do `compatibility`. |
| A manifest of every file's SHA-256, with `--check` against an installed copy | **Done** | Tells current, out of date and locally edited copies apart. `--check` builds in a temporary folder, so it never touches `dist/`. |
| Release tags, `skills-v<major>.<minor>.<patch>` | **Convention** | Tagging is a human decision; the script only reads the tags. |
| Refuse to build from uncommitted sources, unless `--allow-dirty` is passed | **Done** (added 2026-11-27) | A warning alone was easy to miss, so a `-dirty` build could be handed out by mistake, and nobody could rebuild it later. Building without git is refused the same way, since its version is unknown. `--check` isn't refused: it writes nothing anyone could hand out. |
| One archive per target, made by `tools/agent-to-skill/package.py` | **Done** (added 2026-11-27) | Hands a whole build over as one file, with a checksum in `SHA256SUMS`. It packs a build only when the files match the manifest, the version is the sources' current one, and the build isn't `-dirty` or `unknown` (unless `--allow-dirty`), so a stale or edited build can't go out by mistake. The archives are reproducible. They hold all four skills, so they aren't for a host's upload form, which takes one skill per zip. |
| A version number edited by hand in a file | Not done | Easy to forget to bump; git already knows. |
| Committing `dist/` to `main` | Not done | Two copies of everything, and noisy diffs; a build can always be made again. |
| A separate version for each skill | Not done | They share templates and are installed together, so one version for the set is simpler. |

**Only the sources count.** The first version came from `git describe` of `HEAD`, so a commit to the README alone changed the version in every `SKILL.md`, and `--check` called every installed copy out of date though nothing in it had changed. The version now comes from the last commit that changed the sources: the agents, `/clarify`, the process, the templates and `convert.py`. A tag still counts when it is on a later commit, as long as the sources haven't changed since it. This was tested in a scratch clone: no tag, a tag, a README-only commit, a tag on a later commit, a template commit and an uncommitted template edit.

**Limit.** `--check` can't tell a locally edited copy of an old version from an unedited one, since it only has the current build to compare with. It reports the copy as out of date, and says so.
