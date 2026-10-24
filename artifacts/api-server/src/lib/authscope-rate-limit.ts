import type { RequestHandler } from "express";

interface WindowState {
  startedAt: number;
  count: number;
}

export function createActorRateLimit(
  maximum: number,
  windowMs: number,
): RequestHandler {
  const windows = new Map<string, WindowState>();

  return (_req, res, next): void => {
    const actorId = res.locals.authscopeUserId;
    if (typeof actorId !== "string" || actorId.length === 0) {
      res.status(401).json({ error: "Authentication is required." });
      return;
    }

    const now = Date.now();
    if (windows.size > 5000) {
      for (const [key, window] of windows) {
        if (now - window.startedAt >= windowMs) windows.delete(key);
      }
    }

    const current = windows.get(actorId);
    if (!current || now - current.startedAt >= windowMs) {
      windows.set(actorId, { startedAt: now, count: 1 });
      next();
      return;
    }
    if (current.count >= maximum) {
      const retryAfter = Math.max(
        1,
        Math.ceil((windowMs - (now - current.startedAt)) / 1000),
      );
      res.setHeader("Retry-After", retryAfter);
      res.status(429).json({
        error: "Test execution limit reached. Try again shortly.",
      });
      return;
    }

    current.count += 1;
    next();
  };
}
