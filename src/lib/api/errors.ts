// Typed errors an Astro API route can throw and have apiHandler() (handler.ts)
// turn into the right HTTP response — replaces Fastify's setErrorHandler
// (server/src/app.ts), which caught anything thrown by a route handler and
// applied this same status/message split automatically. There is no
// framework-level equivalent in Astro, so every route goes through
// apiHandler() to get it back.
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
    this.name = "HttpError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor() {
    super(401, "unauthenticated");
  }
}

export class ForbiddenError extends HttpError {
  constructor() {
    super(403, "forbidden");
  }
}

export class RateLimitError extends HttpError {
  constructor() {
    super(429, "rate_limited");
  }
}

// Ports of the verification-code exceptions from server/src/lib/verification.ts
// (unchanged behavior: thrown deep inside lib code, caught by the specific
// route that knows what each one means for its own response).
export class WrongCodeError extends HttpError {
  constructor() {
    super(400, "wrong_code");
  }
}
export class NoPendingCodeError extends HttpError {
  constructor() {
    super(400, "no_pending_code");
  }
}
export class TooManyAttemptsError extends HttpError {
  constructor() {
    super(429, "too_many_attempts");
  }
}
