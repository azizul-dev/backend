"use strict";

/**
 * deviceRequests.controller.js — Admin management of pending device-change requests.
 *
 * GET  /              list requests (pending by default)
 * POST /:id/approve   apply newDeviceHash to user, mark approved
 * POST /:id/reject    mark rejected
 */

const DeviceRequest = require("../models/DeviceRequest");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/respond");
const { writeAudit } = require("../utils/audit");

/**
 * GET /api/device-requests
 * Query: status (default "pending"), page, limit
 */
const listRequests = asyncHandler(async (req, res) => {
  const status = req.query.status || "pending";
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};
  if (["pending", "approved", "rejected"].includes(status)) {
    filter.status = status;
  }

  const [requests, total] = await Promise.all([
    DeviceRequest.find(filter)
      .populate("user", "-passwordHash -__v")
      .populate("decidedBy", "name phone role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DeviceRequest.countDocuments(filter),
  ]);

  return ok(res, {
    requests,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

/**
 * POST /api/device-requests/:id/approve
 * Sets user.deviceHash = newDeviceHash, marks request approved.
 */
const approveRequest = asyncHandler(async (req, res) => {
  const request = await DeviceRequest.findById(req.params.id);
  if (!request) throw new AppError("Device request not found", 404, "NOT_FOUND");
  if (request.status !== "pending") {
    throw new AppError(`Request is already ${request.status}`, 400, "ALREADY_DECIDED");
  }

  const user = await User.findById(request.user);
  if (!user) throw new AppError("Associated user not found", 404, "NOT_FOUND");

  const before = { deviceHash: user.deviceHash };

  // Apply the new device
  user.deviceHash = request.newDeviceHash;
  user.deviceInfo = {
    userAgent: request.userAgent || "",
    boundAt: new Date(),
  };
  await user.save();

  request.status = "approved";
  request.decidedBy = req.user._id;
  await request.save();

  await writeAudit({
    actor: req.user._id,
    action: "APPROVE_DEVICE_REQUEST",
    target: request._id,
    before,
    after: { deviceHash: request.newDeviceHash },
  });

  return ok(res, { message: "Device request approved. New device is now active." });
});

/**
 * POST /api/device-requests/:id/reject
 */
const rejectRequest = asyncHandler(async (req, res) => {
  const request = await DeviceRequest.findById(req.params.id);
  if (!request) throw new AppError("Device request not found", 404, "NOT_FOUND");
  if (request.status !== "pending") {
    throw new AppError(`Request is already ${request.status}`, 400, "ALREADY_DECIDED");
  }

  request.status = "rejected";
  request.decidedBy = req.user._id;
  await request.save();

  await writeAudit({
    actor: req.user._id,
    action: "REJECT_DEVICE_REQUEST",
    target: request._id,
  });

  return ok(res, { message: "Device request rejected." });
});

module.exports = { listRequests, approveRequest, rejectRequest };
