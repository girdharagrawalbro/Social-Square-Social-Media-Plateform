import json
import math
import sys


def clamp(value, min_value=0.0, max_value=1.0):
    return max(min_value, min(max_value, value))


def sigmoid(x):
    return 1.0 / (1.0 + math.exp(-x))


def rerank(candidates):
    scored = []
    for c in candidates:
        base = float(c.get("score", 0.0))
        mutual = float(c.get("mutualScore", 0.0))
        interest = float(c.get("interestScore", 0.0))
        activity = float(c.get("activityScore", 0.0))
        social = float(c.get("socialScore", 0.0))
        freshness = float(c.get("freshnessScore", 0.0))

        followers = float(c.get("followersCount", 0.0))
        following = float(c.get("followingCount", 0.0))

        follower_ratio = (followers + 1.0) / (following + 5.0)
        ratio_signal = clamp(sigmoid((follower_ratio - 1.2) * 1.4))

        # Blend linear score with non-linear behavior to better separate close candidates.
        adjusted = (
            base * 0.34
            + mutual * 0.24
            + interest * 0.20
            + activity * 0.14
            + social * 0.06
            + freshness * 0.02
            + ratio_signal * 0.10
        )
        adjusted = clamp(adjusted)

        scored.append({
            "userId": str(c.get("userId")),
            "score": round(adjusted, 6),
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored


def main():
    raw = sys.stdin.read()
    if not raw.strip():
        print(json.dumps({"ranked": []}))
        return

    payload = json.loads(raw)
    candidates = payload.get("candidates", []) or []
    limit = int(payload.get("limit", len(candidates)))

    ranked = rerank(candidates)
    ranked = ranked[: max(1, limit)]

    print(json.dumps({"ranked": ranked}))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        sys.exit(1)
