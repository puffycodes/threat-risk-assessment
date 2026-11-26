#!/usr/bin/env python3
"""Agent-to-skill converter for the TRA workspace.

Builds the three agents (.claude/agents/) and the /clarify skill
(.claude/skills/clarify/) as Agent Skills for environments that support only
skills: Claude Code in another project, Cursor and GitHub Copilot. The sources
are never changed; this project keeps running the agents as agents.

For each target it writes one folder per skill, with a SKILL.md and copies of
the process and template files the skill reads. The text is rewritten so that
paths point to those copies, other agents are called skills, and, for Cursor
and Copilot, Claude Code tool names and features are replaced with neutral
wording. Every exact rewrite must match its source once; if an agent's wording
has changed, the script stops and names the rule to update. The output is then
checked, and the script fails rather than leave a half-converted skill.

See "Agent vs Skill" in docs/design-considerations.md for the reasoning.
Uses only the Python standard library.

    python tools/agent-to-skill/convert.py [--target all|claude-code|cursor|copilot] [--out dist]
"""

import argparse
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MARKER = ".generated-by-agent-to-skill"

SOURCES = [
    ".claude/agents/assessor.md",
    ".claude/agents/designer.md",
    ".claude/agents/summarizer.md",
    ".claude/skills/clarify/SKILL.md",
]

TARGETS = {
    "claude-code": {"skills_dir": ".claude/skills", "label": "Claude Code", "neutral": False},
    "cursor": {"skills_dir": ".cursor/skills", "label": "Cursor", "neutral": True},
    "copilot": {"skills_dir": ".github/skills", "label": "GitHub Copilot", "neutral": True},
}

# Frontmatter kept for each target. Claude Code reads its own extensions; the
# others get only the fields of the Agent Skills specification that every
# environment accepts. allowed-tools is left out there: tool names differ, and
# the field only pre-approves tools, so prompting for each tool is safer.
FRONTMATTER_KEYS = {
    False: ["name", "description", "allowed-tools", "model", "argument-hint"],
    True: ["name", "description"],
}

# Plain-language phrases for the tools an agent may use, in the order listed.
TOOL_PHRASES = {
    "Read": "read files",
    "Glob": "search for files",
    "Grep": "search for files",
    "Write": "write and edit files",
    "Edit": "write and edit files",
    "WebSearch": "search the web and read public web pages",
    "WebFetch": "search the web and read public web pages",
    "AskUserQuestion": "ask the user questions",
}

# Exact rewrites for Cursor and Copilot, by source skill name. Each old text
# must occur exactly once in the source.
NEUTRAL_REWRITES = {
    "assessor": [
        ("For a codebase or configuration, use Glob and Grep to find",
         "For a codebase or configuration, search the files and their contents to find"),
        ("Use WebSearch or WebFetch only for public threat intelligence",
         "Use web search, or read web pages, only for public threat intelligence"),
        ("Write creates the `output/{{project-description}}/` folder if it doesn't exist.",
         "Create the `output/{{project-description}}/` folder if it doesn't exist."),
        ("- Use Glob to find the submissions and read each one.",
         "- Find the submissions by searching for files that match that pattern, and read each one."),
    ],
    "designer": [
        ("Use WebSearch or WebFetch to confirm requirement numbers if you're unsure.",
         "Search the web to confirm requirement numbers if you're unsure."),
    ],
    "summarizer": [
        ("- Find the earlier summaries for the subject with Glob: `output/",
         "- Find the earlier summaries for the subject by searching for files that match `output/"),
    ],
    "clarify": [
        ("Arguments: `$ARGUMENTS`",
         "Arguments: what the user wrote after the skill's name, or in the request that started this skill."),
        ("- If no subject is given, use Glob for `output/*/clarifications-needed-*.md`.",
         "- If no subject is given, search for files that match `output/*/clarifications-needed-*.md`."),
        ("Use Glob for `output/<slug>/answers/answers-*.md` and read each file.",
         "Search for files that match `output/<slug>/answers/answers-*.md` and read each one."),
        ("If Glob finds it, tell the user",
         "If the search finds it, tell the user"),
        ("Then ask, with AskUserQuestion, whether to:",
         "Then ask whether to:"),
        ('Ask once, with AskUserQuestion: "Who is answering these questions?"',
         'Ask once: "Who is answering these questions?"'),
        ("Use AskUserQuestion, with **up to four questions per call**.\n\n"
         "Before each call, show the questions in that batch as text. For each one, give its ID and title, "
         "the full question, and a one-line version of its \"Why it matters\".",
         "Ask **one question at a time**, in the chat.\n\n"
         "For each one, show its ID and title, the full question, and a one-line version of its "
         "\"Why it matters\". Then list the options, numbered, and say the user can reply with a number "
         "or in their own words."),
        ("plus `Don't know` (it counts toward the limit of four). The user can always type their own answer "
         "with \"Other\".",
         "plus `Don't know`. The user can always reply in their own words instead."),
        ("- **Use the header chip** to show the question ID, such as `Q-20`.\n",
         ""),
        ("- **Free-text questions** (versions, names, numbers) still need two options. Offer `Don't know` and "
         "`Skip for now`, and say the real answer goes in \"Other\".",
         "- **Free-text questions** (versions, names, numbers): ask for the answer in the user's own words, "
         "and offer `Don't know` and `Skip for now`."),
        ("After **each** batch, write the answers to the file with Edit, so stopping part-way loses nothing.",
         "After **each** answer, write it to the file, so stopping part-way loses nothing."),
        ("**Ask no questions and write nothing**: no Edit or Write.",
         "**Ask no questions and write nothing**: don't change any file."),
    ],
}

# Text that must not survive in a built SKILL.md: (pattern, reason, neutral targets only).
FORBIDDEN = [
    (r"`docs/", "a path into this project's docs/ folder", False),
    (r"\b(assessor|designer|summarizer) agent\b", "a reference to an agent", False),
    (r"\bsubagent\b", "a reference to a subagent", False),
    (r"\b(Glob|Grep|WebSearch|WebFetch|AskUserQuestion)\b", "a Claude Code tool name", True),
    (r"\$ARGUMENTS", "Claude Code argument substitution", True),
    (r"\bwith (Edit|Write)\b|\bEdit or Write\b|\bWrite creates\b", "a Claude Code tool name", True),
    (r"header chip|\"Other\"|per call\b", "a Claude Code dialog feature", True),
]


class ConvertError(Exception):
    pass


def parse_frontmatter(text, source):
    lines = text.split("\n")
    if not lines or lines[0].strip() != "---":
        raise ConvertError(f"{source}: no frontmatter")
    try:
        end = next(i for i in range(1, len(lines)) if lines[i].strip() == "---")
    except StopIteration:
        raise ConvertError(f"{source}: frontmatter is not closed")
    fields = {}
    for line in lines[1:end]:
        if not line.strip():
            continue
        m = re.match(r"^([A-Za-z][\w-]*):\s?(.*)$", line)
        if not m:
            raise ConvertError(f"{source}: can't read frontmatter line {line!r} (only one-line fields are supported)")
        fields[m.group(1)] = m.group(2).strip()
    body = "\n".join(lines[end + 1:]).lstrip("\n")
    return fields, body


def yaml_value(value):
    if re.search(r":\s|\s#|^[\"'{&*!|>%@`]", value):
        return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'
    return value


def split_tools(value):
    return [t.strip() for t in value.split(",") if t.strip()]


def apply_exact(text, rules, source):
    for old, new in rules:
        count = text.count(old)
        if count != 1:
            first = old.split("\n")[0][:70]
            raise ConvertError(
                f"{source}: rewrite rule starting {first!r} matches {count} times, not once. "
                "The source wording has changed; update NEUTRAL_REWRITES in tools/agent-to-skill/convert.py.")
        text = text.replace(old, new)
    return text


def bundled_path(doc_path):
    """Map a docs/ path to its place in the skill folder."""
    rel = doc_path[len("docs/"):]
    if rel.startswith("templates/"):
        return rel
    return "references/" + rel


def how_it_runs(tools, has_files, source):
    phrases = []
    for tool in tools:
        phrase = TOOL_PHRASES.get(tool)
        if phrase is None:
            raise ConvertError(f"{source}: no plain-language phrase for tool {tool!r}; add it to TOOL_PHRASES")
        if phrase not in phrases:
            phrases.append(phrase)
    lines = [
        f"<!-- Generated by tools/agent-to-skill/convert.py from {source}. Don't edit this file: "
        "change the source and run the script again. -->",
        "",
        "## How this skill runs",
        "",
    ]
    if has_files:
        lines.append("- Paths that start `references/` or `templates/` are files in this skill's own folder, "
                     "next to this SKILL.md. Every other path, such as `output/...` and `scenario/...`, "
                     "is relative to the root folder of the project you are working in.")
    lines.append("- Use only tools that:")
    lines.extend(f"  - {phrase}" for phrase in phrases)
    lines.append("- Don't run shell commands, scripts or programs, and don't use any other tool, even if one "
                 "is available.")
    lines.append("- Never send details of the subject to external services.")
    return "\n".join(lines) + "\n"


def build_skill(source, target_name, target, out_skills):
    src_path = ROOT / source
    text = src_path.read_text(encoding="utf-8").replace("\r\n", "\n")
    fields, body = parse_frontmatter(text, source)
    name = fields.get("name", "")
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", name) or len(name) > 64:
        raise ConvertError(f"{source}: name {name!r} isn't lowercase letters, digits and hyphens (max 64)")
    if not fields.get("description"):
        raise ConvertError(f"{source}: no description")
    neutral = target["neutral"]
    is_agent = source.startswith(".claude/agents/")

    # Tools: an agent's `tools` becomes a skill's `allowed-tools`.
    tools = split_tools(fields.get("tools") or fields.get("allowed-tools") or "")
    if is_agent:
        fields.pop("tools", None)
        fields["allowed-tools"] = ", ".join(tools)

    if neutral:
        body = apply_exact(body, NEUTRAL_REWRITES.get(name, []), source)

    # Copy the docs/ files the skill reads, and point the text at the copies.
    skill_dir = out_skills / name
    doc_paths = sorted(set(re.findall(r"`(docs/[\w./-]+\.md)`", body)))
    for doc in doc_paths:
        src_doc = ROOT / doc
        if not src_doc.is_file():
            raise ConvertError(f"{source}: names {doc}, which doesn't exist")
        dest = skill_dir / bundled_path(doc)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(src_doc.read_text(encoding="utf-8").replace("\r\n", "\n"), encoding="utf-8", newline="\n")
        body = body.replace(f"`{doc}`", f"`{bundled_path(doc)}`")

    # Other agents become skills.
    rename = lambda s: re.sub(r"\b(assessor|designer|summarizer) agent\b", r"\1 skill", s)
    body = rename(body)
    fields["description"] = rename(fields["description"])
    if len(fields["description"]) > 1024:
        raise ConvertError(f"{source}: description is over 1024 characters")

    # Insert "How this skill runs" after the title, or at the top if there's none.
    note = how_it_runs(tools, bool(doc_paths), source)
    if body.startswith("# "):
        title, _, rest = body.partition("\n")
        body = title + "\n\n" + note + "\n" + rest.lstrip("\n")
    else:
        body = note + "\n" + body

    keys = FRONTMATTER_KEYS[neutral]
    front = ["---"] + [f"{k}: {yaml_value(fields[k])}" for k in keys if fields.get(k)] + ["---"]
    skill_text = "\n".join(front) + "\n\n" + body.rstrip("\n") + "\n"

    check(skill_text, skill_dir, source, target_name, neutral)
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "SKILL.md").write_text(skill_text, encoding="utf-8", newline="\n")
    return name, doc_paths


def check(skill_text, skill_dir, source, target_name, neutral):
    problems = []
    for n, line in enumerate(skill_text.split("\n"), 1):
        if line.startswith("<!-- Generated by"):
            continue
        for pattern, reason, neutral_only in FORBIDDEN:
            if neutral_only and not neutral:
                continue
            m = re.search(pattern, line)
            if m:
                problems.append(f"  line {n}: {reason}: {m.group(0)!r}")
    for ref in sorted(set(re.findall(r"`((?:references|templates)/[\w./-]+\.md)`", skill_text))):
        if not (skill_dir / ref).is_file():
            problems.append(f"  {ref} is named but wasn't copied")
    if problems:
        raise ConvertError(f"{source} ({target_name}): the built skill still has:\n" + "\n".join(problems)
                           + "\nAdd a rewrite rule in tools/agent-to-skill/convert.py.")


def readme(target, skills):
    d = target["skills_dir"]
    listed = "\n".join(f"- `{d}/{name}/`" + (f": also holds {', '.join(f'`{bundled_path(p)}`' for p in docs)}"
                                               if docs else "") for name, docs in skills)
    return f"""# TRA skills for {target['label']}

Generated by `tools/agent-to-skill/convert.py` in the threat-risk-assessment workspace. Don't edit these
files: change the agents or `/clarify` there, and run the script again.

## Install

Copy the folders under `{d}/` into the `{d}/` folder of the project where you'll run the assessments:

{listed}

The skills read their subjects from `scenario/<subject>/` and write to `output/<subject>/`, relative to that
project's root folder.

## Before you rely on them

- **No tool limit.** As agents, these ran with a fixed set of tools. As skills, they run in the main conversation
  with every tool the environment has. Each skill tells the model to use only file tools (and web search, where
  the agent allowed it), and never to send details of the subject to external services, but nothing enforces it.
- **The model matters.** The procedures need exact work: scores, consistent IDs and an exact file layout. Use a
  capable model, and check the self-check results.
- **Test once.** Run the assessor on one subject and compare the output with the original workspace's.
- **Not included:** the assessment browser. Its answer files (`output/<subject>/answers/`) are still read if present.
"""


def main():
    ap = argparse.ArgumentParser(description="Build the TRA agents and /clarify as Agent Skills.")
    ap.add_argument("--target", choices=["all", *TARGETS], default="all")
    ap.add_argument("--out", default="dist", help="output folder, relative to the repository root (default: dist)")
    args = ap.parse_args()

    out_root = (ROOT / args.out).resolve()
    names = list(TARGETS) if args.target == "all" else [args.target]
    try:
        for target_name in names:
            target = TARGETS[target_name]
            out = out_root / target_name
            if out.exists() and not (out / MARKER).is_file():
                raise ConvertError(f"{out} exists and wasn't made by this script; remove it or choose another --out")
            # Build in a temporary folder, and replace the old build only when every skill passes.
            tmp = out_root / f".{target_name}.tmp"
            if tmp.exists():
                shutil.rmtree(tmp)
            out_skills = tmp / target["skills_dir"]
            out_skills.mkdir(parents=True)
            try:
                built = [build_skill(source, target_name, target, out_skills) for source in SOURCES]
            except ConvertError:
                shutil.rmtree(tmp)
                raise
            (tmp / "README.md").write_text(readme(target, built), encoding="utf-8", newline="\n")
            (tmp / MARKER).write_text("Made by tools/agent-to-skill/convert.py. Rebuilt on every run.\n",
                                      encoding="utf-8")
            if out.exists():
                shutil.rmtree(out)
            tmp.rename(out)
            print(f"{target_name}: {len(built)} skills in {out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}")
    except ConvertError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
