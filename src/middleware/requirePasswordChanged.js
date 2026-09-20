"use strict";

/**
 * requirePasswordChanged.js
 * Blocks access with 403 MUST_CHANGE_PASSWORD if mustChangePassword is true.
 * Apply AFTER auth. Exempt routes: POST /auth/change-password, GET /auth/me.
 */

const AppError = require("../utils/AppError");

function requirePasswordChanged(req, _res, next) {
  if (req.user && req.user.mustChangePassword) {
    throw new AppError(
      "You must change your password before continuing",
      403,
      "MUST_CHANGE_PASSWORD"
    );
  }
  next();
}

module.exports = requirePasswordChanged;
