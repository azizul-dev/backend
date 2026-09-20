"use strict";

/**
 * users.routes.js — /api/users (admin only)
 */

const { Router } = require("express");

const auth = require("../middleware/auth");
const adminOnly = require("../middleware/adminOnly");
const requirePasswordChanged = require("../middleware/requirePasswordChanged");
const {
  createUser,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  resetPassword,
  resetDevice,
} = require("../controllers/users.controller");

const router = Router();

// All user-management routes: must be authenticated, admin, and not pending password change
router.use(auth, requirePasswordChanged, adminOnly);

router.post("/", createUser);
router.get("/", listUsers);
router.get("/:id", getUser);
router.patch("/:id", updateUser);
router.delete("/:id", deleteUser);
router.post("/:id/reset-password", resetPassword);
router.post("/:id/reset-device", resetDevice);

module.exports = router;
