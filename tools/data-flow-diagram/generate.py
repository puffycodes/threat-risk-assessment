#!/usr/bin/env python3
"""Data flow diagram generator for the TRA workspace.

Lays out the diagram's nodes, trust boundaries and numbered flows, draws them
as inline SVG, and writes the page from template.html, which holds the
legend, the flow register and the trust boundary notes. Edit the nodes and
edges below, and the register in the template, whenever a flow changes.
Uses only the Python standard library.

    python tools/data-flow-diagram/generate.py [--out docs/project-data-flow.html]
"""

import argparse
import html
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE = Path(__file__).resolve().parent / "template.html"

W, H = 1240, 880
nodes = {}

def node(id, kind, cx, cy, w, h, label, sub=None, tag=None):
    nodes[id] = dict(kind=kind, cx=cx, cy=cy, w=w, h=h, label=label, sub=sub, tag=tag)

# External entities
node("analyst", "ext", 80, 450, 120, 64, "Analyst", "Claude Code user")
node("anthropic", "ext", 262, 45, 140, 50, "Anthropic API", "model inference")
node("web", "ext", 420, 45, 150, 50, "Public web", "CVEs, threat intel")
node("answerer", "ext", 1060, 830, 170, 50, "Answerer", "no Claude Code")
# Processes
node("assessor", "proc", 340, 220, 180, 46, "assessor", "agent")
node("clarify", "proc", 340, 400, 180, 46, "/clarify", "skill")
node("designer", "proc", 340, 570, 180, 46, "designer", "agent · Sonnet")
node("summarizer", "proc", 340, 730, 180, 46, "summarizer", "agent · Sonnet")
node("serve", "proc", 1060, 340, 200, 46, "serve.py", "local HTTP server")
node("page", "proc", 1060, 600, 200, 46, "browser page", "app.js")
# Data stores
node("docs", "store", 700, 160, 210, 40, "process + templates", "docs/", "D1")
node("scenario", "store", 700, 240, 210, 40, "description.md", "scenario/<s>/", "D2")
node("tra", "store", 700, 320, 210, 40, "TRA", "output/<s>/", "D3")
node("clar", "store", 700, 400, 210, 40, "clarifications", "output/<s>/", "D4")
node("answers", "store", 700, 490, 210, 40, "draft + submissions", "output/<s>/answers/", "D5")
node("design", "store", 700, 610, 210, 40, "design + controls", "output/<s>/", "D6")
node("summary", "store", 700, 730, 210, 40, "system summary v<n>", "output/<s>/", "D7")

boundaries = [
    # x, y, w, h, label
    (172, 108, 336, 700, "Claude Code session"),
    (562, 108, 290, 752, "Workspace files (local disk)"),
    (930, 280, 270, 420, "Assessment browser · 127.0.0.1:8765"),
]

def rect(n, pad=0):
    return (n["cx"] - n["w"] / 2 - pad, n["cy"] - n["h"] / 2 - pad,
            n["cx"] + n["w"] / 2 + pad, n["cy"] + n["h"] / 2 + pad)

def clip(n, tx, ty, oy=0):
    cx, cy = n["cx"], n["cy"] + oy
    dx, dy = tx - cx, ty - cy
    s = min((n["w"] / 2) / abs(dx) if dx else 1e9, (n["h"] / 2 - abs(oy)) / abs(dy) if dy else 1e9)
    return cx + dx * s, cy + dy * s

edges = []
def edge(num, a=None, b=None, bidir=False, pts=None, accent=False, dashed=False, oa=0, ob=0, badge=True):
    if pts is None:
        na, nb = nodes[a], nodes[b]
        def port(n, o, other):
            if {n["kind"], other["kind"]} == {"proc", "store"}:
                x = n["cx"] + n["w"] / 2 if n["cx"] < other["cx"] else n["cx"] - n["w"] / 2
                return (x, n["cy"] + o)
            return None
        p1 = port(na, oa, nb) or clip(na, nb["cx"], nb["cy"] + ob, oa)
        p2 = port(nb, ob, na) or clip(nb, na["cx"], na["cy"] + oa, ob)
        pts = [p1, p2]
    edges.append(dict(num=num, pts=pts, bidir=bidir, accent=accent, dashed=dashed, badge=badge))

# Analyst
edge(1, pts=[(80, 418), (80, 100), (540, 100), (540, 240), (595, 240)])
edge(2, pts=[(140, 470), (172, 470)], bidir=True)
edge(15, "analyst", "clarify", bidir=True, oa=-14)
# Boundary-level internet flows
edge(3, pts=[(262, 108), (262, 70)], bidir=True, accent=True)
edge(4, pts=[(420, 108), (420, 70)], bidir=True, accent=True)
# assessor
edge(5, "docs", "assessor", ob=-14)
edge(6, "scenario", "assessor", ob=-4)
edge(7, "assessor", "tra", oa=6)
edge(8, "assessor", "clar", bidir=True, oa=14)
edge(9, "answers", "assessor", bidir=True, ob=18)
# designer
edge(5, "docs", "designer", ob=-16)
edge(10, "tra", "designer", ob=-6)
edge(10, "clar", "designer", ob=4)
edge(11, "designer", "design", oa=12)
# summarizer
edge(12, "tra", "summarizer", ob=-16)
edge(12, "clar", "summarizer", ob=-6)
edge(13, "summarizer", "summary", oa=6)
edge(14, pts=[(805, 730), (836, 730), (836, 250), (805, 250)], dashed=True)
# /clarify
edge(16, "clarify", "clar", bidir=True)
edge(17, "tra", "clarify", ob=-12)
edge(17, "answers", "clarify", ob=12)
# browser
edge(18, pts=[(852, 330), (960, 330)])
edge(19, pts=[(1025, 363), (1025, 577)])
edge(20, pts=[(1095, 577), (1095, 363)])
edge(21, pts=[(960, 352), (900, 352), (900, 490), (805, 490)])
edge(22, "answerer", "page", bidir=True)

# ---------- badge placement ----------
def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)

def in_rect(px, py, r):
    return r[0] <= px <= r[2] and r[1] <= py <= r[3]

placed = []
for i, e in enumerate(edges):
    pts = e["pts"]
    segs = sorted(range(len(pts) - 1), key=lambda k: -math.dist(pts[k], pts[k + 1]))
    best = None
    for k in segs[:2]:
        (ax, ay), (bx, by) = pts[k], pts[k + 1]
        for t in (.5, .42, .58, .34, .66, .26, .74, .2, .8):
            px, py = ax + (bx - ax) * t, ay + (by - ay) * t
            score = abs(t - .5) * 4 + (k != segs[0]) * 2
            for n in nodes.values():
                if in_rect(px, py, rect(n, 11)):
                    score += 100
            for q in placed:
                d = math.dist((px, py), q)
                if d < 24:
                    score += 100 - d
            for j, f in enumerate(edges):
                if j == i:
                    continue
                for m in range(len(f["pts"]) - 1):
                    d = seg_dist(px, py, *f["pts"][m], *f["pts"][m + 1])
                    if d < 11:
                        score += (11 - d) * 3
            if best is None or score < best[0]:
                best = (score, px, py)
    e["badge_at"] = best[1:]
    placed.append(best[1:])
    if best[0] > 20:
        print("crowded badge", e["num"], best, file=sys.stderr)

# ---------- render ----------
out = []
A = out.append
esc = html.escape
A(f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Data flow diagram: the analyst and four Claude Code processes read and write Markdown files on local disk; only the Claude Code session talks to the internet; the assessment browser reads the same files and writes only answer drafts and submissions.">')
A('<defs>')
for mid, col in (("ar", "var(--fg)"), ("ara", "var(--accent)"), ("arm", "var(--muted)")):
    A(f'<marker id="{mid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:{col}"/></marker>')
A('</defs>')

# internet line
A('<line x1="172" y1="90" x2="508" y2="90" style="stroke:var(--accent)" stroke-width="1.5" stroke-dasharray="2 4"/>')
A('<text x="508" y="84" text-anchor="end" class="bl acc">INTERNET</text>')

for x, y, w, h, label in boundaries:
    A(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="none" style="stroke:var(--muted)" stroke-width="1.2" stroke-dasharray="6 5"/>')
    A(f'<text x="{x + 12}" y="{y + 18}" class="bl">{esc(label.upper())}</text>')

for e in edges:
    col = "var(--accent)" if e["accent"] else ("var(--muted)" if e["dashed"] else "var(--fg)")
    mk = "ara" if e["accent"] else ("arm" if e["dashed"] else "ar")
    d = " ".join(f"{x:.1f},{y:.1f}" for x, y in e["pts"])
    extra = ' stroke-dasharray="5 4"' if e["dashed"] else ""
    start = f' marker-start="url(#{mk})"' if e["bidir"] else ""
    A(f'<polyline points="{d}" fill="none" style="stroke:{col}" stroke-width="{1.6 if e["accent"] else 1.1}" stroke-opacity="{1 if e["accent"] else .7}"{extra}{start} marker-end="url(#{mk})"/>')

for id, n in nodes.items():
    x0, y0, x1, y1 = rect(n)
    w, h = n["w"], n["h"]
    cx, cy = n["cx"], n["cy"]
    if n["kind"] == "ext":
        A(f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" class="ext"/>')
        A(f'<text x="{cx}" y="{cy - 3}" text-anchor="middle" class="nl">{esc(n["label"])}</text>')
        A(f'<text x="{cx}" y="{cy + 13}" text-anchor="middle" class="ns">{esc(n["sub"])}</text>')
    elif n["kind"] == "proc":
        A(f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" rx="{h / 2}" class="proc"/>')
        A(f'<text x="{cx}" y="{cy - 2}" text-anchor="middle" class="nl">{esc(n["label"])}</text>')
        A(f'<text x="{cx}" y="{cy + 13}" text-anchor="middle" class="ns">{esc(n["sub"])}</text>')
    else:
        A(f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" class="storebg"/>')
        A(f'<path d="M{x1},{y0} H{x0} V{y1} H{x1} M{x0 + 34},{y0} V{y1}" class="store"/>')
        A(f'<text x="{x0 + 17}" y="{cy + 4}" text-anchor="middle" class="sid">{n["tag"]}</text>')
        A(f'<text x="{x0 + 44}" y="{cy - 3}" class="nl">{esc(n["label"])}</text>')
        A(f'<text x="{x0 + 44}" y="{cy + 12}" class="ns mono">{esc(n["sub"])}</text>')

for e in edges:
    if not e["badge"]:
        continue
    x, y = e["badge_at"]
    cls = "badge acc" if e["accent"] else "badge"
    A(f'<g class="{cls}"><circle cx="{x:.1f}" cy="{y:.1f}" r="9.5"/><text x="{x:.1f}" y="{y + 3.8:.1f}" text-anchor="middle">{e["num"]}</text></g>')

A('</svg>')
svg = "\n".join(out)

parser = argparse.ArgumentParser(description="Generate the workspace data flow diagram.")
parser.add_argument("--out", type=Path, default=ROOT / "docs" / "project-data-flow.html",
                    help="page to write (default docs/project-data-flow.html)")
args = parser.parse_args()
page = TEMPLATE.read_text(encoding="utf-8").replace("<!--SVG-->", svg)
with open(args.out, "w", encoding="utf-8", newline="\n") as f:
    f.write(page)
print(f"Wrote {args.out}")
