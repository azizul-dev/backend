"use strict";

/**
 * DeviceRequest.js — Request to change/reset a user's registered device.
 */

const mongoose = require("mongoose");

const DeviceRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // SHA-256 of the new device-id header value
    newDeviceHash: { type: String, required: true },

    userAgent: { type: String },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DeviceRequest", DeviceRequestSchema);
