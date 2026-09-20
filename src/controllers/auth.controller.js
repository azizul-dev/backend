"use strict";

/**
 * auth.controller.js — Login, change-password, me.
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");

const User = require("../models/User");
const DeviceRequest = require("../models/DeviceRequest");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/respond");
const { sanitizeUser } = require("../utils/sanitizeUser");
const { hashDevice } = require("../utils/deviceHash");
const { JWT_SECRET } = require("../config/env");

// ── Zod schemas ─────────────────────────────────────────────────────

const loginSchema = z.object({
  identifier: z.string().min(1, "identifier is required"), // phone or email
  password: z.string().min(1, "password is required"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "currentPassword is required"),
  newPassword: z.string().min(8, "newPassword must be at least 8 characters"),
});

// ── Helpers ─────────────────────────────────────────────────────────

function signToken(user) {
  // Admins get a shorter-lived token for security
  const expiresIn = user.role === "admin" ? "12h" : "30d";
  return jwt.sign({ sub: user._id, role: user.role }, JWT_SECRET, { expiresIn });
}

/**
 * Handle device binding/mismatch for employee logins.
 * Mirrors the deviceLock middleware logic but runs inside login.
 *
 * @returns {Promise<void>} resolves quietly or throws AppError
 */
async function handleDeviceAtLogin(user, req) {
  if (user.role === "admin") return; // admins exempt

  const rawId = req.headers["x-device-id"];
  if (!rawId) throw new AppError("x-device-id header is required for employee login", 400, "NO_DEVICE");

  const incomingHash = hashDevice(rawId);

  // No device bound yet → bind now
  if (!user.deviceHash) {
    await User.findByIdAndUpdate(user._id, {
      deviceHash: incomingHash,
      deviceInfo: {
        userAgent: req.headers["user-agent"] || "",
        boundAt: new Date(),
      },
    });
    user.deviceHash = incomingHash; // mutate local copy for response
    return;
  }

  // Matching device → OK
  if (user.deviceHash === incomingHash) return;

  // Different device → upsert DeviceRequest, block login
  await DeviceRequest.findOneAndUpdate(
    { user: user._id, status: "pending" },
    {
      user: user._id,
      newDeviceHash: incomingHash,
      userAgent: req.headers["user-agent"] || "",
      status: "pending",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  throw new AppError(
    "Device mismatch. A device-change request has been submitted and is awaiting admin approval.",
    403,
    "DEVICE_MISMATCH"
  );
}

// ── Controllers ─────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { identifier, password } = loginSchema.parse(req.body);

  // Look up by phone or email
  const user = await User.findOne({
    $or: [{ phone: identifier }, { email: identifier }],
  });

  // Use constant-time comparison to prevent timing attacks; always compare
  const DUMMY_HASH = "$2a$12$dummydummydummydummydummydummydummydummydummydummy";
  const isMatch = user
    ? await bcrypt.compare(password, user.passwordHash)
    : await bcrypt.compare(password, DUMMY_HASH).then(() => false);

  if (!user || !isMatch) {
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }

  if (!user.isActive) {
    throw new AppError("Account is deactivated", 403, "ACCOUNT_INACTIVE");
  }

  // Device check for employees
  await handleDeviceAtLogin(user, req);

  const token = signToken(user);

  return ok(res, { token, user: sanitizeUser(user) });
});

/**
 * POST /api/auth/change-password
 * Requires auth. Works even when mustChangePassword=true.
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

  // Load full user with passwordHash (auth middleware used .lean())
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) throw new AppError("Current password is incorrect", 400, "WRONG_PASSWORD");

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.mustChangePassword = false;
  await user.save();

  return ok(res, { message: "Password changed successfully" });
});

/**
 * GET /api/auth/me
 * Requires auth. Works even when mustChangePassword=true.
 */
const me = asyncHandler(async (req, res) => {
  // req.user comes from auth middleware (already sanitised via .lean())
  const user = await User.findById(req.user._id).lean();
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
  return ok(res, sanitizeUser(user));
});

module.exports = { login, changePassword, me };
