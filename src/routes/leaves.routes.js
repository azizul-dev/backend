"use strict";

const { Router } = require("express");
const auth = require("../middleware/auth");
const requirePasswordChanged = require("../middleware/requirePasswordChanged");
const adminOnly = require("../middleware/adminOnly");
const { applyLeave, getMyLeaves, listLeaves, patchLeave } = require("../controllers/leaves.controller");

const router = Router();
router.use(auth, requirePasswordChanged);

// Employee routes
router.post("/", applyLeave);
router.get("/me", getMyLeaves);

// Admin routes
router.get("/", adminOnly, listLeaves);
router.patch("/:id", adminOnly, patchLeave);

module.exports = router;
