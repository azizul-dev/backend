"use strict";

/**
 * Leave.js — Employee leave request model.
 */

const mongoose = require("mongoose");

const LeaveSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // "YYYY-MM-DD" strings in Dhaka timezone
    fromDate: { type: String, required: true },
    toDate: { type: String, required: true },

    type: { type: String, enum: ["casual", "sick", "other"], required: true },
    reason: { type: String, trim: true },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    decidedAt: { type: Date },
  },
  { timestamps: true }
);

// Index for quick lookup by user and date range
LeaveSchema.index({ user: 1, fromDate: 1, toDate: 1 });

module.exports = mongoose.model("Leave", LeaveSchema);
