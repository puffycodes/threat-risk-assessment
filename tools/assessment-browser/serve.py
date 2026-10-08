#!/usr/bin/env python3
"""Assessment browser: a local, read-only web server for the TRA workspace.

Serves the documents in scenario/<subject>/ and output/<subject>/ to a
single-page browser app. Uses only the Python standard library, never writes
anything, and listens on 127.0.0.1 only, because the documents can describe
real systems.

    python tools/assessment-browser/serve.py [--port 8765] [--no-open]
"""

import argparse
import http.server
import json
import re
import sys
import threading
import urllib.parse
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STATIC = Path(__file__).resolve().parent / "static"
CONTENT_DIRS = ("scenario", "output")

STATIC_FILES = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/style.css": ("style.css", "text/css; charset=utf-8"),
}

# Order in which document kinds are listed for a subject.
KIND_ORDER = ["scenario", "tra", "clarifications", "design", "controls", "summary", "other"]

KINDS = [
    ("tra", re.compile(r"^threat-risk-assessment-.+\.md$"), "Threat risk assessment"),
    ("clarifications", re.compile(r"^clarifications-needed-.+\.md$"), "Clarifications"),
    ("design", re.compile(r"^security-design-.+\.md$"), "Security design"),
    ("controls", re.compile(r"^security-controls-.+\.md$"), "Security controls"),
    ("summary", re.compile(r"^system-summary-.+-v(?P<ver>\d+(?:\.\d+)*)\.md$"), "System summary v{ver}"),
]

CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
    "connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
)


def classify(directory, name):
    """Return (kind, label, version) for a document file name."""
    if directory == "scenario":
        label = "Scenario" if name == "description.md" else f"Scenario: {name[:-3]}"
        return "scenario", label, None
    for kind, pattern, label in KINDS:
        m = pattern.match(name)
        if m:
            ver = m.groupdict().get("ver")
            return kind, label.format(ver=ver), ver
    return "other", name[:-3], None


def version_key(ver):
    return tuple(int(p) for p in ver.split(".")) if ver else ()


def build_index():
    subjects = {}
    for directory in CONTENT_DIRS:
        base = ROOT / directory
        if not base.is_dir():
            continue
        for subject_dir in sorted(p for p in base.iterdir() if p.is_dir()):
            docs = subjects.setdefault(subject_dir.name, [])
            for f in sorted(subject_dir.glob("*.md")):
                if not f.is_file():
                    continue
                kind, label, ver = classify(directory, f.name)
                stat = f.stat()
                docs.append({
                    "id": f"scenario-{f.name}" if directory == "scenario" else f.name,
                    "path": f"{directory}/{subject_dir.name}/{f.name}",
                    "name": f.name,
                    "kind": kind,
                    "label": label,
                    "version": ver,
                    "mtime": stat.st_mtime,
                    "size": stat.st_size,
                })
    result = []
    for slug in sorted(subjects):
        docs = subjects[slug]
        # Newest summary first; otherwise by kind, then name.
        docs.sort(key=lambda d: (KIND_ORDER.index(d["kind"]),
                                 tuple(-n for n in version_key(d["version"])),
                                 d["name"]))
        result.append({"slug": slug, "docs": docs})
    return {"root": ROOT.name, "subjects": result}


def resolve_doc(rel):
    """Map a relative path from the client to a file, or None if not allowed."""
    parts = rel.replace("\\", "/").split("/")
    if len(parts) < 3 or parts[0] not in CONTENT_DIRS or not rel.endswith(".md"):
        return None
    if any(p in ("", ".", "..") for p in parts):
        return None
    base = (ROOT / parts[0]).resolve()
    target = (ROOT / rel).resolve()
    if base not in target.parents or not target.is_file():
        return None
    return target


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "AssessmentBrowser/1.0"

    def log_message(self, fmt, *args):
        if self.server.verbose:
            super().log_message(fmt, *args)

    def send_body(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", CSP)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def not_found(self):
        self.send_body(404, b"Not found", "text/plain; charset=utf-8")

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        url = urllib.parse.urlsplit(self.path)
        if url.path in STATIC_FILES:
            name, ctype = STATIC_FILES[url.path]
            self.send_body(200, (STATIC / name).read_bytes(), ctype)
        elif url.path == "/api/index":
            body = json.dumps(build_index()).encode("utf-8")
            self.send_body(200, body, "application/json; charset=utf-8")
        elif url.path == "/api/doc":
            rel = urllib.parse.parse_qs(url.query).get("path", [""])[0]
            target = resolve_doc(rel)
            if target is None:
                self.not_found()
                return
            self.send_body(200, target.read_bytes(), "text/plain; charset=utf-8")
        else:
            self.not_found()


def main():
    parser = argparse.ArgumentParser(description="Browse the threat risk assessments in a web browser.")
    parser.add_argument("--port", type=int, default=8765, help="port to listen on (default 8765)")
    parser.add_argument("--no-open", action="store_true", help="don't open a browser window")
    parser.add_argument("--verbose", action="store_true", help="log every request")
    args = parser.parse_args()

    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    except OSError as e:
        sys.exit(f"Can't listen on 127.0.0.1:{args.port}: {e}. Try --port <other>.")
    server.verbose = args.verbose
    url = f"http://127.0.0.1:{args.port}/"
    print(f"Assessment browser: {url}  (reading {ROOT})")
    print("Press Ctrl+C to stop.")
    if not args.no_open:
        threading.Timer(0.5, webbrowser.open, [url]).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
