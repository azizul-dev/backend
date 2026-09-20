"use strict";

/**
 * adminOnly.js — Allow only users with role "admin".
 * Must be used after auth middleware.
 */

const AppError = require("../utils/AppError");

function adminOnly(req, _res, next) {
  if (req.user && req.user.role === "admin") return next();
  throw new AppError("Admin access required", 403, "FORBIDDEN");
}

module.exports = adminOnly;
