/**
 * logger.util.ts — structured logging via Winston.
 *
 * Separate log files per concern (error, prediction, signal, trade, audit)
 * as specified in the project's logging requirements, plus combined
 * console output for local development.
 */

import winston from "winston";
import path from "path";

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), "logs");
const LOG_LEVEL = process.env.LOG_LEVEL || "info";

function fileTransport(filename: string, level?: string) {
  return new winston.transports.File({
    filename: path.join(LOG_DIR, filename),
    level,
    maxsize: 10 * 1024 * 1024,
    maxFiles: 5,
  });
}

const baseFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: baseFormat,
  transports: [
    fileTransport("error.log", "error"),
    fileTransport("combined.log"),
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});

export const predictionLogger = winston.createLogger({
  level: "info",
  format: baseFormat,
  transports: [fileTransport("prediction.log")],
});

export const signalLogger = winston.createLogger({
  level: "info",
  format: baseFormat,
  transports: [fileTransport("signal.log")],
});

export const tradeLogger = winston.createLogger({
  level: "info",
  format: baseFormat,
  transports: [fileTransport("trade.log")],
});

export const auditLogger = winston.createLogger({
  level: "info",
  format: baseFormat,
  transports: [fileTransport("audit.log")],
});
