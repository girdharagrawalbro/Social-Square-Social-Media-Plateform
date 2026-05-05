#!/usr/bin/env python3
"""Debug script — shows exactly what Instagram returns for each endpoint."""

import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote

try:
    import requests
except ImportError:
    print("pip install requests")
    sys.exit(1)

SESSION_SAVE = Path.home() / ".instaloader_sessions" / "cookie_session.txt"
USERNAME = "_sejalpwr_"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "X-IG-App-ID": "936619743392459",
    "Referer": "https://www.instagram.com/",
    "Origin": "https://www.instagram.com",
}

# ── Load & decode session ID ───────────────────────────────────────────────────
if SESSION_SAVE.exists():
    raw = SESSION_SAVE.read_text().strip()
    session_id = unquote(raw)
    print(f"[INFO] Loaded sessionid from file")
    if raw != session_id:
        print(f"[FIX]  URL-decoded: %3A → :  (was broken, now fixed)")
        SESSION_SAVE.write_text(session_id)  # overwrite with clean version
else:
    session_id = unquote(input("Paste sessionid: ").strip())

print(f"[INFO] Session ID (first 30 chars): {session_id[:30]}...")
print(f"[INFO] Contains colons (good sign): {':' in session_id}")

# ── Build session WITHOUT pre-setting csrftoken ───────────────────────────────
s = requests.Session()
s.cookies.set("sessionid", session_id, domain=".instagram.com")
s.cookies.set("ig_did", "00000000-0000-0000-0000-000000000000", domain=".instagram.com")
s.cookies.set("ig_nrcb", "1", domain=".instagram.com")
s.headers.update(HEADERS)

# ── Fetch homepage to get real CSRF token ─────────────────────────────────────
print("\n[SETUP] Fetching homepage for CSRF token...")
r = s.get("https://www.instagram.com/", timeout=15)

if "mid" in r.cookies:
    s.cookies.set("mid", r.cookies["mid"], domain=".instagram.com")
    print(f"[OK]   Got mid cookie: {r.cookies['mid'][:20]}...")

token = None
for pattern in [
    r'"csrf_token"\s*:\s*"([a-zA-Z0-9]{20,})"',
    r'"csrfToken"\s*:\s*"([a-zA-Z0-9]{20,})"',
]:
    m = re.search(pattern, r.text)
    if m:
        token = m.group(1)
        break

if token:
    s.cookies.set("csrftoken", token, domain=".instagram.com")
    s.headers["X-CSRFToken"] = token
    print(f"[OK]   CSRF token: {token[:20]}...")
else:
    print("[WARN] No CSRF token found in homepage — session may be expired or blocked")

print(f"\n[INFO] All cookies: {dict(s.cookies)}")
print("=" * 60)

# ── Test 1: Login check ───────────────────────────────────────────────────────
print("\n[TEST 1] Login check")
r = s.get(
    "https://www.instagram.com/api/v1/accounts/current_user/?edit=true",
    timeout=15,
)
print(f"  Status: {r.status_code}")
print(f"  Body:   {r.text[:300]}")

# ── Test 2: Endpoint 1 ────────────────────────────────────────────────────────
print(f"\n[TEST 2] Endpoint 1 — web_profile_info")
r = s.get(
    "https://www.instagram.com/api/v1/users/web_profile_info/",
    params={"username": USERNAME},
    headers={"X-Requested-With": "XMLHttpRequest"},
    timeout=20,
)
print(f"  Status: {r.status_code}")
print(f"  Body:   {r.text[:500]}")

# ── Test 3: Endpoint 2 ────────────────────────────────────────────────────────
print(f"\n[TEST 3] Endpoint 2 — ?__a=1&__d=dis")
r = s.get(
    f"https://www.instagram.com/{USERNAME}/",
    params={"__a": "1", "__d": "dis"},
    timeout=20,
)
print(f"  Status: {r.status_code}")
print(f"  Body:   {r.text[:500]}")

# ── Test 4: Raw profile page ──────────────────────────────────────────────────
print(f"\n[TEST 4] Raw profile page")
r = s.get(f"https://www.instagram.com/{USERNAME}/", timeout=20)
print(f"  Status:       {r.status_code}")
print(f"  Final URL:    {r.url}")
print(f"  Page length:  {len(r.text):,} chars")

found = r.text.count(USERNAME)
print(f"  '{USERNAME}' appears {found} time(s) in page source")

# Show context around EVERY mention (not just first)
for i, m in enumerate(re.finditer(re.escape(USERNAME), r.text)):
    idx = m.start()
    ctx = r.text[max(0, idx - 120) : idx + 250]
    print(f"\n  --- Mention #{i + 1} (pos {idx}) ---")
    print(f"  ...{ctx}...")
    if i >= 4:  # show up to 5 mentions
        print(f"  (+ {found - 5} more mentions not shown)")
        break

# Check for error indicators
if "PolarisErrorRoot" in r.text:
    print(
        "\n  [!] Page contains 'PolarisErrorRoot' — Instagram returned an error page."
    )
    print("      This usually means your session is expired or being blocked.")
if "login" in r.url.lower():
    print("\n  [!] Redirected to login page — session is definitely expired.")

# ── Test 5: GraphQL ───────────────────────────────────────────────────────────
print(f"\n[TEST 5] GraphQL endpoint")
r = s.get(
    "https://www.instagram.com/graphql/query/",
    params={
        "query_hash": "e7e2f4da4b02303f74f0841279e52d76",
        "variables": json.dumps({"username": USERNAME}),
    },
    timeout=20,
)
print(f"  Status: {r.status_code}")
print(f"  Body:   {r.text[:400]}")

# ── Save full page ────────────────────────────────────────────────────────────
with open("ig_debug_page.html", "w", encoding="utf-8") as f:
    f.write(r.text)

# Re-fetch profile page to save (test 5 overwrote r)
r_page = s.get(f"https://www.instagram.com/{USERNAME}/", timeout=20)
with open("ig_debug_page.html", "w", encoding="utf-8") as f:
    f.write(r_page.text)

print(f"\n[SAVED] Full profile page → ig_debug_page.html  ({len(r_page.text):,} bytes)")
print("  Open it in a text editor and Ctrl+F for '_sejalpwr_' to inspect the data.")
print("\n[DONE]")
