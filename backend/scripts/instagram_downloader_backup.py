#!/usr/bin/env python3
"""
Instagram Post Downloader — JSON-to-Local Edition
================================================
Downloads media using a pre-scraped JSON data blob.
Usage:
    python instagram_downloader.py --json data.json --output ./downloads
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
    from curl_cffi import requests
    from curl_cffi.requests import Session
    IMPERSONATE = "chrome"
except ImportError:
    print("[ERROR] Missing: curl-cffi. Run: pip install curl-cffi")
    sys.exit(1)

def sanitize(name: str) -> str:
    return "".join(c for c in name if c.isalnum() or c in ("_", "-")).rstrip()

def fix_url(raw: str) -> str:
    if not raw: return raw
    return raw.replace("\\/", "/").replace("\\u002F", "/").replace("\\u0026", "&")

def download_file(s: Session, url: str, dest: str, retries: int = 3) -> bool:
    url = fix_url(url)
    if not url or not url.startswith("http"): return False
    for attempt in range(1, retries + 1):
        try:
            r = s.get(url, stream=True, timeout=60)
            if r.status_code in (200, 201):
                tmp = dest + ".part"
                with open(tmp, "wb") as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        if chunk: f.write(chunk)
                os.replace(tmp, dest)
                return True
        except Exception as e:
            if attempt < retries: time.sleep(2 * attempt)
    return False

def parse_json_post(item: dict) -> dict:
    """Extracts media URLs from the provided JSON post format."""
    code = item.get("shortCode") or item.get("id", "unknown")
    urls = []
    
    # Video handling
    if item.get("videoUrl"):
        urls.append(("mp4", item["videoUrl"]))
    
    # Image handling (fallback or primary)
    if item.get("displayUrl"):
        urls.append(("jpg", item["displayUrl"]))
    
    # If it's an image-only type but has 'images' array
    for img in item.get("images", []):
        urls.append(("jpg", img))

    return {
        "shortcode": code,
        "type": item.get("type", "Post"),
        "date_utc": item.get("timestamp", ""),
        "caption": item.get("caption", ""),
        "likes": item.get("likesCount", 0),
        "views": item.get("videoViewCount", 0),
        "_media_urls": urls
    }

def run_from_json(s: Session, profile_data: dict, output_root: str, limit: int):
    target = profile_data.get("username", "unknown")
    output_dir = os.path.join(output_root, sanitize(target))
    os.makedirs(output_dir, exist_ok=True)

    print(f"\nProcessing @{target} from JSON...")
    print(f"  Followers: {profile_data.get('followersCount', 0):,}")
    print(f"  Directory: {output_dir}")

    # 1. Profile Picture
    if profile_data.get("profilePicUrlHD"):
        print("  [INFO] Downloading profile picture...")
        download_file(s, profile_data["profilePicUrlHD"], os.path.join(output_dir, "profile_pic.jpg"))

    # 2. Combine Posts & IGTV
    all_raw = profile_data.get("latestPosts", []) + profile_data.get("latestIgtvVideos", [])
    if limit:
        all_raw = all_raw[:limit]

    metadata_list = []
    for i, item in enumerate(all_raw):
        meta = parse_json_post(item)
        urls = meta.pop("_media_urls")
        sc = meta["shortcode"]

        print(f"  [{i+1}/{len(all_raw)}] Downloading {sc}...", end=" ", flush=True)
        
        ok = 0
        for j, (ext, url) in enumerate(urls):
            suffix = f"_{j+1}" if len(urls) > 1 else ""
            dest = os.path.join(output_dir, f"{sc}{suffix}.{ext}")
            if download_file(s, url, dest):
                ok += 1
        
        if ok > 0:
            metadata_list.append(meta)
            print(f"[OK] ({ok} files)")
        else:
            print("[FAIL]")
        
        time.sleep(0.5)

    # Save local metadata
    with open(os.path.join(output_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump({"profile": profile_data, "items": metadata_list}, f, indent=2, ensure_ascii=False)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", "-j", required=True, help="Path to the JSON file")
    parser.add_argument("--limit", "-l", type=int, default=None)
    parser.add_argument("--output", "-o", default="./downloads")
    args = parser.parse_args()

    if not os.path.exists(args.json):
        print(f"Error: {args.json} not found.")
        return

    with open(args.json, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Handle both single object and list of objects
    profiles = data if isinstance(data, list) else [data]
    
    s = Session(impersonate=IMPERSONATE)
    for profile in profiles:
        try:
            run_from_json(s, profile, args.output, args.limit)
        except Exception as e:
            print(f"Error processing profile: {e}")

if __name__ == "__main__":
    main()
