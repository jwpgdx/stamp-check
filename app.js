const express = require("express");
const winston = require("winston");
const AttendanceChecker = require("./src/AttendanceChecker");
const Notifier = require("./src/notifier");
require("dotenv").config();

// Logger Config
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/attendance.log" }),
  ],
});

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Services
const notifier = new Notifier(logger);
// Attempt to load telegram config from Env
const telegramToken = process.env.TELEGRAM_TOKEN;
const telegramChat = process.env.TELEGRAM_CHAT;
if (telegramToken && telegramChat) {
  notifier.setTelegramConfig(telegramToken, telegramChat);
} else {
  logger.warn("TELEGRAM_TOKEN or TELEGRAM_CHAT not set in .env");
}

const checker = new AttendanceChecker(logger, notifier);

// Middleware
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.send("Attendance Check Service Running");
});

app.get("/api/run-check", async (req, res) => {
  logger.info("Manual check triggered via API");
  // Run in background
  checker.runAll().catch(err => logger.error(`Manual check failed: ${err.message}`));
  res.json({ message: "Attendance check started in background." });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// For Render/Heroku etc
process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down.");
  process.exit(0);
});
