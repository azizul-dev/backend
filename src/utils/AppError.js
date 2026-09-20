"use strict";

/**
 * AppError.js — Operational error class with HTTP status + error code.
 * Distinguishes operational errors (user-facing) from programmer bugs.
 */

class AppError extends Error {
  /**
   * @param {string} message  — Human-readable message
   * @param {number} status   — HTTP status code (default 400)
   * @param {string} code     — Machine-readable code for the client
   */
  constructor(message, status = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
