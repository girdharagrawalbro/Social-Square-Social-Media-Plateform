#!/usr/bin/env python3
"""
Instagram Post Downloader  — Cookie Edition
============================================
Uses your browser sessionid cookie to download posts from any public profile.

Requirements:
    pip install requests

HOW TO GET YOUR SESSION ID:
-----------------------------
1. Open Chrome → instagram.com (stay logged in)
2. F12 → Application → Cookies → https://www.instagram.com
3. Find "sessionid" → copy the value

Usage:
    python instagram_downloader.py
    python instagram_downloader.py --target rungtauniv --limit 10
    python instagram_downloader.py --target nasa --limit 20 --session-id YOUR_VALUE
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    print("❌  Missing: requests\n    Run: pip install requests")
    sys.exit(1)


SESSION_SAVE = Path.home() / ".instaloader_sessions" / "cookie_session.txt"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept":           "*/*",
    "Accept-Language":  "en-US,en;q=0.9",
    "X-IG-App-ID":      "936619743392459",
    "Referer":          "https://www.instagram.com/",
    "Origin":           "https://www.instagram.com",
}


def sanitize(name: str) -> str:
    return "".join(c for c in name if c.isalnum() or c in ("_", "-")).rstrip()


# ─────────────────────────────────────────────────────────
# Session setup
# ─────────────────────────────────────────────────────────

def make_session(session_id: str) -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    # Set cookies
    for name, value in [
        ("sessionid",  session_id),
        ("csrftoken",  "missing"),
        ("ig_did",     "00000000-0000-0000-0000-000000000000"),
        ("ig_nrcb",    "1"),
    ]:
        s.cookies.set(name, value, domain=".instagram.com")

    # Fetch homepage to get real CSRF token
    try:
        r = s.get("https://www.instagram.com/", timeout=15)
        token = re.search(r'"csrf_token":"([^"]+)"', r.text)
        if token:
            s.cookies.set("csrftoken", token.group(1), domain=".instagram.com")
            s.headers["X-CSRFToken"] = token.group(1)
    except Exception:
        pass
    return s


def verify_login(s: requests.Session) -> str:
    """Return logged-in username or empty string."""
    try:
        r = s.get(
            "https://www.instagram.com/api/v1/accounts/current_user/?edit=true",
            timeout=15,
        )
        if r.status_code == 200:
            return r.json().get("user", {}).get("username", "")
    except Exception:
        pass
    return ""


# ─────────────────────────────────────────────────────────
# Profile lookup  — tries multiple endpoints
# ─────────────────────────────────────────────────────────

def get_profile(s: requests.Session, username: str) -> dict:
    """
    Fetch profile data. Tries 3 different endpoints in order.
    Returns a normalized dict with keys: id, username, full_name,
    biography, external_url, followers, following, total_posts,
    is_private, is_verified.
    """

    # ── Endpoint 1: /api/v1/users/web_profile_info/ ────────
    try:
        r = s.get(
            "https://www.instagram.com/api/v1/users/web_profile_info/",
            params={"username": username},
            headers={"X-Requested-With": "XMLHttpRequest"},
            timeout=20,
        )
        if r.status_code in (200, 201):
            data = r.json()
            u = (data.get("data") or {}).get("user") or data.get("user") or {}
            if u and u.get("id"):
                return _normalize(u)
        if r.status_code == 404:
            raise ValueError(f"@{username} not found.")
        if r.status_code in (401, 403):
            raise PermissionError("Session invalid or expired.")
    except (ValueError, PermissionError):
        raise
    except Exception:
        pass

    # ── Endpoint 2: /<username>/?__a=1&__d=dis ─────────────
    try:
        r = s.get(
            f"https://www.instagram.com/{username}/",
            params={"__a": "1", "__d": "dis"},
            timeout=20,
        )
        if r.status_code in (200, 201):
            try:
                data = r.json()
                u = (
                    data.get("graphql", {}).get("user")
                    or data.get("data", {}).get("user")
                    or {}
                )
                if u and (u.get("id") or u.get("pk")):
                    return _normalize(u)
            except Exception:
                pass
        if r.status_code == 404:
            raise ValueError(f"@{username} not found.")
    except (ValueError, PermissionError):
        raise
    except Exception:
        pass

    # ── Endpoint 3: scrape page source ─────────────────────
    try:
        r = s.get(f"https://www.instagram.com/{username}/", timeout=20)
        if r.status_code == 404:
            raise ValueError(f"@{username} not found.")
        text = r.text

        # Extract from JSON blob in page
        for pattern in [
            r'"user":\s*(\{[^<]{200,}?\})\s*[,}]',
            r'window\._sharedData\s*=\s*(\{.+?\});</script>',
        ]:
            m = re.search(pattern, text)
            if m:
                try:
                    blob = json.loads(m.group(1))
                    if blob.get("id") or blob.get("pk"):
                        return _normalize(blob)
                except Exception:
                    pass

        # Last resort: extract individual fields
        def extract(key):
            m = re.search(rf'"{key}"\s*:\s*"?([^",}}]+)"?', text)
            return m.group(1).strip() if m else ""

        uid = extract("id") or extract("pk")
        if uid:
            return {
                "id":          uid,
                "username":    username,
                "full_name":   extract("full_name"),
                "biography":   "",
                "external_url":"",
                "followers":   0,
                "following":   0,
                "total_posts": 0,
                "is_private":  "true" in extract("is_private").lower(),
                "is_verified": "true" in extract("is_verified").lower(),
            }
    except (ValueError, PermissionError):
        raise
    except Exception as e:
        raise ConnectionError(f"Could not fetch @{username}: {e}")

    raise ConnectionError(
        f"All profile endpoints failed for @{username}. "
        "Your session may be expired — get a fresh sessionid cookie."
    )


def _normalize(u: dict) -> dict:
    """Normalize different profile response shapes into one dict."""
    followers = (
        u.get("follower_count")
        or u.get("edge_followed_by", {}).get("count")
        or 0
    )
    following = (
        u.get("following_count")
        or u.get("edge_follow", {}).get("count")
        or 0
    )
    total = (
        u.get("media_count")
        or u.get("edge_owner_to_timeline_media", {}).get("count")
        or 0
    )
    return {
        "id":           str(u.get("id") or u.get("pk") or ""),
        "username":     u.get("username", ""),
        "full_name":    u.get("full_name", ""),
        "biography":    u.get("biography", ""),
        "external_url": u.get("external_url", "") or u.get("bio_links", [{}])[0].get("url", "") if u.get("bio_links") else u.get("external_url", ""),
        "followers":    int(followers),
        "following":    int(following),
        "total_posts":  int(total),
        "is_private":   bool(u.get("is_private", False)),
        "is_verified":  bool(u.get("is_verified", False)),
    }


# ─────────────────────────────────────────────────────────
# Post fetching
# ─────────────────────────────────────────────────────────

def fetch_posts(s: requests.Session, user_id: str, limit: int) -> list:
    posts = []
    next_max_id = None

    while len(posts) < limit:
        params = {"count": min(12, limit - len(posts))}
        if next_max_id:
            params["max_id"] = next_max_id

        try:
            r = s.get(
                f"https://www.instagram.com/api/v1/feed/user/{user_id}/",
                params=params,
                timeout=20,
            )
        except requests.RequestException as e:
            print(f"\n  ⚠   Network error: {e}")
            break

        if r.status_code == 401:
            print("\n  ❌  401 — session expired. Get a fresh sessionid.")
            break
        if r.status_code == 429:
            print("\n  ⚠   Rate limited — waiting 30s …")
            time.sleep(30)
            continue
        if r.status_code not in (200, 201):
            print(f"\n  ⚠   HTTP {r.status_code} from feed endpoint — stopping.")
            break

        try:
            data = r.json()
        except Exception:
            print("\n  ⚠   JSON parse error.")
            break

        items = data.get("items", [])
        if not items:
            break

        posts.extend(items)

        if not data.get("more_available") or not data.get("next_max_id"):
            break
        next_max_id = data["next_max_id"]

    return posts[:limit]


# ─────────────────────────────────────────────────────────
# Parse & download
# ─────────────────────────────────────────────────────────

def parse_post(item: dict, idx: int) -> dict:
    code    = item.get("code") or item.get("shortcode", "")
    taken   = item.get("taken_at", 0)
    dt      = datetime.fromtimestamp(taken, tz=timezone.utc).isoformat() if taken else ""
    cap_obj = item.get("caption") or {}
    caption = cap_obj.get("text", "") if isinstance(cap_obj, dict) else str(cap_obj)

    media_type = item.get("media_type", 1)
    ptype = {2: "video/reel", 8: "carousel"}.get(media_type, "photo")

    # Collect media URLs
    urls = []
    if media_type == 8:
        for node in item.get("carousel_media", []):
            if node.get("media_type") == 2:
                vv = node.get("video_versions", [])
                if vv: urls.append(("mp4", vv[0]["url"]))
            else:
                ic = node.get("image_versions2", {}).get("candidates", [])
                if ic: urls.append(("jpg", ic[0]["url"]))
    elif media_type == 2:
        vv = item.get("video_versions", [])
        if vv: urls.append(("mp4", vv[0]["url"]))
        ic = item.get("image_versions2", {}).get("candidates", [])
        if ic: urls.append(("jpg", ic[0]["url"]))
    else:
        ic = item.get("image_versions2", {}).get("candidates", [])
        if ic: urls.append(("jpg", ic[0]["url"]))

    return {
        "index":                 idx,
        "shortcode":             code,
        "type":                  ptype,
        "url":                   f"https://www.instagram.com/p/{code}/",
        "date_utc":              dt,
        "caption":               caption,
        "hashtags":              re.findall(r"#(\w+)", caption),
        "mentions":              re.findall(r"@(\w+)", caption),
        "likes":                 item.get("like_count", 0),
        "comments":              item.get("comment_count", 0),
        "is_video":              media_type == 2,
        "video_view_count":      item.get("view_count"),
        "location":              (item.get("location") or {}).get("name"),
        "tagged_users":          [
                                     t.get("user", {}).get("username", "")
                                     for t in item.get("usertags", {}).get("in", [])
                                 ],
        "accessibility_caption": item.get("accessibility_caption", ""),
        "media_count":           len(item.get("carousel_media", [])) or 1,
        "owner_username":        item.get("user", {}).get("username", ""),
        "_media_urls":           urls,   # internal, removed from final JSON
    }


def download_file(s: requests.Session, url: str, dest: str) -> bool:
    try:
        r = s.get(url, stream=True, timeout=30)
        if r.status_code in (200, 201):
            with open(dest, "wb") as f:
                for chunk in r.iter_content(8192):
                    f.write(chunk)
            return True
    except Exception as e:
        print(f"    ⚠   {e}")
    return False


# ─────────────────────────────────────────────────────────
# Orchestrator
# ─────────────────────────────────────────────────────────

def run(target: str, limit: int, output_dir: str, session_id: str):

    # ── Auth ───────────────────────────────────────────────
    print("\n" + "---" * 18)
    print("  STEP 1 - Authenticating")
    print("---" * 18)

    if not session_id:
        print("""
  Get your sessionid:
  Chrome: F12 → Application → Cookies → instagram.com → sessionid
  Firefox: F12 → Storage → Cookies → sessionid
""")
        session_id = input("  Paste sessionid value: ").strip()
    if not session_id:
        print("❌  sessionid is required.")
        sys.exit(1)

    s = make_session(session_id)
    me = verify_login(s)
    if me:
        print(f"  [OK]  Logged in as @{me}")
    else:
        print("  [WARN]  Login check inconclusive.")

    SESSION_SAVE.parent.mkdir(exist_ok=True)
    SESSION_SAVE.write_text(session_id)

    # ── Profile ────────────────────────────────────────────
    print("\n" + "---" * 18)
    print(f"  STEP 2 - Profile @{target}")
    print("---" * 18)

    try:
        profile = get_profile(s, target)
    except ValueError as e:
        print(f"\n❌  {e}")
        sys.exit(1)
    except PermissionError as e:
        print(f"\n❌  {e}")
        sys.exit(1)
    except ConnectionError as e:
        print(f"\n❌  {e}")
        sys.exit(1)

    print(f"\n  [OK]  @{profile['username']}")
    print(f"      Name      : {profile['full_name'] or '—'}")
    print(f"      Followers : {profile['followers']:,}")
    print(f"      Posts     : {profile['total_posts']:,}")
    print(f"      Private   : {profile['is_private']}")

    if profile["is_private"]:
        print(f"\n❌  Private account — cannot download.")
        sys.exit(1)

    # ── Fetch post list ────────────────────────────────────
    print(f"\n  [INFO]  Fetching post metadata...")
    raw = fetch_posts(s, profile["id"], limit)

    if not raw:
        print("  ❌  No posts returned. Try refreshing your sessionid cookie.")
        sys.exit(1)

    print(f"  [OK]  {len(raw)} post(s) ready.\n")

    # ── Download ───────────────────────────────────────────
    os.makedirs(output_dir, exist_ok=True)
    print(f"  [PATH]  {os.path.abspath(output_dir)}\n")

    metadata_list = []
    downloaded = skipped = 0

    for i, item in enumerate(raw):
        idx  = i + 1
        meta = parse_post(item, idx)
        urls = meta.pop("_media_urls")
        sc   = meta["shortcode"] or f"post_{idx}"

        print(f"  [{idx:>3}/{len(raw)}]  {meta['type']:<14}  {sc}  "
              f"{meta['date_utc'][:10]}  …", end=" ", flush=True)

        ok = 0
        for j, (ext, url) in enumerate(urls):
            suffix = f"_{j+1}" if len(urls) > 1 else ""
            dest   = os.path.join(output_dir, f"{sc}{suffix}.{ext}")
            if download_file(s, url, dest):
                ok += 1

        if ok > 0 or not urls:
            metadata_list.append(meta)
            downloaded += 1
            print(f"  [OK]  ({ok} file{'s' if ok != 1 else ''})")
        else:
            skipped += 1
            print("  [SKIP]  skipped")

        time.sleep(1.5)

    # ── JSON ───────────────────────────────────────────────
    json_path = os.path.join(output_dir, "metadata.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({
            "downloaded_at":   datetime.utcnow().isoformat() + "Z",
            "downloaded_by":   me or "unknown",
            "target_username": target,
            "full_name":       profile["full_name"],
            "biography":       profile["biography"],
            "external_url":    profile["external_url"],
            "is_verified":     profile["is_verified"],
            "followers":       profile["followers"],
            "following":       profile["following"],
            "total_posts":     profile["total_posts"],
            "requested":       limit,
            "downloaded":      downloaded,
            "skipped":         skipped,
            "posts":           metadata_list,
        }, f, ensure_ascii=False, indent=2)

    print(f"\n{'─'*54}")
    print(f"  [OK]  Downloaded : {downloaded}   Skipped : {skipped}")
    print(f"  [META]  Metadata   : {os.path.abspath(json_path)}")
    print(f"{'─'*54}\n")


# ─────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Download posts from any public Instagram profile.")
    p.add_argument("--target",     "-t", default=None)
    p.add_argument("--limit",      "-l", type=int, default=None)
    p.add_argument("--output",     "-o", default=None)
    p.add_argument("--session-id", "-s", default=None,
                   help="Instagram sessionid cookie value")
    args = p.parse_args()

    print("=" * 54)
    print("    Instagram Post Downloader  (Cookie Edition)")
    print("=" * 54)

    target = args.target
    if not target:
        target = input("\nDownload FROM which username: ").strip().lstrip("@")
    if not target:
        print("❌  Username required.")
        sys.exit(1)

    limit = args.limit
    if limit is None:
        raw = input("How many posts? (default 10): ").strip()
        limit = int(raw) if raw.isdigit() and int(raw) > 0 else 10

    session_id = args.session_id
    if not session_id and SESSION_SAVE.exists():
        session_id = SESSION_SAVE.read_text().strip()
        print(f"\n  [OK]  Using saved sessionid  (delete {SESSION_SAVE} to reset)\n")

    run(target, limit, output_dir=args.output or f"./{sanitize(target)}_posts",
        session_id=session_id)


if __name__ == "__main__":
    main()