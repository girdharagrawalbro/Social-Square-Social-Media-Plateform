#!/usr/bin/env python3
"""
Instagram Post Downloader  — Cookie Edition
============================================
Uses your browser sessionid cookie to download posts from any public profile.

Requirements:
    pip install curl-cffi

  curl_cffi replaces 'requests' — it impersonates Chrome's TLS/JA3/HTTP2
  fingerprint so Instagram cannot detect and block the scraper at the
  network layer (the main reason all API endpoints were failing).

HOW TO GET YOUR SESSION ID:
-----------------------------
1. Open Chrome → instagram.com (stay logged in)
2. F12 → Application → Cookies → https://www.instagram.com
3. Find "sessionid" → copy the value

Usage:
    python instagram_downloader.py
    python instagram_downloader.py --target username --limit 10
    python instagram_downloader.py --target username --limit 20 --session-id YOUR_VALUE
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote

# ── Dependency check ──────────────────────────────────────────────────────────
try:
    from curl_cffi import requests  # drop-in for requests, but with real Chrome TLS
    from curl_cffi.requests import Session

    IMPERSONATE = "chrome"  # always use latest Chrome fingerprint
except ImportError:
    print("[ERROR] Missing: curl-cffi")
    print("    Run: pip install curl-cffi")
    sys.exit(1)


SESSION_SAVE = Path.home() / ".instaloader_sessions" / "cookie_session.txt"

# These are the EXACT headers Chrome 147 sends — order matters for HTTP/2
HEADERS = {
    "accept": "*/*",
    "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
    "origin": "https://www.instagram.com",
    "referer": "https://www.instagram.com/",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "sec-ch-ua": '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "dnt": "1",
    "x-ig-app-id": "936619743392459",
    "x-asbd-id": "359341",
    "x-bloks-version-id": "ad0f1f5e41c2d9fcde83dfd68eea4def768b66bc3029c58e846d7c1dda44ba2a",
    "x-fb-lsd": "SVYTtsT1A61p-7CtsPZKqt",
}


def sanitize(name: str) -> str:
    return "".join(c for c in name if c.isalnum() or c in ("_", "-")).rstrip()


def fix_url(raw: str) -> str:
    """Fix JSON-escaped URLs: https:\\/\\/ → https://  and \\u002F → /"""
    if not raw:
        return raw
    return raw.replace("\\/", "/").replace("\\u002F", "/").replace("\\u0026", "&")


# ─────────────────────────────────────────────────────────
# Session setup
# ─────────────────────────────────────────────────────────


def make_session(session_id: str) -> Session:
    session_id = unquote(session_id.strip())

    s = Session(impersonate=IMPERSONATE)  # ← Chrome TLS/JA3/HTTP2 fingerprint
    s.headers.update(HEADERS)

    numeric_uid = session_id.split(":")[0] if ":" in session_id else ""
    for name, value in [
        ("sessionid", session_id),
        ("ds_user_id", numeric_uid),
        ("ig_did", "61BF33ED-2729-4887-A893-97E308DC6DD0"),
        ("ig_nrcb", "1"),
        ("ps_l", "1"),
        ("ps_n", "1"),
    ]:
        if value:
            s.cookies.set(name, value, domain=".instagram.com")

    # Fetch homepage to collect real CSRF token + mid + rur cookies
    try:
        r = s.get("https://www.instagram.com/", timeout=15)

        for cookie in r.cookies:
            s.cookies.set(cookie.name, cookie.value, domain=".instagram.com")

        token = None
        for pattern in [
            r'"csrf_token"\s*:\s*"([a-zA-Z0-9_\-]{20,})"',
            r'"csrfToken"\s*:\s*"([a-zA-Z0-9_\-]{20,})"',
        ]:
            m = re.search(pattern, r.text)
            if m:
                token = m.group(1)
                break

        if not token and r.cookies.get("csrftoken", ""):
            candidate = r.cookies.get("csrftoken", "")
            if len(candidate) >= 20:
                token = candidate

        if token:
            s.cookies.set("csrftoken", token, domain=".instagram.com")
            s.headers["x-csrftoken"] = token
        else:
            print("  [WARN]  Could not extract CSRF token — session may be expired.")

    except Exception as e:
        print(f"  [WARN]  Homepage fetch failed: {e}")

    return s


def verify_login(s: Session) -> str:
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
# Profile lookup
# ─────────────────────────────────────────────────────────


def get_profile(s: Session, username: str) -> dict:

    # ── Endpoint 1: /api/v1/users/web_profile_info/ ────────
    try:
        print(f"  [INFO]  Trying Endpoint 1 (v1 API)...", end=" ", flush=True)
        r = s.get(
            "https://www.instagram.com/api/v1/users/web_profile_info/",
            params={"username": username},
            headers={"x-requested-with": "XMLHttpRequest"},
            timeout=20,
        )
        if r.status_code in (200, 201):
            data = r.json()
            u = (data.get("data") or {}).get("user") or data.get("user") or {}
            if u and u.get("id") and u.get("username", "").lower() == username.lower():
                print("[OK]")
                return _normalize(u)
        if r.status_code == 404:
            raise ValueError(f"@{username} not found.")
        print(f"[FAIL] ({r.status_code})")
    except (ValueError, PermissionError):
        raise
    except Exception as e:
        print(f"[FAIL] ({e})")

    # ── Endpoint 2: POST /graphql/query ────────────────────
    try:
        print(f"  [INFO]  Trying Endpoint 2 (POST GraphQL)...", end=" ", flush=True)
        r = s.post(
            "https://www.instagram.com/graphql/query",
            data={
                "variables": json.dumps({"username": username, "include_reel": True}),
                "doc_id": "7897892850295284",
            },
            headers={
                "content-type": "application/x-www-form-urlencoded",
                "x-fb-friendly-name": "PolarisProfilePageContentQuery",
            },
            timeout=20,
        )
        if r.status_code == 200:
            try:
                data = r.json()
                u = (
                    data.get("data", {}).get("user")
                    or data.get("data", {})
                    .get("xdt_api__v1__users__web_profile_info__connection", {})
                    .get("user")
                    or {}
                )
                if (
                    u
                    and (u.get("id") or u.get("pk"))
                    and u.get("username", "").lower() == username.lower()
                ):
                    print("[OK]")
                    return _normalize(u)
            except Exception:
                pass
        print(f"[FAIL] ({r.status_code})")
    except Exception as e:
        print(f"[FAIL] ({e})")

    # ── Endpoint 3: /<username>/?__a=1&__d=dis ─────────────
    try:
        print(f"  [INFO]  Trying Endpoint 3 (dis API)...", end=" ", flush=True)
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
                if (
                    u
                    and (u.get("id") or u.get("pk"))
                    and u.get("username", "").lower() == username.lower()
                ):
                    print("[OK]")
                    return _normalize(u)
            except Exception:
                pass
        if r.status_code == 404:
            raise ValueError(f"@{username} not found.")
        print(f"[FAIL] ({r.status_code})")
    except (ValueError, PermissionError):
        raise
    except Exception as e:
        print(f"[FAIL] ({e})")

    # ── Endpoint 4: GET GraphQL query_hash ─────────────────
    try:
        print(f"  [INFO]  Trying Endpoint 4 (GET GraphQL)...", end=" ", flush=True)
        r = s.get(
            "https://www.instagram.com/graphql/query/",
            params={
                "query_hash": "e7e2f4da4b02303f74f0841279e52d76",
                "variables": json.dumps({"username": username}),
            },
            timeout=20,
        )
        if r.status_code in (200, 201):
            try:
                data = r.json()
                u = (
                    data.get("data", {}).get("user")
                    or data.get("data", {}).get("user_info", {}).get("user")
                    or {}
                )
                if u and u.get("username", "").lower() == username.lower():
                    print("[OK]")
                    return _normalize(u)
            except Exception:
                pass
        print(f"[FAIL] ({r.status_code})")
    except Exception as e:
        print(f"[FAIL] ({e})")

    # ── Endpoint 5: Page source deep extraction ─────────────
    try:
        print(f"  [INFO]  Trying Endpoint 5 (Deep Scraper)...", end=" ", flush=True)
        r = s.get(f"https://www.instagram.com/{username}/", timeout=20)
        if r.status_code == 404:
            raise ValueError(f"@{username} not found.")
        text = r.text

        # Strategy A: <script type="application/json"> — modern IG uses these
        for sc in re.findall(
            r'<script[^>]*type=["\']application/json["\'][^>]*>(.*?)</script>',
            text,
            re.DOTALL,
        ):
            try:
                blob = json.loads(sc)
                # Walk the JSON tree looking for a user object matching the username
                found = _find_user_in_blob(blob, username)
                if found:
                    print("✅")
                    return _normalize(found)
            except Exception:
                pass

        # Strategy B: any <script> tag containing the username
        for sc in re.findall(r"<script[^>]*>(.*?)</script>", text, re.DOTALL):
            if (
                f'"username":"{username}"' not in sc
                and f'"username": "{username}"' not in sc
            ):
                continue
            for m in re.finditer(r"\{[^{}]{10,}\}", sc):
                try:
                    blob = json.loads(m.group())
                    if blob.get("username", "").lower() == username.lower() and (
                        blob.get("id") or blob.get("pk")
                    ):
                        print("[OK]")
                        return _normalize(blob)
                except Exception:
                    pass

        # Strategy C: "user":{...} blobs anywhere on page
        for m in re.finditer(r'"user"\s*:\s*(\{(?:[^{}]|\{[^{}]*\})*\})', text):
            try:
                blob = json.loads(m.group(1))
                if blob.get("username", "").lower() == username.lower() and (
                    blob.get("id") or blob.get("pk")
                ):
                    print("[OK]")
                    return _normalize(blob)
            except Exception:
                pass

        # Strategy D: field extraction anchored to every username mention
        for pos_m in re.finditer(
            rf'"username"\s*:\s*"{re.escape(username)}"', text, re.IGNORECASE
        ):
            window = text[
                max(0, pos_m.start() - 5000) : min(len(text), pos_m.start() + 5000)
            ]
            uid_m = re.search(r'"(?:id|pk)"\s*:\s*"?(\d{6,})"?', window)
            if not uid_m:
                continue

            def _find(pats, src):
                for p in pats:
                    m = re.search(p, src)
                    if m:
                        return m.group(1)
                return ""

            uid = uid_m.group(1)
            fullname = _find([r'"full_name"\s*:\s*"([^"]*)"'], window)
            private = _find([r'"is_private"\s*:\s*(true|false)'], window)
            verified = _find([r'"is_verified"\s*:\s*(true|false)'], window)
            pic_raw = _find(
                [
                    r'"profile_pic_url_hd"\s*:\s*"(https[^"]+)"',
                    r'"profile_pic_url"\s*:\s*"(https[^"]+)"',
                ],
                window,
            )

            # Follower/post counts may live far from username in IG's JS bundles
            followers = 0
            posts = 0
            for src in [window, text]:
                if not followers:
                    fm = re.search(r'"follower_count"\s*:\s*(\d+)', src) or re.search(
                        r'"edge_followed_by"\s*:\s*\{"count"\s*:\s*(\d+)\}', src
                    )
                    if fm:
                        followers = int(fm.group(1))
                if not posts:
                    pm = re.search(r'"media_count"\s*:\s*(\d+)', src) or re.search(
                        r'"edge_owner_to_timeline_media"\s*:\s*\{"count"\s*:\s*(\d+)\}',
                        src,
                    )
                    if pm:
                        posts = int(pm.group(1))

            print("[OK] (Partial)")
            return {
                "id": uid,
                "username": username,
                "full_name": fullname,
                "biography": "",
                "external_url": "",
                "followers": followers,
                "following": 0,
                "total_posts": posts,
                "is_private": private == "true",
                "is_verified": verified == "true",
                "profile_pic_url": fix_url(pic_raw),
            }

        print("[FAIL]")
    except (ValueError, PermissionError):
        raise
    except Exception as e:
        print(f"[FAIL] ({e})")
        raise ConnectionError(f"Could not fetch @{username}: {e}")

    raise ConnectionError(
        f"All profile endpoints failed for @{username}.\n"
        "  • Get a fresh sessionid: F12 → Application → Cookies → instagram.com\n"
        "  - Make sure instagram.com loads your feed normally in Chrome first\n"
        "  - Delete saved session: del %USERPROFILE%\\.instaloader_sessions\\cookie_session.txt"
    )


def _find_user_in_blob(blob, username: str, depth: int = 0):
    """Recursively walk a JSON blob looking for a user object matching username."""
    if depth > 10:
        return None
    if isinstance(blob, dict):
        uname = blob.get("username", "")
        if uname.lower() == username.lower() and (blob.get("id") or blob.get("pk")):
            return blob
        for v in blob.values():
            found = _find_user_in_blob(v, username, depth + 1)
            if found:
                return found
    elif isinstance(blob, list):
        for item in blob:
            found = _find_user_in_blob(item, username, depth + 1)
            if found:
                return found
    return None


def _normalize(u: dict) -> dict:
    followers = (
        u.get("follower_count") or u.get("edge_followed_by", {}).get("count") or 0
    )
    following = u.get("following_count") or u.get("edge_follow", {}).get("count") or 0
    total = (
        u.get("media_count")
        or u.get("edge_owner_to_timeline_media", {}).get("count")
        or 0
    )
    bio_links = u.get("bio_links") or []
    ext_url = u.get("external_url", "") or (
        bio_links[0].get("url", "") if bio_links else ""
    )
    pic = u.get("profile_pic_url_hd") or u.get("profile_pic_url") or ""
    return {
        "id": str(u.get("id") or u.get("pk") or ""),
        "username": u.get("username", ""),
        "full_name": u.get("full_name", ""),
        "biography": u.get("biography", ""),
        "external_url": ext_url,
        "followers": int(followers),
        "following": int(following),
        "total_posts": int(total),
        "is_private": bool(u.get("is_private", False)),
        "is_verified": bool(u.get("is_verified", False)),
        "profile_pic_url": fix_url(pic),
    }


# ─────────────────────────────────────────────────────────
# Post fetching
# ─────────────────────────────────────────────────────────


def fetch_posts(s: Session, user_id: str, limit: int) -> list:
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
        except Exception as e:
            print(f"\n  [WARN]   Network error: {e}")
            break

        if r.status_code == 401:
            print("\n  [ERROR]  401 -- session expired. Get a fresh sessionid.")
            break
        if r.status_code == 429:
            print("\n  [WARN]   Rate limited -- waiting 30s ...")
            time.sleep(30)
            continue
        if r.status_code not in (200, 201):
            print(f"\n  [WARN]   HTTP {r.status_code} from feed endpoint -- stopping.")
            break

        try:
            data = r.json()
        except Exception:
            print("\n  [WARN]   JSON parse error.")
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
    code = item.get("code") or item.get("shortcode", "")
    taken = item.get("taken_at", 0)
    dt = datetime.fromtimestamp(taken, tz=timezone.utc).isoformat() if taken else ""
    cap_obj = item.get("caption") or {}
    caption = cap_obj.get("text", "") if isinstance(cap_obj, dict) else str(cap_obj)

    media_type = item.get("media_type", 1)
    ptype = {2: "video/reel", 8: "carousel"}.get(media_type, "photo")

    urls = []
    if media_type == 8:
        for node in item.get("carousel_media", []):
            if node.get("media_type") == 2:
                vv = node.get("video_versions", [])
                if vv:
                    urls.append(("mp4", vv[0]["url"]))
            else:
                ic = node.get("image_versions2", {}).get("candidates", [])
                if ic:
                    urls.append(("jpg", ic[0]["url"]))
    elif media_type == 2:
        vv = item.get("video_versions", [])
        if vv:
            urls.append(("mp4", vv[0]["url"]))
        ic = item.get("image_versions2", {}).get("candidates", [])
        if ic:
            urls.append(("jpg", ic[0]["url"]))
    else:
        ic = item.get("image_versions2", {}).get("candidates", [])
        if ic:
            urls.append(("jpg", ic[0]["url"]))

    return {
        "index": idx,
        "shortcode": code,
        "type": ptype,
        "url": f"https://www.instagram.com/p/{code}/",
        "date_utc": dt,
        "caption": caption,
        "hashtags": re.findall(r"#(\w+)", caption),
        "mentions": re.findall(r"@(\w+)", caption),
        "likes": item.get("like_count", 0),
        "comments": item.get("comment_count", 0),
        "is_video": media_type == 2,
        "video_view_count": item.get("view_count"),
        "location": (item.get("location") or {}).get("name"),
        "tagged_users": [
            t.get("user", {}).get("username", "")
            for t in item.get("usertags", {}).get("in", [])
        ],
        "accessibility_caption": item.get("accessibility_caption", ""),
        "media_count": len(item.get("carousel_media", [])) or 1,
        "owner_username": item.get("user", {}).get("username", ""),
        "_media_urls": urls,
    }


def download_file(s: Session, url: str, dest: str, retries: int = 3) -> bool:
    url = fix_url(url)
    if not url.startswith("http"):
        print(f"    [WARN]   Skipping invalid URL: {url[:80]}")
        return False

    for attempt in range(1, retries + 1):
        try:
            r = s.get(url, stream=True, timeout=60)
            if r.status_code in (200, 201):
                tmp = dest + ".part"
                with open(tmp, "wb") as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                os.replace(tmp, dest)
                return True
            print(f"    [WARN]   HTTP {r.status_code}")
            return False
        except KeyboardInterrupt:
            if os.path.exists(dest + ".part"):
                os.remove(dest + ".part")
            raise
        except Exception as e:
            if attempt < retries:
                time.sleep(2 * attempt)
            else:
                print(f"    [WARN]   {e}")
    return False


# ─────────────────────────────────────────────────────────
# Orchestrator
# ─────────────────────────────────────────────────────────


def run(target: str, limit: int, output_dir: str, session_id: str):

    print("\n" + "---" * 18)
    print("  STEP 1 - Authenticating")
    print("---" * 18)

    if not session_id:
        print("""
  Get your sessionid:
  Chrome: F12 -> Application -> Cookies -> instagram.com -> sessionid
  Firefox: F12 -> Storage -> Cookies -> sessionid
""")
        session_id = input("  Paste sessionid value: ").strip()
    if not session_id:
        print("[ERROR]  sessionid is required.")
        sys.exit(1)

    session_id = unquote(session_id.strip())

    s = make_session(session_id)
    me = verify_login(s)
    if me:
        print(f"  [OK]  Logged in as @{me}")
    else:
        print("  [WARN]  Login check inconclusive.")

    SESSION_SAVE.parent.mkdir(exist_ok=True)
    SESSION_SAVE.write_text(session_id)

    print("\n" + "---" * 18)
    print(f"  STEP 2 - Profile @{target}")
    print("---" * 18)

    try:
        profile = get_profile(s, target)
    except ValueError as e:
        print(f"\n[ERROR]  {e}")
        sys.exit(1)
    except PermissionError as e:
        print(f"\n[ERROR]  {e}")
        sys.exit(1)
    except ConnectionError as e:
        print(f"\n[ERROR]  {e}")
        sys.exit(1)

    if profile["username"].lower() != target.lower():
        print(
            f"\n[ERROR]  Profile mismatch: expected @{target}, got @{profile['username']}."
        )
        sys.exit(1)
    if not profile["id"]:
        print(
            f"\n[ERROR]  Could not resolve user ID for @{target}. Try refreshing sessionid."
        )
        sys.exit(1)

    print(f"\n  [OK]  @{profile['username']}")
    safe_name = (profile["full_name"] or "").encode("ascii", "ignore").decode("ascii")
    print(f"      Name      : {safe_name or '(not retrieved)'}")
    print(f"      Followers : {profile['followers']:,}")
    print(f"      Posts     : {profile['total_posts']:,}")
    print(f"      Private   : {profile['is_private']}")

    if profile["is_private"]:
        print(f"\n[ERROR]  Private account -- cannot download.")
        sys.exit(1)

    raw = []
    if limit > 0:
        print(f"\n  [INFO]  Fetching post metadata...")
        raw = fetch_posts(s, profile["id"], limit)
        if not raw:
            print("  [ERROR]  No posts returned. Try refreshing your sessionid cookie.")
            sys.exit(1)
        print(f"  [OK]  {len(raw)} post(s) ready.\n")
    else:
        print(f"\n  [INFO]  Limit is 0; skipping post metadata fetch.")

    os.makedirs(output_dir, exist_ok=True)
    print(f"  [PATH]  {os.path.abspath(output_dir)}\n")

    if profile.get("profile_pic_url"):
        print(f"  [INFO]  Downloading profile picture...")
        dest = os.path.join(output_dir, "profile_pic.jpg")
        if download_file(s, profile["profile_pic_url"], dest):
            print(f"  [OK]  Profile picture saved.")
        else:
            print(f"  [WARN]  Failed to download profile picture.")

    metadata_list = []
    downloaded = skipped = 0

    for i, item in enumerate(raw):
        idx = i + 1
        meta = parse_post(item, idx)
        urls = meta.pop("_media_urls")
        sc = meta["shortcode"] or f"post_{idx}"

        print(
            f"  [{idx:>3}/{len(raw)}]  {meta['type']:<14}  {sc}  "
            f"{meta['date_utc'][:10]}  ...",
            end=" ",
            flush=True,
        )

        ok = 0
        for j, (ext, url) in enumerate(urls):
            suffix = f"_{j + 1}" if len(urls) > 1 else ""
            dest = os.path.join(output_dir, f"{sc}{suffix}.{ext}")
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

    json_path = os.path.join(output_dir, "metadata.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "downloaded_at": datetime.now(timezone.utc).isoformat(),
                "downloaded_by": me or "unknown",
                "target_username": target,
                "full_name": profile["full_name"],
                "biography": profile["biography"],
                "external_url": profile["external_url"],
                "is_verified": profile["is_verified"],
                "profile_pic_url": profile.get("profile_pic_url", ""),
                "followers": profile["followers"],
                "following": profile["following"],
                "total_posts": profile["total_posts"],
                "requested": limit,
                "downloaded": downloaded,
                "skipped": skipped,
                "posts": metadata_list,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    print(f"\n{'-' * 54}")
    print(f"  [OK]  Downloaded : {downloaded}   Skipped : {skipped}")
    print(f"  [META]  Metadata   : {os.path.abspath(json_path)}")
    print(f"{'-' * 54}\n")


# ─────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────


def main():
    p = argparse.ArgumentParser(
        description="Download posts from any public Instagram profile."
    )
    p.add_argument("--target", "-t", default=None)
    p.add_argument("--limit", "-l", type=int, default=None)
    p.add_argument("--output", "-o", default=None)
    p.add_argument(
        "--session-id", "-s", default=None, help="Instagram sessionid cookie value"
    )
    args = p.parse_args()

    print("=" * 54)
    print("    Instagram Post Downloader  (Cookie Edition)")
    print("=" * 54)

    target = args.target
    if not target:
        target = input("\nDownload FROM which username: ").strip().lstrip("@")
    if not target:
        print("[ERROR]  Username required.")
        sys.exit(1)

    limit = args.limit
    if limit is None:
        raw = input("How many posts? (default 10): ").strip()
        limit = int(raw) if raw.isdigit() and int(raw) > 0 else 10

    session_id = args.session_id
    if not session_id and SESSION_SAVE.exists():
        session_id = unquote(SESSION_SAVE.read_text().strip())
        print(f"\n  [OK]  Using saved sessionid  (delete {SESSION_SAVE} to reset)\n")

    run(
        target,
        limit,
        output_dir=args.output or f"./{sanitize(target)}_posts",
        session_id=session_id,
    )


if __name__ == "__main__":
    main()
