the backend repo of social media plateform

## Suggestions engine

Suggested users are ranked in `services/suggestionService.js` using mutual follows,
interest similarity, creator activity, and social proof.

Optional Python reranking is available through `ml/suggestion_rerank.py`.

Environment variables:

- `SUGGESTIONS_PYTHON_ENABLED` (`true`/`false`, default: `true`)
- `SUGGESTIONS_PYTHON_EXECUTABLE` (default: `python`)
- `SUGGESTIONS_PYTHON_TIMEOUT_MS` (default: `2000`)

## Mail service integration

This backend now sends emails through a separate mail API service (NodeMailer microservice)
instead of creating SMTP connections directly.

Required environment variable:

- `MAIL_SERVICE_BASE_URL` (default: `http://localhost:5500`)

Expected endpoint on mail service:

- `POST /api/mail/send`
