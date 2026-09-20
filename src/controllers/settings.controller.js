"use strict";

const { z } = require("zod");
const ipaddr = require("ipaddr.js");
const Setting = require("../models/Setting");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/respond");
const { writeAudit } = require("../utils/audit");
const { clearSettingsCache } = require("../middleware/officeCheck");

const settingsSchema = z.object({
  officeIps: z.array(z.string()).refine(ips => {
    return ips.every(ip => {
      try {
        if (ip.includes('/')) ipaddr.parseCIDR(ip);
        else ipaddr.parse(ip.replace(/^::ffff:/, ''));
        return true;
      } catch (e) {
        return false;
      }
    });
  }, "One or more IPs or CIDRs are invalid"),
  geo: z.object({
    enabled: z.boolean(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    radius: z.number().optional()
  }).optional(),
  weeklyOff: z.array(z.string()),
  minCheckoutGapMinutes: z.number().min(0)
});

const getSettings = asyncHandler(async (req, res) => {
  const setting = await Setting.findOne().lean();
  if (!setting) throw new AppError("Settings not found", 404, "NOT_FOUND");
  return ok(res, setting);
});

const updateSettings = asyncHandler(async (req, res) => {
  const data = settingsSchema.parse(req.body);
  const setting = await Setting.findOne();
  if (!setting) throw new AppError("Settings not found", 404, "NOT_FOUND");

  const before = setting.toObject();
  
  setting.officeIps = data.officeIps;
  if (data.geo) setting.geo = data.geo;
  setting.weeklyOff = data.weeklyOff;
  setting.minCheckoutGapMinutes = data.minCheckoutGapMinutes;
  
  await setting.save();
  clearSettingsCache();

  await writeAudit({
    actor: req.user._id,
    action: "UPDATE_SETTINGS",
    target: setting._id,
    before,
    after: setting.toObject()
  });

  return ok(res, setting);
});

module.exports = { getSettings, updateSettings };
