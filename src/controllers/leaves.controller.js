"use strict";

const { z } = require("zod");
const Leave = require("../models/Leave");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/respond");
const { writeAudit } = require("../utils/audit");

const applyLeaveSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  type: z.enum(["casual", "sick", "other"]),
  reason: z.string().min(1, "Reason is required"),
}).refine(data => data.fromDate <= data.toDate, {
  message: "fromDate must be less than or equal to toDate",
  path: ["toDate"]
});

const applyLeave = asyncHandler(async (req, res) => {
  const data = applyLeaveSchema.parse(req.body);

  const overlap = await Leave.findOne({
    user: req.user._id,
    status: { $in: ["pending", "approved"] },
    $or: [
      { fromDate: { $lte: data.toDate }, toDate: { $gte: data.fromDate } }
    ]
  });

  if (overlap) {
    throw new AppError("Leave request overlaps with an existing pending or approved leave.", 400, "OVERLAP");
  }

  const leave = await Leave.create({
    user: req.user._id,
    ...data,
    status: "pending"
  });

  return ok(res, leave, 201);
});

const getMyLeaves = asyncHandler(async (req, res) => {
  const leaves = await Leave.find({ user: req.user._id }).sort({ fromDate: -1 }).lean();
  return ok(res, leaves);
});

const listLeaves = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) {
    filter.status = req.query.status;
  }
  
  const leaves = await Leave.find(filter)
    .populate("user", "-passwordHash -__v")
    .sort({ fromDate: -1 })
    .lean();
    
  return ok(res, leaves);
});

const patchLeaveSchema = z.object({
  status: z.enum(["approved", "rejected"])
});

const patchLeave = asyncHandler(async (req, res) => {
  const data = patchLeaveSchema.parse(req.body);
  
  const leave = await Leave.findById(req.params.id);
  if (!leave) throw new AppError("Leave request not found", 404, "NOT_FOUND");
  if (leave.status !== "pending") throw new AppError(`Leave is already ${leave.status}`, 400, "ALREADY_DECIDED");
  
  const before = leave.toObject();
  
  leave.status = data.status;
  leave.decidedBy = req.user._id;
  leave.decidedAt = new Date();
  
  await leave.save();
  
  await writeAudit({
    actor: req.user._id,
    action: "UPDATE_LEAVE",
    target: leave._id,
    before,
    after: leave.toObject()
  });
  
  return ok(res, leave);
});

module.exports = { applyLeave, getMyLeaves, listLeaves, patchLeave };
