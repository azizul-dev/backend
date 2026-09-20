"use strict";

/**
 * deviceRequests.routes.js — /api/device-requests (admin only)
 */

const { Router } = require("express");

const auth = require("../middleware/auth");
const adminOnly = require("../middleware/adminOnly");
const requirePasswordChanged = require("../middleware/requirePasswordChanged");
const { listRequests, approveRequest, rejectRequest } = require("../controllers/deviceRequests.controller");

const router = Router();

// All device-request routes: authenticated admin, not pending password change
router.use(auth, requirePasswordChanged, adminOnly);

router.get("/", listRequests);
router.post("/:id/approve", approveRequest);
router.post("/:id/reject", rejectRequest);

module.exports = router;
