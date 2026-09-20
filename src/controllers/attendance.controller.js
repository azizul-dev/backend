"use strict";

const jwt = require("jsonwebtoken");
const { z } = require("zod");
const Attendance = require("../models/Attendance");
const Setting = require("../models/Setting");
const User = require("../models/User");
const Leave = require("../models/Leave");
const Holiday = require("../models/Holiday");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/respond");
const { writeAudit } = require("../utils/audit");
const { QR_SECRET } = require("../config/env");
const { dhakaDate, dhakaMinutes, listDates, dhakaWeekday } = require("../utils/time");
const { computeDayStatus } = require("../services/dayStatus");

const scanSchema = z.object({
  qrToken: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional()
});

const scanPunch = asyncHandler(async (req, res) => {
  const { qrToken, lat, lng } = scanSchema.parse(req.body);

  try {
    jwt.verify(qrToken, QR_SECRET);
  } catch (err) {
    throw new AppError("QR code expired or invalid. Please scan again.", 400, "QR_EXPIRED");
  }
  
  const now = new Date();
  const dateStr = dhakaDate(now);
  const minutes = dhakaMinutes(now);
  
  const setting = await Setting.findOne();
  if (!setting) throw new AppError("No settings", 500, "NO_SETTINGS");

  const shiftStart = req.user.shift && req.user.shift.start ? req.user.shift.start : "09:00";
  const grace = req.user.shift && req.user.shift.graceMinutes != null ? req.user.shift.graceMinutes : 10;
  
  const [h, m] = shiftStart.split(":").map(Number);
  const startMinutes = h * 60 + m;
  const isLate = minutes > (startMinutes + grace);
  
  const existing = await Attendance.findOne({ user: req.user._id, date: dateStr });
  
  if (!existing) {
    try {
      const record = await Attendance.create({
        user: req.user._id,
        date: dateStr,
        checkIn: now,
        status: isLate ? "late" : "present",
        verifiedBy: req.verifiedBy,
        ip: req.ip || req.connection.remoteAddress || "",
        geo: req.verifiedBy === "geo" ? { lat, lng } : null,
        flags: req.punchFlags || []
      });
      return ok(res, { action: "check_in", time: now, status: record.status, record });
    } catch (err) {
      if (err.code === 11000) {
        throw new AppError("Check-in already exists.", 409, "ALREADY_COMPLETE");
      }
      throw err;
    }
  } else {
    if (existing.checkOut) {
      throw new AppError("You have already checked out today.", 400, "ALREADY_COMPLETE");
    }
    
    const gapMs = now.getTime() - existing.checkIn.getTime();
    if (gapMs < setting.minCheckoutGapMinutes * 60000) {
      throw new AppError(`You must wait at least ${setting.minCheckoutGapMinutes} minutes before checking out.`, 400, "TOO_SOON");
    }
    
    existing.checkOut = now;
    existing.workingMinutes = Math.round(gapMs / 60000);
    
    if (req.punchFlags) {
      req.punchFlags.forEach(f => {
        if (!existing.flags.includes(f)) existing.flags.push(f);
      });
    }
    
    await existing.save();
    return ok(res, { action: "check_out", time: now, status: existing.status, record: existing });
  }
});

const getMe = asyncHandler(async (req, res) => {
  const month = req.query.month;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new AppError("month query parameter (YYYY-MM) is required", 400, "BAD_REQUEST");
  }
  
  const fromDate = `${month}-01`;
  const [year, m] = month.split('-');
  const daysInMonth = new Date(year, m, 0).getDate();
  const toDate = `${month}-${daysInMonth}`;
  
  const dates = listDates(fromDate, toDate);
  const todayStr = dhakaDate();
  
  const setting = await Setting.findOne();
  const holidays = await Holiday.find({ date: { $gte: fromDate, $lte: toDate } }).lean();
  const attendances = await Attendance.find({ user: req.user._id, date: { $gte: fromDate, $lte: toDate } }).lean();
  const leaves = await Leave.find({ user: req.user._id, status: "approved", $or: [
    { fromDate: { $lte: toDate }, toDate: { $gte: fromDate } }
  ] }).lean();

  const holidaySet = new Set(holidays.map(h => h.date));
  const attMap = new Map(attendances.map(a => [a.date, a]));
  const weeklyOffs = setting ? setting.weeklyOff : [];
  
  function isLeaveDay(d) {
    return leaves.some(l => d >= l.fromDate && d <= l.toDate);
  }
  
  const result = [];
  const counts = { present: 0, late: 0, absent: 0, leave: 0, holiday: 0, weekly_off: 0, future: 0 };
  
  for (const d of dates) {
    const isFuture = d > todayStr;
    const isWOff = weeklyOffs.includes(dhakaWeekday(new Date(`${d}T00:00:00`)));
    const st = computeDayStatus(d, req.user, attMap.get(d), isLeaveDay(d) ? {} : null, holidaySet.has(d), isWOff, isFuture);
    counts[st] = (counts[st] || 0) + 1;
    result.push({
      date: d,
      status: st,
      record: attMap.get(d) || null
    });
  }
  
  return ok(res, { month, totals: counts, days: result });
});

const getByDate = asyncHandler(async (req, res) => {
  const dateStr = req.query.date;
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new AppError("date query parameter (YYYY-MM-DD) is required", 400, "BAD_REQUEST");
  }
  
  const users = await User.find({ isActive: true, role: "employee" }).select("-passwordHash -deviceHash").lean();
  const setting = await Setting.findOne();
  const holiday = await Holiday.findOne({ date: dateStr }).lean();
  const attendances = await Attendance.find({ date: dateStr }).lean();
  const leaves = await Leave.find({ status: "approved", fromDate: { $lte: dateStr }, toDate: { $gte: dateStr } }).lean();
  
  const isWOff = setting && setting.weeklyOff.includes(dhakaWeekday(new Date(`${dateStr}T00:00:00`)));
  const isHol = !!holiday;
  const isFuture = dateStr > dhakaDate();
  
  const attMap = new Map(attendances.map(a => [String(a.user), a]));
  const leaveSet = new Set(leaves.map(l => String(l.user)));
  
  const result = [];
  const counts = { present: 0, late: 0, absent: 0, leave: 0, holiday: 0, weekly_off: 0, future: 0 };
  
  for (const u of users) {
    const att = attMap.get(String(u._id));
    const onLeave = leaveSet.has(String(u._id));
    const st = computeDayStatus(dateStr, u, att, onLeave ? {} : null, isHol, isWOff, isFuture);
    counts[st] = (counts[st] || 0) + 1;
    result.push({
      user: u,
      status: st,
      record: att || null
    });
  }
  
  return ok(res, { date: dateStr, summary: counts, employees: result });
});

const patchSchema = z.object({
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  status: z.enum(["present", "late"]).optional(),
  reason: z.string().min(1)
});

const editAttendance = asyncHandler(async (req, res) => {
  const data = patchSchema.parse(req.body);
  const record = await Attendance.findById(req.params.id);
  if (!record) throw new AppError("Record not found", 404, "NOT_FOUND");
  
  const before = record.toObject();
  
  if (data.checkIn) record.checkIn = new Date(data.checkIn);
  if (data.checkOut) record.checkOut = new Date(data.checkOut);
  if (data.status) record.status = data.status;
  
  if (record.checkIn && record.checkOut) {
    record.workingMinutes = Math.round((record.checkOut.getTime() - record.checkIn.getTime()) / 60000);
  }
  
  if (!record.flags.includes("manual_edit")) record.flags.push("manual_edit");
  record.editedBy = req.user._id;
  record.editReason = data.reason;
  
  await record.save();
  
  await writeAudit({
    actor: req.user._id,
    action: "EDIT_ATTENDANCE",
    target: record._id,
    before,
    after: record.toObject()
  });
  
  return ok(res, record);
});

const manualSchema = z.object({
  user: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkIn: z.string(),
  checkOut: z.string().optional(),
  status: z.enum(["present", "late"]),
  reason: z.string().min(1)
});

const manualAttendance = asyncHandler(async (req, res) => {
  const data = manualSchema.parse(req.body);
  
  const existing = await Attendance.findOne({ user: data.user, date: data.date });
  if (existing) throw new AppError("Record already exists for this date", 400, "DUPLICATE");
  
  let workingMins = 0;
  if (data.checkOut) {
    workingMins = Math.round((new Date(data.checkOut).getTime() - new Date(data.checkIn).getTime()) / 60000);
  }
  
  const record = await Attendance.create({
    user: data.user,
    date: data.date,
    checkIn: new Date(data.checkIn),
    checkOut: data.checkOut ? new Date(data.checkOut) : undefined,
    status: data.status,
    verifiedBy: "manual",
    workingMinutes: workingMins,
    flags: ["manual_edit"],
    editedBy: req.user._id,
    editReason: data.reason
  });
  
  await writeAudit({
    actor: req.user._id,
    action: "CREATE_MANUAL_ATTENDANCE",
    target: record._id,
    after: record.toObject()
  });
  
  return ok(res, record, 201);
});

module.exports = { scanPunch, getMe, getByDate, editAttendance, manualAttendance };
