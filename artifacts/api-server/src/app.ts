import path from "node:path";
import { existsSync } from "node:fs";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Serve the built web app from this same service (used on Render's free tier,
// so the browser, the Clerk session cookie and /api all share one origin).
// Mounted before Clerk/JSON middleware so static files never hit auth.
if (process.env.NODE_ENV === "production") {
  const staticDir = [
    process.env.STATIC_DIR,
    path.resolve(process.cwd(), "artifacts/authscope/dist/public"),
    path.resolve(process.cwd(), "../authscope/dist/public"),
  ]
    .filter((dir): dir is string => Boolean(dir))
    .find((dir) => existsSync(path.join(dir, "index.html")));

  if (staticDir) {
    logger.info({ staticDir }, "Serving web app from API service");
    app.use(
      express.static(staticDir, {
        index: false,
        setHeaders: (res, filePath) => {
          res.setHeader(
            "Cache-Control",
            filePath.includes(`${path.sep}assets${path.sep}`)
              ? "public, max-age=31536000, immutable"
              : "no-cache",
          );
        },
      }),
    );
    app.use((req, res, next) => {
      if (
        (req.method !== "GET" && req.method !== "HEAD") ||
        req.path.startsWith("/api")
      ) {
        next();
        return;
      }
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(staticDir, "index.html"));
    });
  } else {
    logger.warn("No built web app found; serving API only");
  }
}

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

export default app;
