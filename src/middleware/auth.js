"use strict";

/**
 * auth.js — Verify Bearer JWT and attach req.user.
 * Rejects inactive users immediately.
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { JWT_SECRET } = require("../config/env");

const auth = asyncHandler(async (req, _res, next) => {
  // Extract token from Authorization: Bearer <token>
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new AppError("No token provided", 401, "NO_TOKEN");
  }

  const token = authHeader.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    // Re-throw as operational so error handler formats correctly
    const code = err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN";
    throw new AppError(err.message, 401, code);
  }

  // Load fresh user from DB (catches deactivated/deleted users)
  const user = await User.findById(payload.sub).lean();
  if (!user) throw new AppError("User not found", 401, "INVALID_TOKEN");
  if (!user.isActive) throw new AppError("Account is deactivated", 403, "ACCOUNT_INACTIVE");

  req.user = user;
  next();
});

module.exports = auth;
