# Features for Agent-to-Skill Export

## Purpose

- Allow the three agents and the /clarify skill to be used in environments that support skills but not agents: Claude Code in another project, Cursor, GitHub Copilot, and any other host that follows the Agent Skills specification.
- Allow the built skills to be handed out as one archive per environment, with a version that traces back to a commit.
- This project keeps running the agents as agents; see "Agent vs Skill" in docs/design-considerations.md.

## Requirement

- Build the skills (tools/agent-to-skill/convert.py)
    - Build from .claude/agents/assessor.md, designer.md, summarizer.md and .claude/skills/clarify/SKILL.md
    - Never change the sources
    - Build one target, or all of them: claude-code, cursor, copilot and generic
    - Write each target to dist/<target>/, under the folder its environment loads skills from:
        - claude-code: .claude/skills/
        - cursor: .cursor/skills/
        - copilot: .github/skills/
        - generic: skills/
    - Write one folder per skill, with a SKILL.md and copies of the process and template files it reads, so the other project needs nothing from docs/
    - Give each target a README.md with the version, install notes, a quick start and what to know before relying on the skills
        - The quick start says how to start each skill in that environment
- Rewrite the text for each target
    - An agent's tools become the skill's allowed-tools
    - Paths into docs/ point to the copies in the skill's folder
    - Links between copied files point to the copies; a link to a file that isn't copied is dropped, keeping its text
    - "the assessor agent" becomes "the assessor skill", and the same for the other agents
    - Add a "How this skill runs" note listing what the skill may do, and that it must never send details of the subject to external services
    - For cursor, copilot and generic:
        - Keep only the frontmatter fields the environment documents
        - Replace Claude Code tool names and dialog features with plain wording
    - For generic only:
        - Add the specification's compatibility field, and the version and source commit in its metadata field
        - Replace the /clarify slash command with "the clarify skill"
        - Allow a host that reaches files only through a shell to use it for file work, but never to install software or reach the network
    - Every exact rewrite must match its source once; if the source wording has changed, stop and name the rule to update
- Check every built skill, and stop if one fails
    - No path into docs/, no reference to an agent or subagent, and, for the target's kind, no Claude Code tool name, slash command or host name left in a skill or a file it copies
    - Every file a skill names was copied, and no link leads outside the skill's folder
    - A failed build leaves the previous build in place
- Version every build
    - Take the version from git: the nearest skills-v* tag, or a version counting the commits since it, or the short commit if there's no tag
    - Count only commits that change the sources: the agents, /clarify, the process, the templates and convert.py
    - Stamp the version in each SKILL.md and README.md, and in a manifest listing every file in every skill with its SHA-256
    - Refuse to build from sources with uncommitted changes, or without git, unless told to (--allow-dirty); mark that build -dirty or unknown
- Check installed skills (--check)
    - Compare the skills installed in a folder with a fresh build of one target, without touching dist/
    - Report each skill as current, out of date (with the installed version), edited after it was installed (with the files that differ) or not installed
    - Exit with 0 when every skill is current, 1 when one isn't, and 2 on an error
- Package the builds (tools/agent-to-skill/package.py)
    - Pack each target's build into dist/packages/tra-skills-<target>-<version>.zip, .tar.gz or both
    - Each archive holds one folder, tra-skills-<target>-<version>/, laid out as in dist/<target>/
    - Write a checksum for each archive to dist/packages/SHA256SUMS
    - Pack a build only when:
        - its files match its manifest exactly, with none missing or added
        - its version is the version the sources have now
        - it isn't -dirty or unknown, unless told to (--allow-dirty)
    - Check every target before writing any archive
    - Packing the same build twice gives the same bytes

## Constraint

- Use only the Python standard library (Python 3.9 or later), and git for the version.
- Never send anything over the network.
- Should not need to invoke any agents or skills.
