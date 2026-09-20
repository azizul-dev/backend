"use strict";

/**
 * deviceLock.js — Enforce device binding for employees.
 * Admins are exempt.
 *
 * Logic:
 *  1. Read x-device-id header → 400 NO_DEVICE if missing.
 *  2. Hash it with SHA-256.
 *  3. If user.deviceHash is null → bind it now (first-time registration).
 *  4. If hash matches → pass through.
 *  5. If hash differs → upsert a pending DeviceRequest and return 403 DEVICE_MISMATCH.
 */

const User = require("../models/User");
const DeviceRequest = require("../models/DeviceRequest");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { hashDevice } = require("../utils/deviceHash");

const deviceLock = asyncHandler(async (req, _res, next) => {
  // Admins bypass device lock
  if (req.user.role === "admin") return next();

  const rawId = req.headers["x-device-id"];
  if (!rawId) throw new AppError("x-device-id header is required", 400, "NO_DEVICE");

  const incomingHash = hashDevice(rawId);

  // Case 1: No device registered yet → bind this one
  if (!req.user.deviceHash) {
    await User.findByIdAndUpdate(req.user._id, {
      deviceHash: incomingHash,
      deviceInfo: {
        userAgent: req.headers["user-agent"] || "",
        boundAt: new Date(),
      },
    });
    // Update the in-request user so downstream sees the fresh state
    req.user.deviceHash = incomingHash;
    return next();
  }

  // Case 2: Registered device matches
  if (req.user.deviceHash === incomingHash) return next();

  // Case 3: Different device → create/update a pending DeviceRequest
  await DeviceRequest.findOneAndUpdate(
    { user: req.user._id, status: "pending" },
    {
      user: req.user._id,
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
});

module.exports = deviceLock;
