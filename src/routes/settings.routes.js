"use strict";

const { Router } = require("express");
const auth = require("../middleware/auth");
const requirePasswordChanged = require("../middleware/requirePasswordChanged");
const adminOnly = require("../middleware/adminOnly");
const { getSettings, updateSettings } = require("../controllers/settings.controller");

const router = Router();
router.use(auth, requirePasswordChanged, adminOnly);

router.get("/", getSettings);
router.put("/", updateSettings);

module.exports = router;
