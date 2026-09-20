"use strict";

/**
 * errorHandler.js — Central Express error handler (must be last middleware).
 * Converts AppError and Mongoose/JWT/Zod errors into standard API responses.
 */

const { NODE_ENV } = require("../config/env");

module.exports = function errorHandler(err, req, res, next) {
  // Default to 500
  let status = err.status || 500;
  let code = err.code || "INTERNAL_ERROR";
  let message = err.message || "Something went wrong";

  // Mongoose duplicate key
  if (err.code === 11000) {
    status = 409;
    code = "DUPLICATE";
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    message = `${field} already exists`;
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    status = 422;
    code = "VALIDATION_ERROR";
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join("; ");
  }

  // Mongoose cast error (bad ObjectId)
  if (err.name === "CastError") {
    status = 400;
    code = "INVALID_ID";
    message = `Invalid value for field: ${err.path}`;
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    status = 401;
    code = "INVALID_TOKEN";
    message = "Invalid token";
  }
  if (err.name === "TokenExpiredError") {
    status = 401;
    code = "TOKEN_EXPIRED";
    message = "Token has expired";
  }

  // Zod validation error
  if (err.name === "ZodError") {
    status = 422;
    code = "VALIDATION_ERROR";
    message = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
  }

  // Log unexpected errors in all envs
  if (status >= 500) {
    console.error("[error]", err);
  }

  const body = { success: false, code, message };

  // Include stack trace in development
  if (NODE_ENV === "development" && status >= 500) {
    body.stack = err.stack;
  }

  return res.status(status).json(body);
};
