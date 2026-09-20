"use strict";

/**
 * users.controller.js — Admin-only user management.
 *
 * POST   /              create employee
 * GET    /              list employees
 * GET    /:id           get one
 * PATCH  /:id           update fields
 * DELETE /:id           soft delete
 * POST   /:id/reset-password
 * POST   /:id/reset-device
 */

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { z } = require("zod");

const User = require("../models/User");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/respond");
const { sanitizeUser } = require("../utils/sanitizeUser");
const { writeAudit } = require("../utils/audit");

// ── Helpers ─────────────────────────────────────────────────────────

/** Generate a random 8-character alphanumeric temporary password */
function generateTempPassword() {
  return crypto.randomBytes(6).toString("base64url").slice(0, 8);
}

// ── Zod schemas ─────────────────────────────────────────────────────

const shiftSchema = z
  .object({
    start: z.string().regex(/^\d{2}:\d{2}$/, "shift.start must be HH:MM").optional(),
    end: z.string().regex(/^\d{2}:\d{2}$/, "shift.end must be HH:MM").optional(),
    graceMinutes: z.number().int().min(0).optional(),
  })
  .optional();

const createUserSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  employeeId: z.string().optional(),
  designation: z.string().optional(),
  department: z.string().optional(),
  shift: shiftSchema,
});

const updateUserSchema = z
  .object({
    name: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    email: z.string().email().optional().or(z.literal("")).nullable(),
    employeeId: z.string().optional(),
    designation: z.string().optional(),
    department: z.string().optional(),
    shift: shiftSchema,
    isActive: z.boolean().optional(),
  })
  .strict(); // no extra fields like passwordHash

// ── Controllers ─────────────────────────────────────────────────────

/**
 * POST /api/users — Create an employee account
 */
const createUser = asyncHandler(async (req, res) => {
  const data = createUserSchema.parse(req.body);

  // Temporary password shown once
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const createData = {
    ...data,
    passwordHash,
    role: "employee",
    mustChangePassword: true,
  };
  if (!createData.email) delete createData.email;

  const user = await User.create(createData);

  await writeAudit({
    actor: req.user._id,
    action: "CREATE_USER",
    target: user._id,
    after: sanitizeUser(user),
  });

  return ok(
    res,
    {
      user: sanitizeUser(user),
      temporaryPassword: tempPassword, // returned ONCE
    },
    201
  );
});

/**
 * GET /api/users — List employees with search, pagination, isActive filter
 */
const listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};

  // isActive filter (default: show all)
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === "true";
  }

  // Search across name, phone, employeeId
  if (req.query.search) {
    const re = new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: re }, { phone: re }, { employeeId: re }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("-passwordHash -__v")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return ok(res, {
    users,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

/**
 * GET /api/users/:id — Get one user
 */
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-passwordHash -__v").lean();
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
  return ok(res, user);
});

/**
 * PATCH /api/users/:id — Update allowed fields
 */
const updateUser = asyncHandler(async (req, res) => {
  const data = updateUserSchema.parse(req.body);

  const user = await User.findById(req.params.id);
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");

  const before = sanitizeUser(user);

  // Apply only provided fields
  Object.assign(user, data);
  if (data.email === "" || data.email === null) user.email = null;
  await user.save();

  const after = sanitizeUser(user);

  await writeAudit({
    actor: req.user._id,
    action: "UPDATE_USER",
    target: user._id,
    before,
    after,
  });

  return ok(res, sanitizeUser(user));
});

/**
 * DELETE /api/users/:id — Soft delete (isActive = false)
 */
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
  if (user.role === "admin") throw new AppError("Cannot deactivate an admin", 400, "FORBIDDEN");

  const before = sanitizeUser(user);
  user.isActive = false;
  await user.save();

  await writeAudit({
    actor: req.user._id,
    action: "DEACTIVATE_USER",
    target: user._id,
    before,
    after: sanitizeUser(user),
  });

  return ok(res, { message: "User deactivated" });
});

/**
 * POST /api/users/:id/reset-password — Generate new temp password
 */
const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");

  const tempPassword = generateTempPassword();
  user.passwordHash = await bcrypt.hash(tempPassword, 12);
  user.mustChangePassword = true;
  await user.save();

  await writeAudit({
    actor: req.user._id,
    action: "RESET_PASSWORD",
    target: user._id,
  });

  return ok(res, { temporaryPassword: tempPassword }); // returned ONCE
});

/**
 * POST /api/users/:id/reset-device — Unbind the user's registered device
 */
const resetDevice = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");

  const before = { deviceHash: user.deviceHash, deviceInfo: user.deviceInfo };

  user.deviceHash = null;
  user.deviceInfo = null;
  await user.save();

  await writeAudit({
    actor: req.user._id,
    action: "RESET_DEVICE",
    target: user._id,
    before,
    after: { deviceHash: null, deviceInfo: null },
  });

  return ok(res, { message: "Device reset. Employee will bind a new device on next login." });
});

module.exports = {
  createUser,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  resetPassword,
  resetDevice,
};
