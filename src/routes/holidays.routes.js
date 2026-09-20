"use strict";

const { Router } = require("express");
const auth = require("../middleware/auth");
const requirePasswordChanged = require("../middleware/requirePasswordChanged");
const adminOnly = require("../middleware/adminOnly");
const { getHolidays, createHoliday, deleteHoliday } = require("../controllers/holidays.controller");

const router = Router();
router.use(auth, requirePasswordChanged, adminOnly);

router.get("/", getHolidays);
router.post("/", createHoliday);
router.delete("/:id", deleteHoliday);

module.exports = router;
