# Features for Data Flow Diagram

## Purpose

- Show how data moves between people, the agents and skill, the files on disk and the assessment browser, and which flows leave the machine.
- Give the workspace's own TRA-style view of itself: what holds subject data, who can reach it, and what protects it.

## Requirement

- Generate one page, docs/project-data-flow.html, from tools/data-flow-diagram/generate.py and tools/data-flow-diagram/template.html
    - The generator holds the diagram: its nodes, trust boundaries and numbered flows
    - The template holds the rest of the page: the legend, the flow register and the trust boundary notes
    - Write the page to another path when asked (--out)
- Draw the diagram as inline SVG, with:
    - External entities: the analyst, the answerer (who has no Claude Code), the Anthropic API and the public web
    - Processes: each agent and skill, the assessment browser's server, and the browser page
    - Data stores, numbered D1, D2 and so on: the process and templates, each subject's description, and each kind of document in output/<subject>/, including the answer drafts and submissions
    - Trust boundaries: the Internet, the Claude Code session, the workspace files on local disk, and the assessment browser
    - Numbered flows, with arrows showing the direction, two-way where data goes both ways
    - Flows that cross the Internet boundary marked out from the rest
- Place each flow's number where it doesn't overlap a node, another number or another line
    - Warn when a number can't be placed clear of the rest
- List every numbered flow in a flow register, grouped by process, with:
    - From and to
    - The data that moves
    - Notes and the controls that exist today
    - Flows that leave the machine marked as such
- Keep the flow numbers in the diagram and the register the same
- Describe each trust boundary: what crosses it, and what protects it or doesn't
- Leave out the export of the agents as skills (tools/agent-to-skill/, dist/, and other projects and hosts)
- Work on a phone-sized screen, in light and dark themes
    - The diagram scrolls sideways rather than shrinking past reading size

## Constraint

- Use only the Python standard library.
- The page must open from disk in a web browser, with no server.
- Load nothing from the Internet except the page's web fonts, and read well without them.
- Should not need to invoke any agents or skills.
