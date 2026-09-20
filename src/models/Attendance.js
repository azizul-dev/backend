"use strict";

/**
 * Attendance.js — Daily punch record per user.
 * One document per (user, date) — enforced by compound unique index.
 */

const mongoose = require("mongoose");

const GeoSchema = new mongoose.Schema(
  {
    lat: Number,
    lng: Number,
  },
  { _id: false }
);

const AttendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // "YYYY-MM-DD" in Asia/Dhaka — never toISOString().slice(0,10)
    date: { type: String, required: true },

    checkIn: { type: Date },
    checkOut: { type: Date },

    status: { type: String, enum: ["present", "late"] },

    workingMinutes: { type: Number, default: 0 },

    // How the punch was verified
    verifiedBy: { type: String, enum: ["ip", "geo", "dev", "manual"] },

    ip: { type: String },
    geo: { type: GeoSchema, default: null },

    // Extra flags e.g. ["geo_weak", "manual_edit"]
    flags: [{ type: String }],

    // Manual edit trail
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    editReason: { type: String },
  },
  { timestamps: true }
);

// One attendance record per user per calendar day
AttendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", AttendanceSchema);
