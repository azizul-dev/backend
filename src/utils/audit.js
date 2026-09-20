"use strict";

/**
 * audit.js — Write an AuditLog entry for any admin action.
 * Strips sensitive fields (passwordHash) from before/after snapshots.
 */

const AuditLog = require("../models/AuditLog");

const SENSITIVE = ["passwordHash"];

function scrub(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  SENSITIVE.forEach((k) => delete copy[k]);
  return copy;
}

/**
 * @param {object} opts
 * @param {string|ObjectId} opts.actor   — user performing the action
 * @param {string}          opts.action  — e.g. "CREATE_USER"
 * @param {string}          opts.target  — affected doc id / identifier
 * @param {object}          [opts.before]
 * @param {object}          [opts.after]
 */
async function writeAudit({ actor, action, target, before, after }) {
  try {
    await AuditLog.create({
      actor,
      action,
      target: String(target),
      before: before ? scrub(before) : undefined,
      after: after ? scrub(after) : undefined,
    });
  } catch (err) {
    // Audit failure must never break the main flow
    console.error("[audit] Failed to write audit log:", err.message);
  }
}

module.exports = { writeAudit };
