import app from "./app";
import { logger } from "./lib/logger";
import { ensureAuthScopeSeedData } from "./lib/authscope-lab";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  await ensureAuthScopeSeedData();
  const server = app.listen(port, () => {
    logger.info({ port }, "Server listening");
  });
  server.on("error", (err) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });
}

void start().catch((err: unknown) => {
  logger.error({ err }, "Failed to initialize API server");
  process.exit(1);
});
