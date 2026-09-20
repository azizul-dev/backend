"use strict";

/**
 * Setting.js — Singleton document for office-wide configuration.
 * Only one document should ever exist (enforced by the seed/application logic).
 */

const mongoose = require("mongoose");

const GeoSettingSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    lat: { type: Number },
    lng: { type: Number },
    radius: { type: Number, default: 100 }, // metres
  },
  { _id: false }
);

const SettingSchema = new mongoose.Schema(
  {
    // IPv4, IPv6, or CIDR strings that count as "office network"
    officeIps: [{ type: String }],

    geo: { type: GeoSettingSchema, default: () => ({}) },

    // Full weekday names e.g. ["Friday", "Saturday"]
    weeklyOff: { type: [String], default: ["Friday"] },

    // Min gap between check-in and check-out
    minCheckoutGapMinutes: { type: Number, default: 10 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Setting", SettingSchema);
