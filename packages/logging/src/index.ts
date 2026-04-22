type LogMetadata = Record<string, unknown> | undefined;

function write(level: string, scope: string, message: string, metadata?: LogMetadata) {
  const payload = {
    level,
    scope,
    message,
    metadata,
    timestamp: new Date().toISOString()
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}

export function createLogger(scope: string) {
  return {
    info: (message: string, metadata?: LogMetadata) => write("info", scope, message, metadata),
    warn: (message: string, metadata?: LogMetadata) => write("warn", scope, message, metadata),
    error: (message: string, metadata?: LogMetadata) => write("error", scope, message, metadata)
  };
}
