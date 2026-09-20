"use strict";

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { QR_SECRET, DISPLAY_KEY, FRONTEND_URL } = require("../config/env");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/respond");

const getQr = asyncHandler(async (req, res) => {
  const displayKey = req.headers["x-display-key"] || "";
  
  const displayKeyBuf = Buffer.from(displayKey);
  const expectedKeyBuf = Buffer.from(DISPLAY_KEY);
  
  if (displayKeyBuf.length !== expectedKeyBuf.length || !crypto.timingSafeEqual(displayKeyBuf, expectedKeyBuf)) {
    throw new AppError("Invalid display key", 401, "UNAUTHORIZED");
  }

  const token = jwt.sign({ p: "punch" }, QR_SECRET, { expiresIn: 60 });
  return ok(res, { url: `${FRONTEND_URL}/scan?t=${token}`, expiresIn: 60 });
});

module.exports = { getQr };
