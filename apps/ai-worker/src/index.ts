import { loadServerEnv } from "@platform/config";
import { createLogger } from "@platform/logging";

const env = loadServerEnv(process.env);
const logger = createLogger("ai-worker");

async function start() {
  logger.info("Worker booted", {
    redisUrl: env.REDIS_URL,
    queuesPlanned: ["knowledge-ingestion", "response-generation", "handoff-routing"]
  });
}

start().catch((error: unknown) => {
  logger.error("Worker crashed", {
    error: error instanceof Error ? error.message : "Unknown error"
  });
  process.exitCode = 1;
});
