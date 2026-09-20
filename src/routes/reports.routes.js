"use strict";

const { Router } = require("express");
const auth = require("../middleware/auth");
const requirePasswordChanged = require("../middleware/requirePasswordChanged");
const adminOnly = require("../middleware/adminOnly");
const { getSummary, getMonthly } = require("../controllers/reports.controller");

const router = Router();
router.use(auth, requirePasswordChanged, adminOnly);

router.get("/summary", getSummary);
router.get("/monthly", getMonthly);

module.exports = router;
