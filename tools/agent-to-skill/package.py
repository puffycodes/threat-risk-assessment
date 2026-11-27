#!/usr/bin/env python3
"""Package the skills built by convert.py into one archive per target.

Reads each build in dist/<target>/ and writes dist/packages/
tra-skills-<target>-<version>.zip (or .tar.gz, or both), plus a SHA256SUMS
file for the archives. Each archive holds one folder,
tra-skills-<target>-<version>/, with the build's README.md,
skills-manifest.json and skills folder (.claude/skills/, .cursor/skills/,
.github/skills/ or skills/), laid out as in dist/.

Before packaging a target it checks that:
- the build was made by convert.py and its files match the manifest's
  SHA-256s exactly, with no file missing or added
- the build isn't -dirty or unknown, unless --allow-dirty is given
- the build is current: its version is the version the sources have now.
  If not, run convert.py again first.

The archives are reproducible: entries are sorted, and their times are the
build's built_at time, so packaging the same build twice gives the same bytes.

Uses only the Python standard library, and git through convert.py.

    python tools/agent-to-skill/package.py [--target all|claude-code|cursor|copilot|generic] [--format zip|tar.gz|both] [--dist dist] [--out dist/packages] [--allow-dirty]

Exit status: 0 on success; 2 on an error.
"""

import argparse
import datetime
import gzip
import hashlib
import io
import json
import sys
import tarfile
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import convert  # noqa: E402  (same folder; importing it has no side effects)

ROOT = convert.ROOT
FORMATS = {"zip": [".zip"], "tar.gz": [".tar.gz"], "both": [".zip", ".tar.gz"]}
SUMS = "SHA256SUMS"


class PackageError(Exception):
    pass


def shown(path):
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def load_build(build_dir, target_name):
    """Check a built target against its manifest. Returns the manifest and the files to package."""
    if not build_dir.is_dir():
        raise PackageError(f"{shown(build_dir)} doesn't exist; run tools/agent-to-skill/convert.py first")
    if not (build_dir / convert.MARKER).is_file():
        raise PackageError(f"{shown(build_dir)} wasn't made by convert.py")
    manifest_path = build_dir / convert.MANIFEST
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise PackageError(f"can't read {shown(manifest_path)}: {e}")
    if manifest.get("target") != target_name:
        raise PackageError(f"{shown(manifest_path)} is for target {manifest.get('target')!r}, not {target_name!r}")

    skills_dir = build_dir / manifest["skills_dir"]
    problems = []
    on_disk = sorted(p.name for p in skills_dir.iterdir() if p.is_dir()) if skills_dir.is_dir() else []
    for extra in sorted(set(on_disk) - set(manifest["skills"])):
        problems.append(f"{extra}: skill folder not in the manifest")
    for name, expected in manifest["skills"].items():
        have = convert.file_hashes(skills_dir / name) if (skills_dir / name).is_dir() else {}
        for f in sorted(set(have) | set(expected)):
            if f not in have:
                problems.append(f"{name}/{f}: missing")
            elif f not in expected:
                problems.append(f"{name}/{f}: not in the manifest")
            elif have[f] != expected[f]:
                problems.append(f"{name}/{f}: changed since the build")
    if problems:
        raise PackageError(f"{shown(build_dir)} doesn't match its manifest; run convert.py again:\n"
                           + "\n".join(f"  {p}" for p in problems))

    files = [build_dir / "README.md", manifest_path]
    files += [p for p in sorted(skills_dir.rglob("*")) if p.is_file()]
    for f in files:
        if not f.is_file():
            raise PackageError(f"{shown(f)} is missing; run convert.py again")
    return manifest, files


def check_version(manifest, current, allow_dirty, target_name):
    built = manifest["version"]
    if manifest.get("dirty") or built == "unknown":
        why = "has uncommitted source changes" if manifest.get("dirty") else "has no version (git wasn't available)"
        if not allow_dirty:
            raise PackageError(f"{target_name}: the build {why}, so it can't be traced to a commit. "
                               "Commit the sources and run convert.py again, or pass --allow-dirty")
        print(f"warning: {target_name}: the build {why}", file=sys.stderr)
    if current["version"] == "unknown":
        print(f"warning: {target_name}: git isn't available, so can't tell whether the build is current",
              file=sys.stderr)
    elif built != current["version"]:
        raise PackageError(f"{target_name}: the build is version {built}, but the sources are now "
                           f"version {current['version']}; run convert.py again first")


def build_time(manifest):
    """The build's built_at time, for the archive entries. Zip can't store a time before 1980."""
    try:
        t = datetime.datetime.fromisoformat(manifest["built_at"])
    except (KeyError, ValueError):
        t = datetime.datetime(1980, 1, 1, tzinfo=datetime.timezone.utc)
    if t.tzinfo is None:
        t = t.replace(tzinfo=datetime.timezone.utc)
    return max(t, datetime.datetime(1980, 1, 1, 12, tzinfo=datetime.timezone.utc))


def entries(build_dir, files, top):
    """(archive name, file) pairs, with the folders each file needs, in sorted order."""
    names = {}
    for f in files:
        rel = f.relative_to(build_dir).as_posix()
        parts = rel.split("/")
        for i in range(1, len(parts)):
            names.setdefault(f"{top}/{'/'.join(parts[:i])}/", None)
        names[f"{top}/{rel}"] = f
    names[f"{top}/"] = None
    return sorted(names.items())


def write_zip(path, items, when):
    stamp = when.timetuple()[:6]
    with zipfile.ZipFile(path, "w") as z:
        for name, f in items:
            info = zipfile.ZipInfo(name, date_time=stamp)
            info.create_system = 3  # Unix, so the permissions below are read
            if f is None:
                info.external_attr = (0o40755 << 16) | 0x10
                z.writestr(info, b"")
            else:
                info.external_attr = 0o100644 << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                z.writestr(info, f.read_bytes())


def write_tar_gz(path, items, when):
    mtime = int(when.timestamp())
    with open(path, "wb") as raw, \
            gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=mtime) as gz, \
            tarfile.open(fileobj=gz, mode="w", format=tarfile.PAX_FORMAT) as tar:
        for name, f in items:
            info = tarfile.TarInfo(name.rstrip("/"))
            info.mtime = mtime
            info.uid = info.gid = 0
            info.uname = info.gname = ""
            if f is None:
                info.type = tarfile.DIRTYPE
                info.mode = 0o755
                tar.addfile(info)
            else:
                data = f.read_bytes()
                info.size = len(data)
                info.mode = 0o644
                tar.addfile(info, io.BytesIO(data))


def package(target_names, dist, out, exts, allow_dirty):
    current = convert.source_version()
    # Check every target before writing anything, so a failure leaves no partial set.
    builds = []
    for target_name in target_names:
        build_dir = dist / target_name
        manifest, files = load_build(build_dir, target_name)
        check_version(manifest, current, allow_dirty, target_name)
        builds.append((target_name, build_dir, manifest, files))

    out.mkdir(parents=True, exist_ok=True)
    written = []
    for target_name, build_dir, manifest, files in builds:
        top = f"tra-skills-{target_name}-{manifest['version']}"
        items = entries(build_dir, files, top)
        when = build_time(manifest)
        for ext in exts:
            path = out / f"{top}{ext}"
            tmp = path.with_name(path.name + ".tmp")
            (write_zip if ext == ".zip" else write_tar_gz)(tmp, items, when)
            tmp.replace(path)
            written.append(path)
            print(f"{target_name}: {len(manifest['skills'])} skills in {shown(path)}")

    # Keep the sums of archives from earlier runs that are still there, and replace those just written.
    sums_path = out / SUMS
    sums = {}
    if sums_path.is_file():
        for line in sums_path.read_text(encoding="utf-8").splitlines():
            digest, _, name = line.partition("  ")
            if name and (out / name).is_file():
                sums[name] = digest
    for path in written:
        sums[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
    sums_path.write_text("".join(f"{d}  {n}\n" for n, d in sorted(sums.items())), encoding="utf-8", newline="\n")
    print(f"checksums in {shown(sums_path)}")


def main():
    ap = argparse.ArgumentParser(description="Package the skills built by convert.py, one archive per target.")
    ap.add_argument("--target", choices=["all", *convert.TARGETS], default="all")
    ap.add_argument("--format", choices=list(FORMATS), default="zip",
                    help="archive format (default: zip, which every host's upload form and OS can open)")
    ap.add_argument("--dist", default="dist",
                    help="folder convert.py built into, relative to the repository root (default: dist)")
    ap.add_argument("--out", default=None,
                    help="folder for the archives, relative to the repository root (default: <dist>/packages)")
    ap.add_argument("--allow-dirty", action="store_true",
                    help="package a build marked -dirty or unknown; for trying out changes, not for handing out")
    args = ap.parse_args()

    dist = (ROOT / args.dist).resolve()
    out = (ROOT / args.out).resolve() if args.out else dist / "packages"
    targets = list(convert.TARGETS) if args.target == "all" else [args.target]
    try:
        if out.parent == dist and out.name in convert.TARGETS:
            raise PackageError(f"--out {shown(out)} is a build folder; choose another")
        package(targets, dist, out, FORMATS[args.format], args.allow_dirty)
    except PackageError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
