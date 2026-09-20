"use strict";

/**
 * admin.js — Idempotent seed for the first admin user and default Settings.
 *
 * Run via: npm run seed:admin
 * Reads from: SEED_ADMIN_NAME, SEED_ADMIN_PHONE, SEED_ADMIN_PASSWORD env vars.
 */

require("../config/env"); // validates env and loads dotenv
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const User = require("../models/User");
const Setting = require("../models/Setting");
const { SEED_ADMIN_NAME, SEED_ADMIN_PHONE, SEED_ADMIN_PASSWORD } = require("../config/env");

async function seedAdmin() {
  await connectDB();

  // ── 1. Create admin user (idempotent — skip if phone already exists) ──
  const existing = await User.findOne({ phone: SEED_ADMIN_PHONE });

  if (existing) {
    console.log(`[seed] Admin already exists: ${existing.phone} (${existing._id})`);
  } else {
    const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 12);

    const admin = await User.create({
      name: SEED_ADMIN_NAME,
      phone: SEED_ADMIN_PHONE,
      passwordHash,
      role: "admin",
      mustChangePassword: false, // first admin skips forced password change
      isActive: true,
    });

    console.log(`[seed] Admin created: ${admin.phone} (${admin._id})`);
  }

  // ── 2. Create default Setting singleton if it doesn't exist ──
  const settingCount = await Setting.countDocuments();

  if (settingCount === 0) {
    await Setting.create({
      officeIps: [],
      weeklyOff: ["Friday"],
      minCheckoutGapMinutes: 10,
      geo: { enabled: false, radius: 100 },
    });
    console.log("[seed] Default Setting document created");
  } else {
    console.log("[seed] Setting already exists — skipping");
  }

  console.log("[seed] Done.");
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("[seed] Fatal error:", err);
  process.exit(1);
});
