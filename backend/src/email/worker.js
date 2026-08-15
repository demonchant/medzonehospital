import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { loadConfig } from "../config/env.js";
import { loadEmailConfig } from "../config/email.js";
import { createDatabase } from "../database/connection.js";
import { createEmailProcessor } from "./processor.js";
import { createSmtpTransport } from "./smtp-transport.js";

loadDotenv({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env"),
  quiet: true,
});

const logger = Object.freeze({
  error(context, message) {
    process.stderr.write(`${JSON.stringify({ level: "error", message, ...context })}\n`);
  },
  info(context, message) {
    process.stdout.write(`${JSON.stringify({ level: "info", message, ...context })}\n`);
  },
  warn(context, message) {
    process.stderr.write(`${JSON.stringify({ level: "warn", message, ...context })}\n`);
  },
});

const config = loadConfig();
const emailConfig = loadEmailConfig();
const database = createDatabase(config, logger);
const transport = createSmtpTransport(emailConfig);
const processor = createEmailProcessor({ database, logger, transport });
let stopping = false;
let timer = null;
let activeBatch = null;

async function poll() {
  if (stopping) return;
  try {
    activeBatch = processor.processBatch();
    const result = await activeBatch;
    if (result.claimed > 0) logger.info(result, "Email delivery batch completed");
  } catch (error) {
    logger.error({ errorCode: error?.code ?? "WORKER_ERROR" }, "Email worker batch failed");
  } finally {
    activeBatch = null;
  }
  if (!stopping) timer = setTimeout(poll, 5_000);
}

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  if (timer) clearTimeout(timer);
  logger.info({ signal }, "Email worker shutdown started");
  if (activeBatch) await activeBatch.catch(() => undefined);
  await database.close();
  logger.info({ signal }, "Email worker shutdown completed");
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
await poll();
