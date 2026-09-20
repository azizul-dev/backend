"use strict";

const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const auth = require("../middleware/auth");
const requirePasswordChanged = require("../middleware/requirePasswordChanged");
const deviceLock = require("../middleware/deviceLock");
const adminOnly = require("../middleware/adminOnly");
const { officeCheck } = require("../middleware/officeCheck");
const { scanPunch, getMe, getByDate, editAttendance, manualAttendance } = require("../controllers/attendance.controller");

const router = Router();

const punchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: "RATE_LIMITED", message: "Too many scan attempts" },
});

// For employee punch
function employeesOnly(req, res, next) {
  if (req.user && req.user.role === "employee") return next();
  return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Employees only" });
}

router.post("/scan", punchLimiter, auth, requirePasswordChanged, employeesOnly, deviceLock, officeCheck, scanPunch);
router.get("/me", auth, requirePasswordChanged, employeesOnly, getMe);

router.get("/", auth, requirePasswordChanged, adminOnly, getByDate);
router.patch("/:id", auth, requirePasswordChanged, adminOnly, editAttendance);
router.post("/manual", auth, requirePasswordChanged, adminOnly, manualAttendance);

module.exports = router;
