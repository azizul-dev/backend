"use strict";

const assert = require("assert");
const { spawn, execSync } = require("child_process");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

let testUri = process.env.MONGODB_URI;
if (testUri.includes("?")) {
  testUri = testUri.replace(/\?/, "attendance_test?");
} else if (testUri.endsWith("/")) {
  testUri += "attendance_test";
} else {
  testUri += "/attendance_test";
}

const PORT = 5005;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

const env = Object.assign({}, process.env, {
  MONGODB_URI: testUri,
  PORT: PORT.toString(),
  DISABLE_OFFICE_CHECK: "false" // Enforce real office check
});

let adminToken = "";
let empToken = "";
let tempPassword = "";
let empId = "";
let reqId = "";
let qrToken = "";
let leaveId = "";
let originalSettings = null;
let serverProcess;

const ADMIN_CREDENTIALS = {
  identifier: "01700000000",
  password: "Admin@1234"
};

const EMP_CREDENTIALS = {
  name: "Smoke Test Employee",
  phone: "01" + Math.floor(Math.random() * 1000000000).toString().padStart(9, "0"),
  employeeId: "SMOKE-1"
};

async function req(apiPath, opts = {}) {
  const res = await fetch(BASE_URL + apiPath, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {})
    }
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch (e) {
    return { status: res.status, data: text };
  }
}

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(BASE_URL + "/health");
      if (res.status === 200) return;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error("Server failed to start");
}

async function run() {
  console.log(`Using Test DB: ${testUri}`);
  
  // 1. Initial cleanup
  await mongoose.connect(testUri);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log("Test database cleared.");

  // 2. Seed Admin
  console.log("Seeding admin...");
  execSync("node src/seed/admin.js", { env, cwd: path.join(__dirname, ".."), stdio: "inherit" });

  // 3. Start Server
  console.log(`Starting server on port ${PORT}...`);
  serverProcess = spawn("node", ["src/server.js"], { env, cwd: path.join(__dirname, "..") });
  
  // Ensure server is killed if script exits
  process.on('exit', () => serverProcess && serverProcess.kill());
  
  await waitForServer();
  console.log("Server is up. Starting tests...\n");

  try {
    // 1. Admin login
    console.log("1. Admin Login");
    let res = await req("/auth/login", {
      method: "POST",
      body: JSON.stringify(ADMIN_CREDENTIALS)
    });
    assert.strictEqual(res.status, 200, "Admin login failed");
    adminToken = res.data.data.token;
    console.log("✅ PASS");

    // 2. Store original Settings and temporarily update officeIps
    console.log("2. Setup Test Office IP");
    res = await req("/settings", {
      method: "GET",
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200, "Fetch settings failed");
    originalSettings = res.data.data;
    
    res = await req("/settings", {
      method: "PUT",
      headers: { "Authorization": `Bearer ${adminToken}` },
      body: JSON.stringify({
        ...originalSettings,
        officeIps: [...(originalSettings.officeIps || []), "127.0.0.1", "::ffff:127.0.0.1", "::1"]
      })
    });
    assert.strictEqual(res.status, 200, "Update settings failed");
    console.log("✅ PASS");

    // 3. Create employee
    console.log("3. Create Employee");
    res = await req("/users", {
      method: "POST",
      headers: { "Authorization": `Bearer ${adminToken}` },
      body: JSON.stringify(EMP_CREDENTIALS)
    });
    if (res.status !== 201) console.error(res.data);
    assert.strictEqual(res.status, 201, "Create employee failed");
    tempPassword = res.data.data.temporaryPassword;
    empId = res.data.data.user._id;
    console.log("✅ PASS");

    // 4. Employee first login (device A)
    console.log("4. Employee First Login (Device Bind)");
    res = await req("/auth/login", {
      method: "POST",
      headers: { "x-device-id": "device-A" },
      body: JSON.stringify({ identifier: EMP_CREDENTIALS.phone, password: tempPassword })
    });
    assert.strictEqual(res.status, 200, "Employee first login failed");
    empToken = res.data.data.token;
    console.log("✅ PASS");

    // 5. Change password
    console.log("5. Change Password");
    res = await req("/auth/change-password", {
      method: "POST",
      headers: { "Authorization": `Bearer ${empToken}` },
      body: JSON.stringify({ currentPassword: tempPassword, newPassword: "NewPassword123" })
    });
    assert.strictEqual(res.status, 200, "Change password failed");
    console.log("✅ PASS");

    // 6. Wrong-device login
    console.log("6. Wrong-device Login (DEVICE_MISMATCH)");
    res = await req("/auth/login", {
      method: "POST",
      headers: { "x-device-id": "device-B" },
      body: JSON.stringify({ identifier: EMP_CREDENTIALS.phone, password: "NewPassword123" })
    });
    assert.strictEqual(res.status, 403, "Expected 403");
    assert.strictEqual(res.data.code, "DEVICE_MISMATCH", "Expected DEVICE_MISMATCH");
    console.log("✅ PASS");

    // 7. Admin approves device request
    console.log("7. Admin approves device request");
    res = await req("/device-requests?status=pending", {
      method: "GET",
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    const pendingReq = res.data.data.requests.find(r => r.user._id === empId);
    assert.ok(pendingReq, "Pending request not found");
    reqId = pendingReq._id;

    res = await req(`/device-requests/${reqId}/approve`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200, "Approve failed");
    console.log("✅ PASS");

    // 8. Fetch QR
    console.log("8. Fetch QR");
    res = await req("/qr/current", {
      method: "GET",
      headers: { "x-display-key": process.env.DISPLAY_KEY || "change_me_display_key" }
    });
    assert.strictEqual(res.status, 200, "Fetch QR failed");
    const url = new URL(res.data.data.url);
    qrToken = url.searchParams.get("t");
    console.log("✅ PASS");

    // 9. Employee scan (check-in)
    console.log("9. Employee Scan (Check-in)");
    res = await req("/attendance/scan", {
      method: "POST",
      headers: { "Authorization": `Bearer ${empToken}`, "x-device-id": "device-B" },
      body: JSON.stringify({ qrToken })
    });
    assert.strictEqual(res.status, 200, "Scan failed");
    console.log("✅ PASS");

    // 10. Scan again (TOO_SOON)
    console.log("10. Scan again (TOO_SOON)");
    res = await req("/attendance/scan", {
      method: "POST",
      headers: { "Authorization": `Bearer ${empToken}`, "x-device-id": "device-B" },
      body: JSON.stringify({ qrToken })
    });
    assert.strictEqual(res.status, 400, "Expected 400");
    assert.strictEqual(res.data.code, "TOO_SOON", "Expected TOO_SOON");
    console.log("✅ PASS");

    // 11. Leave apply
    console.log("11. Leave Apply");
    const today = new Date().toISOString().split('T')[0];
    res = await req("/leaves", {
      method: "POST",
      headers: { "Authorization": `Bearer ${empToken}` },
      body: JSON.stringify({ fromDate: today, toDate: today, type: "casual", reason: "Smoke test leave" })
    });
    assert.strictEqual(res.status, 201, "Leave apply failed");
    leaveId = res.data.data._id;
    console.log("✅ PASS");

    // 12. Leave approve
    console.log("12. Leave Approve");
    res = await req(`/leaves/${leaveId}`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "approved" })
    });
    assert.strictEqual(res.status, 200, "Leave approve failed");
    console.log("✅ PASS");

    // 13. Monthly report json
    console.log("13. Monthly Report JSON");
    const month = today.slice(0, 7);
    res = await req(`/reports/monthly?month=${month}`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200, "Monthly report failed");
    console.log("✅ PASS");

    // 14. Restore Settings
    console.log("14. Restore Settings");
    res = await req("/settings", {
      method: "PUT",
      headers: { "Authorization": `Bearer ${adminToken}` },
      body: JSON.stringify(originalSettings)
    });
    assert.strictEqual(res.status, 200, "Restore settings failed");
    console.log("✅ PASS");

    console.log("\nAll smoke tests passed! 🎉");
  } catch (err) {
    console.error("\n❌ FAILED:");
    console.error(err);
    process.exitCode = 1;
  } finally {
    console.log("\nCleaning up...");
    if (serverProcess) {
      serverProcess.kill();
    }
    try {
      await mongoose.connect(testUri);
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      console.log("Test database dropped.");
    } catch(e) {
      console.error("Cleanup failed:", e);
    }
    process.exit(process.exitCode || 0);
  }
}

run();
