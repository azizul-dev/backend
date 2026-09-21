"use strict";

/**
 * env.js — Load and validate required environment variables.
 * Fail fast at startup if anything critical is missing or misconfigured.
 *
 * NOTE: SEED_ADMIN_* are NOT required here. They are only needed when
 * running `npm run seed:admin` (validated inside src/seed/admin.js).
 */

require("dotenv").config();

const IS_PROD = process.env.NODE_ENV === "production";

// Needed by the server in every environment.
const REQUIRED = ["MONGODB_URI", "JWT_SECRET", "QR_SECRET"];

// In production, unsafe defaults are not allowed for these two.
if (IS_PROD) REQUIRED.push("DISPLAY_KEY", "FRONTEND_URL");

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`[env] Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

// Guard: QR_SECRET must differ from JWT_SECRET
if (process.env.JWT_SECRET === process.env.QR_SECRET) {
  console.error("[env] QR_SECRET must differ from JWT_SECRET");
  process.exit(1);
}

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  QR_SECRET: process.env.QR_SECRET,
  DISPLAY_KEY: process.env.DISPLAY_KEY || "",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
  NODE_ENV: process.env.NODE_ENV || "development",
  DISABLE_OFFICE_CHECK: process.env.DISABLE_OFFICE_CHECK === "true",
  SEED_ADMIN_NAME: process.env.SEED_ADMIN_NAME || "Admin",
  SEED_ADMIN_PHONE: process.env.SEED_ADMIN_PHONE,
  SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD,
};