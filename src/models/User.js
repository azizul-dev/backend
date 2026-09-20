"use strict";

/**
 * User.js — Employee / Admin user model.
 */

const mongoose = require("mongoose");

const ShiftSchema = new mongoose.Schema(
  {
    start: { type: String, default: "09:00" },   // "HH:MM"
    end: { type: String, default: "18:00" },      // "HH:MM"
    graceMinutes: { type: Number, default: 10 },  // late threshold
  },
  { _id: false }
);

const DeviceInfoSchema = new mongoose.Schema(
  {
    userAgent: String,
    boundAt: Date,
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // Primary login identifier
    phone: { type: String, required: true, unique: true, trim: true },

    // Optional; sparse so multiple nulls/undefined are allowed
    email: { type: String, trim: true, lowercase: true },

    passwordHash: { type: String, required: true },

    role: { type: String, enum: ["admin", "employee"], default: "employee" },

    employeeId: { type: String, trim: true },
    designation: { type: String, trim: true },
    department: { type: String, trim: true },

    shift: { type: ShiftSchema, default: () => ({}) },

    // Force password change on first login
    mustChangePassword: { type: Boolean, default: true },

    // SHA-256 hash of the registered device id header
    deviceHash: { type: String, default: null },
    deviceInfo: { type: DeviceInfoSchema, default: null },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Sparse unique index on email (allows many null emails)
UserSchema.index({ email: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("User", UserSchema);
