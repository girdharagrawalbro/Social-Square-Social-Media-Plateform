the backend repo of social media plateform

## Suggestions engine

Suggested users are ranked in `services/suggestionService.js` using mutual follows,
interest similarity, creator activity, and social proof.

Optional Python reranking is available through `ml/suggestion_rerank.py`.

Environment variables:

- `SUGGESTIONS_PYTHON_ENABLED` (`true`/`false`, default: `true`)
- `SUGGESTIONS_PYTHON_EXECUTABLE` (default: `python`)
- `SUGGESTIONS_PYTHON_TIMEOUT_MS` (default: `2000`)
