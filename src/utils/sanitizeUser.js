"use strict";

/**
 * sanitizeUser.js — Strip sensitive fields before sending a User to the client.
 */

/**
 * @param {import('../models/User').UserDoc} user — Mongoose document or plain object
 * @returns {object} safe user representation
 */
function sanitizeUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
}

module.exports = { sanitizeUser };
