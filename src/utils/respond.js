"use strict";

/**
 * respond.js — Standardised response helpers.
 * All API responses follow: { success, data } or { success, code, message, data? }
 */

/**
 * Send a success response.
 * @param {import('express').Response} res
 * @param {*} data
 * @param {number} [status=200]
 */
function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} [status=400]
 * @param {string} [code="BAD_REQUEST"]
 * @param {*} [data]
 */
function fail(res, message, status = 400, code = "BAD_REQUEST", data) {
  const body = { success: false, code, message };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
}

module.exports = { ok, fail };
