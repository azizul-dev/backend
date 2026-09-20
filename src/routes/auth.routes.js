"use strict";

/**
 * auth.routes.js — /api/auth
 *
 * POST /login          — public, rate-limited
 * POST /change-password — requires auth (works even with mustChangePassword=true)
 * GET  /me             — requires auth (works even with mustChangePassword=true)
 */

const { Router } = require("express");
const rateLimit = require("express-rate-limit");

const auth = require("../middleware/auth");
const { login, changePassword, me } = require("../controllers/auth.controller");

const router = Router();

// Strict rate limit for login: 10 attempts per 15 min per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "RATE_LIMITED",
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
});

router.post("/login", loginLimiter, login);

// change-password and /me are auth-gated but intentionally skip
// requirePasswordChanged so a user can still fix their password.
router.post("/change-password", auth, changePassword);
router.get("/me", auth, me);

module.exports = router;
