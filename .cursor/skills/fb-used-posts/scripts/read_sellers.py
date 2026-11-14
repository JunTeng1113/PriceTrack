# -*- coding: utf-8 -*-
"""Open public Facebook group posts with a copy of the logged-in Chrome profile and print the author.

Reads only the post URLs passed on the command line. Prints one JSON object per line:
{"link","seller","title"}. Posts whose author cannot be read are omitted.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
USER_DATA = Path(os.environ["LOCALAPPDATA"]) / "Google" / "Chrome" / "User Data"
NEEDED = ("Network", "Local Storage", "Session Storage", "Preferences", "Secure Preferences")


def profile_with_session() -> str:
    import sqlite3

    for directory in sorted(USER_DATA.iterdir()):
        cookies = directory / "Network" / "Cookies"
        if not cookies.exists():
            continue
        copy = Path(tempfile.gettempdir()) / f"ck-scan-{directory.name}.db"
        shutil.copy2(cookies, copy)
        conn = sqlite3.connect(copy)
        found = conn.execute(
            "select 1 from cookies where host_key like '%facebook%' and name = 'c_user' limit 1"
        ).fetchone()
        conn.close()
        if found is not None:
            return directory.name
    raise SystemExit("Chrome 裡沒有已登入的 Facebook")


def stage_profile(profile: str) -> Path:
    dest = Path(tempfile.mkdtemp(prefix="fb-used-"))
    shutil.copy2(USER_DATA / "Local State", dest / "Local State")
    target = dest / profile
    target.mkdir()
    source = USER_DATA / profile
    for name in NEEDED:
        item = source / name
        if not item.exists():
            continue
        copied = target / name
        if item.is_dir():
            shutil.copytree(item, copied)
        else:
            shutil.copy2(item, copied)
    return dest


def author_from(html: str) -> tuple[str, str]:
    title = ""
    titled = re.search(r"<title>(.*?)</title>", html, flags=re.S)
    if titled is not None:
        title = re.sub(r"\s+", " ", titled.group(1)).strip()
    named = re.search(r"([^<>]{1,40}) 的貼文", html)
    if named is not None:
        return named.group(1).strip(), title
    actor = re.search(r'"__typename":"User","name":"((?:\\.|[^"\\]){1,80})"', html)
    if actor is not None:
        return json.loads('"' + actor.group(1) + '"'), title
    return "", title


def dump(chrome_data: Path, profile: str, link: str) -> str:
    completed = subprocess.run(
        [
            str(CHROME),
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--disable-extensions",
            f"--user-data-dir={chrome_data}",
            f"--profile-directory={profile}",
            "--virtual-time-budget=20000",
            "--dump-dom",
            link,
        ],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=60,
    )
    return completed.stdout


def main() -> None:
    links = [item.strip() for item in sys.argv[1:] if item.strip()]
    if not links:
        raise SystemExit("usage: read_sellers.py URL...")
    profile = profile_with_session()
    chrome_data = stage_profile(profile)
    for link in links:
        print(link, file=sys.stderr, flush=True)
        html = dump(chrome_data, profile, link)
        seller, title = author_from(html)
        if seller == "":
            print(json.dumps({"link": link, "title": title, "bytes": len(html)}, ensure_ascii=False), file=sys.stderr)
            continue
        print(json.dumps({"link": link, "seller": seller, "title": title}, ensure_ascii=False))


if __name__ == "__main__":
    main()
