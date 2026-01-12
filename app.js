const express = require("express");
const cron = require("node-cron");
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

// Schedule: Daily at 12:00 PM
cron.schedule("0 12 * * *", () => {
  logger.info("Scheduled daily check started");
  checker.runAll();
});

// Run on startup (optional, user asked for "check when server starts" implies immediate check or just ready)
// User said: "서버는 기존에 사용하던거랑 출석체크 완료하면 완료된것들 텔레그램으로 알람줄수있게"
// And usually such services might want to check once on boot to ensure nothing missed, 
// OR just rely on schedule. 
// I will verify if I should run on start. 
// Let's add a small delay and run on start if configured, or just rely on manual/schedule.
// For now, I'll logging that it's ready.

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);

  // Optionally run check on startup if needed, but might be annoying during dev restarts.
  // I will leave it to manual trigger or schedule, unless user specifically asked for "run on boot".
  // User didn't say "run on boot", just "server ... existing ... check done -> alarm".
});

// For Render/Heroku etc
process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down.");
  process.exit(0);
});
