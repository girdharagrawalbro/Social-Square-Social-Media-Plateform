#!/usr/bin/env python3
"""
================================================================================
Instagram Followers & Following Graph Scraper (3000 Limit Edition)
================================================================================
Extracts BOTH Followers and Following for target Instagram profiles in a single run.
Includes safe pagination, live autosave, rate-limit protection, and relationship analytics.
"""

import argparse
import csv
import json
import os
import random
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote

# ── Dependency check ──────────────────────────────────────────────────────────
try:
    from curl_cffi import requests
    from curl_cffi.requests import Session

    IMPERSONATE = "chrome"
except ImportError:
    print("[ERROR] Missing: curl-cffi")
    print("    Run: pip install curl-cffi")
    sys.exit(1)

SESSION_SAVE = Path.home() / ".instaloader_sessions" / "cookie_session.txt"

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


def make_session(session_id: str) -> Session:
    session_id = unquote(session_id.strip())
    s = Session(impersonate=IMPERSONATE)
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
    except Exception as e:
        print(f"  [WARN]  Homepage bootstrap warning: {e}")

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


def get_profile(s: Session, username: str) -> dict:
    """Fetch target user's basic profile and numeric ID."""
    try:
        print(f"  [INFO]  Looking up @{username}...", end=" ", flush=True)
        r = s.get(
            "https://www.instagram.com/api/v1/users/web_profile_info/",
            params={"username": username},
            headers={"x-requested-with": "XMLHttpRequest"},
            timeout=20,
        )
        if r.status_code in (200, 201):
            data = r.json()
            u = (data.get("data") or {}).get("user") or data.get("user") or {}
            if u and (u.get("id") or u.get("pk")):
                print("[OK]")
                return {
                    "id": str(u.get("id") or u.get("pk")),
                    "username": u.get("username", username),
                    "full_name": u.get("full_name", ""),
                    "is_private": bool(u.get("is_private")),
                    "is_verified": bool(u.get("is_verified")),
                    "followers_count": (u.get("edge_followed_by") or {}).get("count") or u.get("follower_count", 0),
                    "following_count": (u.get("edge_follow") or {}).get("count") or u.get("following_count", 0),
                    "profile_pic_url": u.get("profile_pic_url_hd") or u.get("profile_pic_url", ""),
                }
        if r.status_code == 404:
            raise ValueError(f"@{username} not found on Instagram.")
    except Exception as e:
        print(f"[FAIL] ({e})")

    # Fallback GraphQL
    try:
        print(f"  [INFO]  Trying GraphQL lookup...", end=" ", flush=True)
        r = s.post(
            "https://www.instagram.com/graphql/query",
            data={
                "variables": json.dumps({"username": username, "include_reel": False}),
                "doc_id": "7897892850295284",
            },
            headers={
                "content-type": "application/x-www-form-urlencoded",
                "x-fb-friendly-name": "PolarisProfilePageContentQuery",
            },
            timeout=20,
        )
        if r.status_code == 200:
            data = r.json()
            u = data.get("data", {}).get("user") or {}
            if u and (u.get("id") or u.get("pk")):
                print("[OK]")
                return {
                    "id": str(u.get("id") or u.get("pk")),
                    "username": u.get("username", username),
                    "full_name": u.get("full_name", ""),
                    "is_private": bool(u.get("is_private")),
                    "is_verified": bool(u.get("is_verified")),
                    "followers_count": (u.get("edge_followed_by") or {}).get("count") or 0,
                    "following_count": (u.get("edge_follow") or {}).get("count") or 0,
                    "profile_pic_url": u.get("profile_pic_url_hd") or u.get("profile_pic_url", ""),
                }
    except Exception as e:
        print(f"[FAIL] ({e})")

    raise ValueError(f"Could not retrieve profile info for @{username}.")


def save_exports(
    username: str,
    relation_type: str,
    data: list,
    output_dir: Path,
    export_json: bool = True,
    export_csv: bool = True,
    silent: bool = False,
):
    output_dir.mkdir(parents=True, exist_ok=True)
    base_name = f"{sanitize(username)}_{relation_type}"

    if export_json:
        json_path = output_dir / f"{base_name}.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "target_user": username,
                    "relation_type": relation_type,
                    "count": len(data),
                    "scraped_at": datetime.now(timezone.utc).isoformat(),
                    "users": data,
                },
                f,
                indent=2,
                ensure_ascii=False,
            )
        if not silent:
            print(f"  [SAVED] JSON: {json_path}")

    if export_csv and data:
        csv_path = output_dir / f"{base_name}.csv"
        fieldnames = ["id", "username", "full_name", "is_private", "is_verified", "profile_pic_url"]
        with open(csv_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for row in data:
                writer.writerow(row)
        if not silent:
            print(f"  [SAVED] CSV : {csv_path}")


def fetch_relationship_list(
    s: Session,
    user_id: str,
    username: str,
    relation_type: str,
    limit: int = 3000,
    output_dir: Path = None,
) -> list:
    """
    Fetch up to `limit` (e.g. 3000) followers or following with smart rate-limiting and autosave.
    """
    results = []
    seen_ids = set()
    next_max_id = None
    has_more = True
    page = 1

    label = "Followers" if relation_type == "followers" else "Following"
    print(f"\n  [FETCHING] {label.upper()} for @{username} (Target: {limit if limit > 0 else 'All'})...")

    while has_more:
        if limit > 0 and len(results) >= limit:
            break

        fetch_count = 50
        if limit > 0:
            remaining = limit - len(results)
            fetch_count = min(50, remaining)

        url = f"https://www.instagram.com/api/v1/friendships/{user_id}/{relation_type}/"
        params = {
            "count": str(fetch_count),
            "search_surface": "follow_list_page",
        }
        if next_max_id:
            params["max_id"] = str(next_max_id)

        try:
            r = s.get(
                url,
                params=params,
                headers={
                    "x-requested-with": "XMLHttpRequest",
                    "referer": f"https://www.instagram.com/{username}/{relation_type}/",
                },
                timeout=25,
            )

            # Handle Rate Limiting
            if r.status_code == 429:
                wait_time = random.uniform(20.0, 35.0)
                print(f"\n  [WARN] Rate limit hit (429). Pausing for {wait_time:.1f}s to protect session...")
                time.sleep(wait_time)
                continue

            if r.status_code != 200:
                print(f"\n  [WARN] HTTP {r.status_code} received on page {page}. Stopping {relation_type} stream.")
                break

            data = r.json()
            users_batch = data.get("users", [])

            if not users_batch:
                has_more = False
                break

            new_count = 0
            for u in users_batch:
                uid = str(u.get("pk") or u.get("id"))
                if uid in seen_ids:
                    continue
                seen_ids.add(uid)

                item = {
                    "id": uid,
                    "username": u.get("username", ""),
                    "full_name": u.get("full_name", ""),
                    "is_private": bool(u.get("is_private")),
                    "is_verified": bool(u.get("is_verified")),
                    "profile_pic_url": u.get("profile_pic_url", ""),
                }
                results.append(item)
                new_count += 1

                if limit > 0 and len(results) >= limit:
                    break

            next_max_id = data.get("next_max_id")
            has_more = bool(next_max_id and data.get("big_list", True) and (limit == 0 or len(results) < limit))

            percent_str = f"({(len(results) / limit * 100):.1f}%)" if limit > 0 else ""
            print(f"    Page {page:2d}: +{new_count:2d} users | Total: {len(results):,}/{limit:,} {percent_str}", flush=True)

            # Periodic autosave every 200 items
            if output_dir and len(results) % 200 == 0:
                save_exports(username, relation_type, results, output_dir, silent=True)

            if has_more:
                page += 1
                # Small breathing pause every 15 pages to keep Instagram happy
                if page % 15 == 0:
                    cooldown = random.uniform(4.0, 7.0)
                    print(f"    [PAUSE] Cool-down pause ({cooldown:.1f}s) to prevent throttling...")
                    time.sleep(cooldown)
                else:
                    time.sleep(random.uniform(0.8, 1.8))

        except Exception as e:
            print(f"\n  [ERROR] Page {page} error: {e}")
            break

    # Final save
    if output_dir:
        save_exports(username, relation_type, results, output_dir)

    print(f"  [DONE] Collected {len(results):,} {label}.\n")
    return results


def analyze_relations(username: str, followers: list, following: list, output_dir: Path):
    """Generate comparative summary between followers & following."""
    follower_map = {u["username"].lower(): u for u in followers}
    following_map = {u["username"].lower(): u for u in following}

    mutuals = [u for uname, u in following_map.items() if uname in follower_map]
    not_following_back = [u for uname, u in following_map.items() if uname not in follower_map]
    fans = [u for uname, u in follower_map.items() if uname not in following_map]

    summary = {
        "target_user": username,
        "total_followers_scraped": len(followers),
        "total_following_scraped": len(following),
        "mutual_follows_count": len(mutuals),
        "not_following_back_count": len(not_following_back),
        "fans_count": len(fans),
        "mutual_users": [u["username"] for u in mutuals],
        "not_following_back_users": [u["username"] for u in not_following_back],
        "fans_users": [u["username"] for u in fans],
    }

    summary_file = output_dir / f"{sanitize(username)}_relationship_summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print("-" * 60)
    print(f"  RELATIONSHIP ANALYSIS FOR @{username}")
    print("-" * 60)
    print(f"  • Followers Scraped   : {len(followers):,}")
    print(f"  • Following Scraped   : {len(following):,}")
    print(f"  • Mutual Follows      : {len(mutuals):,}")
    print(f"  • Don't Follow Back   : {len(not_following_back):,}")
    print(f"  • Fans (You don't follow back): {len(fans):,}")
    print(f"  [SAVED] Analysis: {summary_file}")
    print("-" * 60)


def get_session_id() -> str:
    if SESSION_SAVE.exists():
        try:
            saved = SESSION_SAVE.read_text(encoding="utf-8").strip()
            if saved:
                print(f"  [INFO]  Using saved session from {SESSION_SAVE}")
                return saved
        except Exception:
            pass

    env_session = os.getenv("INSTAGRAM_SESSIONID", "").strip()
    if env_session:
        return env_session

    print("\n  [SESSION] No saved session found.")
    print("  Paste sessionid from browser cookies (DevTools -> Application -> Cookies -> sessionid):")
    sid = input("  Paste sessionid: ").strip()

    if sid:
        SESSION_SAVE.parent.mkdir(parents=True, exist_ok=True)
        try:
            SESSION_SAVE.write_text(sid, encoding="utf-8")
            print(f"  [SAVED] Session cached at: {SESSION_SAVE}")
        except Exception:
            pass

    return sid


def parse_args():
    parser = argparse.ArgumentParser(
        description="Instagram Followers & Following Graph Scraper (Default: Both, Limit: 3000)",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument(
        "-u",
        "--usernames",
        nargs="+",
        help="Target Instagram username(s)",
    )
    parser.add_argument(
        "-m",
        "--mode",
        choices=["both", "followers", "following"],
        default="both",
        help="Fetch mode: 'both' (default), 'followers', or 'following'",
    )
    parser.add_argument(
        "-l",
        "--limit",
        type=int,
        default=3000,
        help="Max items to fetch per list (default: 3000, 0 for all)",
    )
    parser.add_argument(
        "--sessionid",
        help="Instagram sessionid cookie",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        default="./instagram_data",
        help="Output folder (default: ./instagram_data)",
    )
    return parser.parse_args()


def main():
    print("=" * 60)
    print("  Instagram Graph Scraper (Followers + Following | Limit: 3000)")
    print("=" * 60)

    args = parse_args()
    session_id = args.sessionid or get_session_id()
    if not session_id:
        print("[ERROR] sessionid is required.")
        sys.exit(1)

    s = make_session(session_id)
    logged_in_as = verify_login(s)
    if logged_in_as:
        print(f"  [AUTH]  Logged in as: @{logged_in_as}")
    else:
        print("  [WARN]  Could not verify login. Proceeding with cookies...")

    usernames = []
    if args.usernames:
        usernames = args.usernames
    else:
        print()
        raw = input("Enter target username(s) (comma or space separated): ").strip()
        if not raw:
            print("[ERROR] No username entered.")
            sys.exit(1)
        usernames = [u.strip().lstrip("@") for u in re.split(r"[, ]+", raw) if u.strip()]

    limit = args.limit
    if not args.usernames:
        limit_input = input(f"Limit for each list (default: {limit}, 0 for unlimited): ").strip()
        if limit_input.isdigit():
            limit = int(limit_input)

    output_dir = Path(args.output_dir)

    print(f"\n[CONFIG] Targets: {', '.join(['@' + u for u in usernames])}")
    print(f"[CONFIG] Fetching: BOTH Followers AND Following (Limit: {limit:,} each)")
    print(f"[CONFIG] Output Dir: {output_dir.resolve()}\n")

    for username in usernames:
        print("=" * 60)
        print(f"  STARTING PROFILE: @{username}")
        print("=" * 60)

        try:
            profile = get_profile(s, username)
        except Exception as err:
            print(f"  [ERROR] {err}")
            continue

        print(f"  Name       : {profile['full_name']}")
        print(f"  User ID    : {profile['id']}")
        print(f"  Followers  : {profile['followers_count']:,}")
        print(f"  Following  : {profile['following_count']:,}")
        print(f"  Private    : {profile['is_private']}")

        target_dir = output_dir / sanitize(username)

        # 1. Fetch Followers
        followers = []
        if args.mode in ("both", "followers"):
            followers = fetch_relationship_list(
                s=s,
                user_id=profile["id"],
                username=username,
                relation_type="followers",
                limit=limit,
                output_dir=target_dir,
            )

        # 2. Fetch Following
        following = []
        if args.mode in ("both", "following"):
            following = fetch_relationship_list(
                s=s,
                user_id=profile["id"],
                username=username,
                relation_type="following",
                limit=limit,
                output_dir=target_dir,
            )

        # 3. Relationship cross-analysis if both fetched
        if followers and following:
            analyze_relations(username, followers, following, target_dir)

    print("\n" + "=" * 60)
    print("  ALL SCRAPING COMPLETED SUCCESSFULLY!")
    print(f"  Files saved in: {output_dir.resolve()}")
    print("=" * 60)


if __name__ == "__main__":
    main()
