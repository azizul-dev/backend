"use strict";

/**
 * app.js — Express application factory.
 * All middleware and route mounting happens here.
 * The HTTP server is created in server.js (separation of concerns).
 */

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const { FRONTEND_URL, NODE_ENV } = require("./config/env");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// ------------------------------------------------------------------
// Security & network
// ------------------------------------------------------------------

// Trust the first proxy (needed for accurate req.ip behind nginx/load-balancer)
app.set("trust proxy", 1);

// Security headers
app.use(helmet());

// CORS — only allow the configured frontend origin
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

// Global rate limit — 200 req / 15 min per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, code: "RATE_LIMITED", message: "Too many requests" },
  })
);

// ------------------------------------------------------------------
// Parsing & sanitization
// ------------------------------------------------------------------

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

// Prevent MongoDB operator injection in request body and params.
// express-mongo-sanitize v2.x tries to reassign req.query, which is a
// read-only getter in Express 5. We use its sanitize() helper directly
// and skip the query reassignment.
const { sanitize: _mSanitize } = require("express-mongo-sanitize");
app.use((req, _res, next) => {
  if (req.body) req.body = _mSanitize(req.body);
  if (req.params) req.params = _mSanitize(req.params);
  next();
});

// ------------------------------------------------------------------
// Logging
// ------------------------------------------------------------------

app.use(morgan(NODE_ENV === "production" ? "combined" : "dev"));

// ------------------------------------------------------------------
// Routes
// ------------------------------------------------------------------

// Health check — no auth required
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      env: NODE_ENV,
      timestamp: new Date().toISOString(),
    },
  });
});

// Feature routers
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/users", require("./routes/users.routes"));
app.use("/api/device-requests", require("./routes/deviceRequests.routes"));

app.use("/api/attendance", require("./routes/attendance.routes"));
app.use("/api/qr", require("./routes/qr.routes"));
app.use("/api/settings", require("./routes/settings.routes"));
app.use("/api/holidays", require("./routes/holidays.routes"));

app.use("/api/leaves", require("./routes/leaves.routes"));
app.use("/api/reports", require("./routes/reports.routes"));

// ------------------------------------------------------------------
// Error handling (must be last)
// ------------------------------------------------------------------

app.use(notFound);
app.use(errorHandler);

module.exports = app;
