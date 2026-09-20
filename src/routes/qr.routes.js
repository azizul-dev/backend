"use strict";

const { Router } = require("express");
const { getQr } = require("../controllers/qr.controller");

const router = Router();
router.get("/current", getQr);

module.exports = router;
