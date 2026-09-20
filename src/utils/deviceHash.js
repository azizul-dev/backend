"use strict";

/**
 * deviceHash.js — Compute SHA-256 of a raw device-id string.
 * Consistent hashing used in both login and deviceLock middleware.
 */

const crypto = require("crypto");

/**
 * @param {string} rawDeviceId — the value of the x-device-id header
 * @returns {string} hex-encoded SHA-256 hash
 */
function hashDevice(rawDeviceId) {
  return crypto.createHash("sha256").update(rawDeviceId).digest("hex");
}

module.exports = { hashDevice };
