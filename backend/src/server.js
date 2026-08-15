import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { buildApp } from "./app.js";
import { loadConfig } from "./config/env.js";

loadDotenv({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env"),
  quiet: true,
});

const config = loadConfig();
const app = await buildApp({ config });
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "Graceful shutdown started");

  const forcedExit = setTimeout(() => {
    app.log.fatal("Graceful shutdown timed out");
    process.exit(1);
  }, config.SHUTDOWN_TIMEOUT_MS);
  forcedExit.unref();

  try {
    await app.close();
    clearTimeout(forcedExit);
    app.log.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    clearTimeout(forcedExit);
    app.log.fatal({ err: error }, "Graceful shutdown failed");
    process.exit(1);
  }
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.fatal({ err: error }, "API startup failed");
  process.exitCode = 1;
}
