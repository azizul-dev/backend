"use strict";

const ipaddr = require("ipaddr.js");
const Setting = require("../models/Setting");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { DISABLE_OFFICE_CHECK, NODE_ENV } = require("../config/env");

let settingsCache = { data: null, expiresAt: 0 };

async function getSettings() {
  const now = Date.now();
  if (settingsCache.data && now < settingsCache.expiresAt) {
    return settingsCache.data;
  }
  const setting = await Setting.findOne();
  settingsCache = { data: setting, expiresAt: now + 30 * 1000 };
  return setting;
}

function clearSettingsCache() {
  settingsCache.data = null;
  settingsCache.expiresAt = 0;
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function checkIp(reqIp, officeIps) {
  try {
    let addr = ipaddr.parse(reqIp.replace(/^::ffff:/, ""));
    if (addr.kind() === "ipv6" && addr.isIPv4MappedAddress()) {
      addr = addr.toIPv4Address();
    }

    for (const office of officeIps) {
      try {
        if (office.includes("/")) {
          const range = ipaddr.parseCIDR(office);
          if (addr.match(range)) return true;
        } else {
          let officeAddr = ipaddr.parse(office.replace(/^::ffff:/, ""));
          if (
            officeAddr.kind() === "ipv6" &&
            officeAddr.isIPv4MappedAddress()
          ) {
            officeAddr = officeAddr.toIPv4Address();
          }
          if (
            addr.kind() === officeAddr.kind() &&
            addr.toNormalizedString() === officeAddr.toNormalizedString()
          ) {
            return true;
          }
        }
      } catch (e) {}
    }
  } catch (e) {}
  return false;
}

const officeCheck = asyncHandler(async (req, res, next) => {
  if (DISABLE_OFFICE_CHECK && NODE_ENV !== "production") {
    req.verifiedBy = "dev";
    return next();
  }

  const setting = await getSettings();
  if (!setting) {
    throw new AppError("System configuration missing", 500, "NO_SETTINGS");
  }

  const reqIp = req.ip || req.connection.remoteAddress || "";
  console.log(
    "[officeCheck] incoming IP:",
    reqIp,
    "| whitelisted:",
    setting.officeIps,
  );

  if (setting.officeIps && setting.officeIps.length > 0) {
    if (checkIp(reqIp, setting.officeIps)) {
      req.verifiedBy = "ip";
      return next();
    }
  }

  if (setting.geo && setting.geo.enabled && req.body.lat && req.body.lng) {
    const dist = getDistance(
      req.body.lat,
      req.body.lng,
      setting.geo.lat,
      setting.geo.lng,
    );
    if (dist <= (setting.geo.radius || 100)) {
      req.verifiedBy = "geo";
      req.punchFlags = ["geo_only"];
      return next();
    }
  }

  return res.status(403).json({
    success: false,
    code: "NOT_IN_OFFICE",
    message: "You are not within the office network or location.",
    data: { geoAllowed: setting.geo ? setting.geo.enabled : false },
  });
});

module.exports = { officeCheck, clearSettingsCache };
