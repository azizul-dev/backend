"use strict";

const { z } = require("zod");
const Holiday = require("../models/Holiday");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/respond");
const { writeAudit } = require("../utils/audit");

const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  title: z.string().min(1)
});

const getHolidays = asyncHandler(async (req, res) => {
  const holidays = await Holiday.find().sort({ date: 1 }).lean();
  return ok(res, holidays);
});

const createHoliday = asyncHandler(async (req, res) => {
  const data = holidaySchema.parse(req.body);
  
  let holiday;
  try {
    holiday = await Holiday.create(data);
  } catch (err) {
    if (err.code === 11000) throw new AppError("Holiday already exists on this date", 400, "DUPLICATE");
    throw err;
  }
  
  await writeAudit({
    actor: req.user._id,
    action: "CREATE_HOLIDAY",
    target: holiday._id,
    after: holiday.toObject()
  });

  return ok(res, holiday, 201);
});

const deleteHoliday = asyncHandler(async (req, res) => {
  const holiday = await Holiday.findById(req.params.id);
  if (!holiday) throw new AppError("Holiday not found", 404, "NOT_FOUND");
  
  const before = holiday.toObject();
  await holiday.deleteOne();
  
  await writeAudit({
    actor: req.user._id,
    action: "DELETE_HOLIDAY",
    target: holiday._id,
    before
  });

  return ok(res, { message: "Holiday deleted successfully" });
});

module.exports = { getHolidays, createHoliday, deleteHoliday };
