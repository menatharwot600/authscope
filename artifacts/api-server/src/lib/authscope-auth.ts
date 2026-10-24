import { getAuth } from "@clerk/express";
import type { RequestHandler, Response } from "express";

export const requireAuth: RequestHandler = (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication is required." });
    return;
  }

  res.locals.authscopeUserId = userId;
  next();
};

export function getAuthenticatedUserId(res: Response): string {
  const userId = res.locals.authscopeUserId;
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("Authenticated user context is missing.");
  }
  return userId;
}
