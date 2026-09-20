"use strict";

/**
 * AuditLog.js — Immutable audit trail for admin actions.
 */

const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    // Who performed the action
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // e.g. "EDIT_ATTENDANCE", "APPROVE_LEAVE", "CREATE_USER"
    action: { type: String, required: true },

    // The affected document id / identifier
    target: { type: String },

    // Snapshot before the change (flexible)
    before: { type: mongoose.Schema.Types.Mixed },

    // Snapshot after the change
    after: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: true,
    // Audit logs should never be mutated
    strict: true,
  }
);

// Index for querying by actor or action
AuditLogSchema.index({ actor: 1 });
AuditLogSchema.index({ action: 1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);
