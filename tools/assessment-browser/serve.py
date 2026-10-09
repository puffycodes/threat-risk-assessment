#!/usr/bin/env python3
"""Assessment browser: a local web server for the TRA workspace.

Serves the documents in scenario/<subject>/ and output/<subject>/ to a
single-page browser app, and lets the user answer clarification questions.
Uses only the Python standard library and listens on 127.0.0.1 only, because
the documents can describe real systems.

The only files it writes are answer drafts and submissions, in
output/<subject>/answers/ (see docs/spec/assessment-browser/).

    python tools/assessment-browser/serve.py [--port 8765] [--no-open]
"""

import argparse
import datetime
import http.server
import json
import os
import re
import secrets
import sys
import threading
import urllib.parse
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STATIC = Path(__file__).resolve().parent / "static"
CONTENT_DIRS = ("scenario", "output")
ANSWERS_DIR = "answers"
DRAFT_NAME = "draft.md"

STATIC_FILES = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/style.css": ("style.css", "text/css; charset=utf-8"),
}

# Order in which document kinds are listed for a subject.
KIND_ORDER = ["scenario", "tra", "clarifications", "design", "controls", "summary", "submission", "other"]

KINDS = [
    ("tra", re.compile(r"^threat-risk-assessment-.+\.md$"), "Threat risk assessment"),
    ("clarifications", re.compile(r"^clarifications-needed-.+\.md$"), "Clarifications"),
    ("design", re.compile(r"^security-design-.+\.md$"), "Security design"),
    ("controls", re.compile(r"^security-controls-.+\.md$"), "Security controls"),
    ("summary", re.compile(r"^system-summary-.+-v(?P<ver>\d+(?:\.\d+)*)\.md$"), "System summary v{ver}"),
]

SUBMISSION_RE = re.compile(r"^answers-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(?:-(\d+))?\.md$")
STATUS_ROW_RE = re.compile(r"^(\|\s*Status\s*\|)([^|\r\n]*)(\|)", re.M)
SLUG_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$")
QID_RE = re.compile(r"^Q-\d{1,3}$")
CARD_RE = re.compile(r"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)")

# Limits on what the browser can write.
MAX_BODY = 512 * 1024
MAX_ANSWER = 10_000
MAX_QUESTION = 5_000
MAX_LINE = 300
MAX_ITEMS = 300

TOKEN = secrets.token_urlsafe(24)  # changes on every start; the page reads it from index.html
WRITE_LOCK = threading.Lock()

CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
    "connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
)


class RequestError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


# ------------------------------------------------------------------ reading

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


def submission_status(path):
    try:
        m = STATUS_ROW_RE.search(path.read_text(encoding="utf-8", errors="replace"))
    except OSError:
        return ""
    return m.group(2).strip() if m else ""


def doc_entry(path, rel, doc_id, kind, label, ver):
    stat = path.stat()
    return {"id": doc_id, "path": rel, "name": path.name, "kind": kind, "label": label,
            "version": ver, "mtime": stat.st_mtime, "size": stat.st_size}


def build_index():
    subjects = {}
    for directory in CONTENT_DIRS:
        base = ROOT / directory
        if not base.is_dir():
            continue
        for subject_dir in sorted(p for p in base.iterdir() if p.is_dir()):
            slug = subject_dir.name
            subj = subjects.setdefault(slug, {"slug": slug, "docs": [], "draft": False})
            for f in sorted(subject_dir.glob("*.md")):
                if not f.is_file():
                    continue
                kind, label, ver = classify(directory, f.name)
                doc_id = f"scenario-{f.name}" if directory == "scenario" else f.name
                subj["docs"].append(doc_entry(f, f"{directory}/{slug}/{f.name}", doc_id, kind, label, ver))
            answers = subject_dir / ANSWERS_DIR
            if directory != "output" or not answers.is_dir():
                continue
            subj["draft"] = (answers / DRAFT_NAME).is_file()
            for f in sorted(answers.glob("answers-*.md")):
                m = SUBMISSION_RE.match(f.name)
                if not m or not f.is_file():
                    continue
                y, mo, d, h, mi, s, n = m.groups()
                label = f"Answers {y}-{mo}-{d} {h}:{mi}:{s}" + (f" ({n})" if n else "")
                entry = doc_entry(f, f"output/{slug}/{ANSWERS_DIR}/{f.name}", f.name, "submission", label, None)
                entry["status"] = submission_status(f)
                subj["docs"].append(entry)
    result = []
    for slug in sorted(subjects):
        subj = subjects[slug]
        # Newest summary first; submissions oldest first; otherwise by kind, then name.
        subj["docs"].sort(key=lambda d: (KIND_ORDER.index(d["kind"]),
                                         tuple(-n for n in version_key(d["version"])),
                                         d["name"]))
        result.append(subj)
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


# ------------------------------------------------------------------ writing

def subject_dir(slug):
    """The output folder of a subject that has a clarifications file, or an error."""
    if not isinstance(slug, str) or not SLUG_RE.match(slug):
        raise RequestError(400, "Unknown subject.")
    d = ROOT / "output" / slug
    if not (d / f"clarifications-needed-{slug}.md").is_file():
        raise RequestError(404, "This subject has no clarifications file.")
    return d


def luhn(digits):
    total = 0
    for i, ch in enumerate(reversed(digits)):
        n = int(ch)
        if i % 2:
            n = n * 2 - 9 if n > 4 else n * 2
        total += n
    return total % 10 == 0


def has_card_number(text):
    for m in CARD_RE.finditer(text):
        digits = re.sub(r"\D", "", m.group())
        if 13 <= len(digits) <= 19 and luhn(digits):
            return True
    return False


def text_field(value, name, limit, required=False, single_line=True):
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise RequestError(400, f"{name} must be text.")
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    if single_line:
        value = " ".join(value.split())
    value = value.strip()
    if len(value) > limit:
        raise RequestError(413, f"{name} is too long (limit {limit} characters).")
    if required and not value:
        raise RequestError(400, f"{name} is required.")
    if has_card_number(value):
        raise RequestError(400, f"{name} contains what looks like a full card number. Remove it.")
    return value


def cell(text):
    return text.replace("|", "\\|")


def answer_lines(text):
    """An answer as list-item continuation lines that can't be read as structure."""
    out = []
    for line in text.split("\n"):
        stripped = line.lstrip()
        if re.match(r"([#|>]|[-*+]\s|\d+[.)]\s|```|~~~)", stripped):
            line = line[: len(line) - len(stripped)] + "\\" + stripped
        out.append(line)
    return out


def write_atomic(path, text):
    tmp = path.with_name(f".{path.name}.{secrets.token_hex(4)}.tmp")
    with open(tmp, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    os.replace(tmp, path)


def remove(path):
    try:
        path.unlink()
    except FileNotFoundError:
        pass


def now_local():
    return datetime.datetime.now().astimezone().replace(microsecond=0)


def load_draft_file(path):
    """The draft file's contents, with "checkpoint" (the session as it was at the
    last Save click, or None), or None if there is no draft."""
    if not path.is_file():
        return None
    m = re.search(r"```json\n(.*)\n```\s*$", path.read_text(encoding="utf-8").replace("\r\n", "\n"), re.S)
    if not m:
        raise RequestError(500, f"The draft in {path.relative_to(ROOT).as_posix()} can't be read.")
    data = json.loads(m.group(1))
    if "checkpoint" not in data:
        # A draft written before checkpoints existed: treat all of it as saved.
        data["checkpoint"] = dict(data)
    return data



def clean_draft(draft):
    if not isinstance(draft, dict):
        raise RequestError(400, "The draft must be an object.")
    answers = draft.get("answers") or {}
    if not isinstance(answers, dict) or len(answers) > MAX_ITEMS:
        raise RequestError(400, "Too many answers in the draft.")
    clean = {}
    for qid, a in answers.items():
        if not QID_RE.match(str(qid)) or not isinstance(a, dict):
            raise RequestError(400, "The draft has an invalid answer.")
        state = a.get("state")
        if state not in ("answer", "dontknow"):
            raise RequestError(400, "The draft has an invalid answer state.")
        clean[qid] = {
            "state": state,
            "text": text_field(a.get("text"), f"The answer to {qid}", MAX_ANSWER, single_line=False),
            "q": text_field(a.get("q"), f"The question text of {qid}", MAX_QUESTION),
        }
    return {
        "answeredBy": text_field(draft.get("answeredBy"), "Who is answering", MAX_LINE),
        "clarVersion": text_field(draft.get("clarVersion"), "The clarifications version", 40),
        "answers": clean,
        "savedAt": now_local().isoformat(),
    }


def read_draft(slug):
    """The current draft for the page, and when its checkpoint was taken."""
    data = load_draft_file(subject_dir(slug) / ANSWERS_DIR / DRAFT_NAME)
    if data is None:
        return None, None
    cp = data.pop("checkpoint")
    return data, (cp or {}).get("savedAt")


def write_draft_file(slug, path, draft, checkpoint):
    path.parent.mkdir(exist_ok=True)
    text = (
        f"# Draft answers: {slug}\n\n"
        "Not submitted. The assessment browser saves this draft while you answer clarification "
        "questions; submit it there. The assessor and /clarify ignore this file. \"checkpoint\" is "
        "the draft as it was when Save was last clicked; Cancel goes back to it.\n\n"
        "```json\n" + json.dumps({**draft, "checkpoint": checkpoint}, indent=2, ensure_ascii=False) + "\n```\n"
    )
    write_atomic(path, text)


EMPTY_DRAFT = {"answeredBy": "", "clarVersion": "", "answers": {}}


def save_draft(slug, draft, checkpoint=False):
    """Save the draft. With checkpoint (a Save click), also make it the version
    Cancel goes back to; otherwise (an automatic save) keep the old checkpoint."""
    path = subject_dir(slug) / ANSWERS_DIR / DRAFT_NAME
    with WRITE_LOCK:
        existing = load_draft_file(path)
        cp = existing["checkpoint"] if existing else None
        if draft is None:
            if checkpoint or cp is None:
                remove(path)
                return None
            draft = EMPTY_DRAFT  # keep the file, so the checkpoint survives
        draft = clean_draft(draft)
        if checkpoint:
            cp = dict(draft)
        write_draft_file(slug, path, draft, cp)
        return draft["savedAt"]


def cancel_draft(slug):
    """Forget the changes since the last Save click: go back to the checkpoint,
    or to no draft if Save was never clicked. Returns the restored draft."""
    path = subject_dir(slug) / ANSWERS_DIR / DRAFT_NAME
    with WRITE_LOCK:
        existing = load_draft_file(path)
        cp = existing["checkpoint"] if existing else None
        if cp is None:
            remove(path)
            return None
        cp = {k: v for k, v in cp.items() if k != "checkpoint"}
        write_draft_file(slug, path, cp, cp)
        return cp


def submit(slug, body):
    d = subject_dir(slug)
    answered_by = text_field(body.get("answeredBy"), "Who is answering", MAX_LINE, required=True)
    clar_version = text_field(body.get("clarVersion"), "The clarifications version", 40)
    answers = body.get("answers") or []
    dont_know = body.get("dontKnow") or []
    if not isinstance(answers, list) or not isinstance(dont_know, list) or len(answers) + len(dont_know) > MAX_ITEMS:
        raise RequestError(400, "Invalid list of answers.")
    seen = set()

    def question_id(item):
        if not isinstance(item, dict) or not QID_RE.match(str(item.get("id", ""))):
            raise RequestError(400, "Invalid question ID.")
        if item["id"] in seen:
            raise RequestError(400, f"{item['id']} appears twice.")
        seen.add(item["id"])
        return item["id"]

    lines = []
    for a in answers:
        qid = question_id(a)
        title = text_field(a.get("title"), f"The title of {qid}", MAX_LINE)
        question = text_field(a.get("question"), f"The question text of {qid}", MAX_QUESTION)
        answer = text_field(a.get("answer"), f"The answer to {qid}", MAX_ANSWER, required=True, single_line=False)
        body_lines = answer_lines(answer)
        lines += [f"### {qid}: {title}", "", f"- **Question:** {question}", f"- **Answer:** {body_lines[0]}"]
        lines += [f"  {l}" if l.strip() else "" for l in body_lines[1:]]
        lines.append("")
    dk_lines = []
    for a in dont_know:
        qid = question_id(a)
        dk_lines.append(f"- {qid}: {text_field(a.get('title'), f'The title of {qid}', MAX_LINE)}")
    if not seen:
        raise RequestError(400, "There is nothing to submit.")

    clar_name = f"clarifications-needed-{slug}.md"
    with WRITE_LOCK:
        when = now_local()
        text = "\n".join([
            f"# Clarification Answers: {slug}",
            "",
            "| Field | Value |",
            "|---|---|",
            "| Status | Pending |",
            f"| Submitted | {when.isoformat()} |",
            f"| Answered by | {cell(answered_by)} |",
            f"| Clarifications file | {clar_name} (version {cell(clar_version) or 'unknown'}) |",
            "",
            "Submitted from the assessment browser. The assessor uses these answers at the next "
            "re-assessment and then sets Status to \"Used in TRA version X.Y\". Don't edit the answers: "
            "to change one, correct it with /clarify, or withdraw this submission in the browser and submit again.",
            "",
            "## Answers",
            "",
            *(lines or ["None.", ""]),
            "## Don't know",
            "",
            *(dk_lines or ["None."]),
            "",
        ])
        adir = d / ANSWERS_DIR
        adir.mkdir(exist_ok=True)
        base = f"answers-{when:%Y%m%d-%H%M%S}"
        for n in range(1, 1000):
            name = f"{base}.md" if n == 1 else f"{base}-{n}.md"
            try:
                with open(adir / name, "x", encoding="utf-8", newline="") as f:
                    f.write(text)
                break
            except FileExistsError:
                continue
        else:
            raise RequestError(500, "Couldn't find a free file name.")
        remove(adir / DRAFT_NAME)
    return name


def withdraw(slug, name):
    if not isinstance(name, str) or not SUBMISSION_RE.match(name):
        raise RequestError(400, "Invalid submission file name.")
    path = subject_dir(slug) / ANSWERS_DIR / name
    with WRITE_LOCK:
        if not path.is_file():
            raise RequestError(404, "That submission doesn't exist.")
        with open(path, encoding="utf-8", newline="") as f:
            text = f.read()
        m = STATUS_ROW_RE.search(text)
        if not m or m.group(2).strip().lower() != "pending":
            raise RequestError(409, "Only a pending submission can be withdrawn.")
        text = text[: m.start(2)] + " Withdrawn " + text[m.end(2):]
        write_atomic(path, text)


# ------------------------------------------------------------------- server

class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "AssessmentBrowser/1.1"

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

    def send_json(self, status, obj):
        self.send_body(status, json.dumps(obj).encode("utf-8"), "application/json; charset=utf-8")

    def not_found(self):
        self.send_body(404, b"Not found", "text/plain; charset=utf-8")

    def allowed_origins(self):
        port = self.server.server_address[1]
        return {f"127.0.0.1:{port}", f"localhost:{port}"}

    def host_ok(self):
        # Refuse requests for any other host name, so a web page can't reach the
        # server through DNS rebinding.
        return self.headers.get("Host", "") in self.allowed_origins()

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if not self.host_ok():
            self.send_body(403, b"Forbidden", "text/plain; charset=utf-8")
            return
        url = urllib.parse.urlsplit(self.path)
        query = urllib.parse.parse_qs(url.query)
        if url.path in STATIC_FILES:
            name, ctype = STATIC_FILES[url.path]
            body = (STATIC / name).read_bytes()
            if name == "index.html":
                body = body.replace(b"{{TOKEN}}", TOKEN.encode("ascii"))
            self.send_body(200, body, ctype)
        elif url.path == "/api/index":
            self.send_json(200, build_index())
        elif url.path == "/api/doc":
            target = resolve_doc(query.get("path", [""])[0])
            if target is None:
                self.not_found()
                return
            self.send_body(200, target.read_bytes(), "text/plain; charset=utf-8")
        elif url.path == "/api/draft":
            try:
                draft, checkpoint_at = read_draft(query.get("subject", [""])[0])
                self.send_json(200, {"draft": draft, "checkpointAt": checkpoint_at})
            except (RequestError, ValueError) as e:
                self.send_json(getattr(e, "status", 500), {"error": str(e)})
        else:
            self.not_found()

    def do_POST(self):
        try:
            body = self.read_json()
            url = urllib.parse.urlsplit(self.path)
            slug = body.get("subject")
            if url.path == "/api/draft":
                checkpoint = body.get("checkpoint") is True
                saved_at = save_draft(slug, body.get("draft"), checkpoint)
                self.send_json(200, {"savedAt": saved_at, "checkpointAt": saved_at if checkpoint else None})
            elif url.path == "/api/cancel":
                draft = cancel_draft(slug)
                self.send_json(200, {"draft": draft, "checkpointAt": (draft or {}).get("savedAt")})
            elif url.path == "/api/submit":
                self.send_json(200, {"file": submit(slug, body)})
            elif url.path == "/api/withdraw":
                withdraw(slug, body.get("file"))
                self.send_json(200, {"ok": True})
            else:
                raise RequestError(404, "Not found")
        except RequestError as e:
            self.send_json(e.status, {"error": str(e)})
        except OSError as e:
            self.send_json(500, {"error": f"Couldn't write the file: {e.strerror or e}"})

    def read_json(self):
        """Accept a write only from the browser's own page."""
        if not self.host_ok():
            raise RequestError(403, "Forbidden")
        origin = self.headers.get("Origin", "")
        if not origin.startswith("http://") or origin[len("http://"):] not in self.allowed_origins():
            raise RequestError(403, "Requests from other sites aren't accepted.")
        if not secrets.compare_digest(self.headers.get("X-AB-Token", ""), TOKEN):
            raise RequestError(403, "The server has restarted since this page was loaded. Reload the page.")
        if not self.headers.get("Content-Type", "").startswith("application/json"):
            raise RequestError(415, "Expected JSON.")
        try:
            length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            raise RequestError(411, "Content-Length required.")
        if length > MAX_BODY:
            raise RequestError(413, "The request is too large.")
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise RequestError(400, "Invalid JSON.")
        if not isinstance(body, dict):
            raise RequestError(400, "Invalid request.")
        return body


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
