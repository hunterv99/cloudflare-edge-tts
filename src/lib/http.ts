export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

type ErrorCode =
  | "INVALID_CONTENT_TYPE"
  | "INVALID_REQUEST"
  | "METHOD_NOT_ALLOWED"
  | "NOT_FOUND"
  | "TTS_UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

function buildHeaders(
  headers: HeadersInit = {},
  defaults: HeadersInit = {}
): Headers {
  const merged = new Headers(defaults);
  new Headers(headers).forEach((value, key) => {
    merged.set(key, value);
  });
  return merged;
}

export function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: buildHeaders(init.headers, {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    }),
  });
}

export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string
) {
  return json(
    {
      error: { code, message },
    },
    { status }
  );
}

export function noContent() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export function withCors(response: Response) {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: buildHeaders(response.headers, CORS_HEADERS),
  });
}
