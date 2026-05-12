# Cloudflare Edge TTS Worker Design

## Summary

Build a minimal Cloudflare Worker that exposes Microsoft Edge TTS over HTTP using [`edge-tts-universal`](https://github.com/travisvn/edge-tts-universal). The Worker must support browser clients, stream `audio/mpeg` responses directly, and provide a voices listing endpoint.

## Goals

- Expose a streaming TTS endpoint via `POST /tts`
- Accept `application/json` request bodies
- Support `text` and `voice` parameters
- Default `voice` to `zh-CN-Xiaoxiao:DragonHDFlashLatestNeural`
- Expose `GET /voices` to list all available voices
- Expose `GET /health` for lightweight health checks
- Support browser access with CORS
- Validate behavior against the real Cloudflare runtime using `wrangler dev --remote`

## Non-Goals

- Authentication
- Rate limiting
- Voice list caching
- SSML support
- Subtitle or word-boundary output
- Frontend UI

## API Design

### `POST /tts`

Request:

```json
{
  "text": "Hello world",
  "voice": "zh-CN-Xiaoxiao:DragonHDFlashLatestNeural"
}
```

Rules:

- Method must be `POST`
- `Content-Type` must be `application/json`
- `text` is required and must be a non-empty string after trimming
- `voice` is optional and must be a string when provided
- If `voice` is omitted, use `zh-CN-Xiaoxiao:DragonHDFlashLatestNeural`

Success response:

- Status: `200`
- `Content-Type: audio/mpeg`
- Response body is a streamed MPEG audio response

Streaming behavior:

- The Worker creates an `edge-tts-universal` streaming session
- Audio chunks are forwarded to a Worker `ReadableStream` as they arrive
- The client can start playback before the full synthesis completes
- If the upstream stream fails after headers are sent, the Worker closes the response stream instead of mixing JSON into the audio body

### `GET /voices`

Success response:

- Status: `200`
- `Content-Type: application/json`

Body shape:

```json
{
  "voices": []
}
```

Behavior:

- Fetch the latest available voices from `edge-tts-universal`
- Do not cache results in this version

### `GET /health`

Success response:

- Status: `200`
- `Content-Type: application/json`

Body shape:

```json
{
  "ok": true
}
```

Behavior:

- Only reports Worker availability
- Does not depend on a successful upstream TTS call

## Error Model

Errors return JSON:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "text is required"
  }
}
```

Error classes:

- `400 INVALID_CONTENT_TYPE`
- `400 INVALID_REQUEST`
- `404 NOT_FOUND`
- `405 METHOD_NOT_ALLOWED`
- `502 TTS_UPSTREAM_ERROR`
- `500 INTERNAL_ERROR`

Error mapping:

- Invalid body shape or missing `text` returns `400`
- Unsupported method for a known route returns `405`
- Unknown route returns `404`
- TTS provider or synthesis failures before the response starts return `502`
- Unexpected internal failures return `500`

## CORS

The Worker must support browser clients directly.

Requirements:

- Handle `OPTIONS` preflight requests
- Return `Access-Control-Allow-Origin`
- Return `Access-Control-Allow-Methods`
- Return `Access-Control-Allow-Headers`

This version can allow broad browser access. Tightening origin policy is a later concern and not part of this scope.

## Architecture

### Entry Layer

`src/index.ts`

- Receives all requests
- Handles routing
- Applies CORS and shared error handling

### Handler Layer

`src/handlers/tts.ts`
`src/handlers/voices.ts`
`src/handlers/health.ts`

- One handler per route
- Keeps route logic thin and focused

### Service Layer

`src/lib/tts.ts`

- Wraps `edge-tts-universal`
- Converts the async audio generator into a Worker `ReadableStream`
- Centralizes default voice handling

### HTTP Utilities

`src/lib/http.ts`

- JSON responses
- Error responses
- Body parsing helpers
- CORS helpers

## Runtime and Tooling

- Use a native Cloudflare Worker without an additional routing framework
- Use `wrangler.jsonc` as the Worker configuration file
- Set `compatibility_date` to the current date at implementation time
- Generate Worker types after configuration changes when needed

## Verification Strategy

### Automated Tests

Tests should focus on observable Worker behavior and avoid real upstream TTS calls.

Minimum coverage:

- `POST /tts` returns `200` and `audio/mpeg` when `text` is valid and `voice` is omitted
- `POST /tts` forwards a provided `voice`
- `POST /tts` returns `400` when `text` is missing
- `GET /voices` returns `200`
- `GET /health` returns `200` with `{ "ok": true }`
- `OPTIONS` returns the expected CORS headers
- Unknown routes return `404`

Testing approach:

- Stub the TTS service wrapper instead of calling Microsoft during unit or integration tests
- Verify streaming response construction at the Worker boundary

### Real Runtime Validation

Functional verification must use the real Cloudflare runtime via `wrangler dev --remote`.

Constraints:

- Use the existing local Wrangler credentials
- Target the Cloudflare account `1f1d1678a2413a54c944b3081bab5c84`
- Do not commit credentials or secrets into the repository

Validation goals:

- Confirm the Worker starts in remote mode
- Confirm `POST /tts` streams playable `audio/mpeg`
- Confirm `GET /voices` works in the real runtime
- Confirm browser-oriented CORS behavior works as expected

## Tradeoffs

Chosen approach: native Worker plus direct `edge-tts-universal` integration.

Why this approach:

- Lowest complexity for a three-route service
- Cleanest path for direct audio streaming
- Minimal framework overhead for an otherwise empty repository

Deferred tradeoffs:

- Voices caching can be added later if latency or upstream pressure becomes an issue
- A routing framework can be introduced later if the API surface expands materially

## Open Implementation Notes

- The implementation should prefer the library's streaming API rather than one-shot synthesis
- The Worker should keep request validation strict and response shaping minimal
- The repository should include a README covering local development, remote validation, and deployment
