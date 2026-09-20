# Attendance System Backend

The backend of the office attendance system is built with Node.js, Express, Mongoose, and MongoDB.

## Setup & Running

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Environment Configuration:**
   Copy `.env.example` to `.env` and fill in the values:
   ```bash
   cp .env.example .env
   ```
   *Make sure `JWT_SECRET` and `QR_SECRET` are long and distinct.*

3. **Seed the initial Admin:**
   ```bash
   npm run seed:admin
   ```

4. **Start the server:**
   - **Development** (hot-reload): `npm run dev`
   - **Production**: `npm start`

5. **Smoke test:**
   You can run the full suite using:
   ```bash
   npm run smoke
   ```

## API Endpoints

All endpoints (except `/api/health`, `/api/auth/login`, and `/api/qr/current`) require a `Bearer <token>` in the `Authorization` header.

### Auth (`/api/auth`)
- `POST /login`: Log in. Body: `{ identifier, password }`. Employees require `x-device-id` header.
- `POST /change-password`: Change password. Body: `{ currentPassword, newPassword }`.
- `GET /me`: Returns the current user's profile.

### Users (`/api/users`) - Admin Only
- `POST /`: Create employee. Body: `{ name, phone, email, employeeId, designation, department, shift }`.
- `GET /`: List employees with search, pagination, and `isActive` filters.
- `GET /:id`: Get specific user.
- `PATCH /:id`: Update fields.
- `DELETE /:id`: Soft delete user (sets `isActive=false`).
- `POST /:id/reset-password`: Reset password. Returns new temporary password.
- `POST /:id/reset-device`: Unbind device.

### Device Requests (`/api/device-requests`) - Admin Only
- `GET /`: List pending requests.
- `POST /:id/approve`: Approve request.
- `POST /:id/reject`: Reject request.

### QR (`/api/qr`)
- `GET /current`: Requires `x-display-key` header matching `DISPLAY_KEY` in `.env`. Returns a rotating QR URL.

### Attendance (`/api/attendance`)
- `POST /scan`: (Employee) Check in/out. Body `{ qrToken, lat, lng }`. Requires `x-device-id`.
- `GET /me`: (Employee) Get monthly attendance. Query: `month=YYYY-MM`.
- `GET /`: (Admin) Get daily attendance. Query: `date=YYYY-MM-DD`.
- `PATCH /:id`: (Admin) Manually edit a record. Body: `{ checkIn, checkOut, status, reason }`.
- `POST /manual`: (Admin) Manually create a record. Body: `{ user, date, checkIn, checkOut, status, reason }`.

### Leaves (`/api/leaves`)
- `POST /`: (Employee) Apply for leave. Body: `{ fromDate, toDate, type, reason }`.
- `GET /me`: (Employee) Get personal leave history.
- `GET /`: (Admin) Get all leaves.
- `PATCH /:id`: (Admin) Approve/reject a leave. Body: `{ status }`.

### Reports (`/api/reports`) - Admin Only
- `GET /summary`: Daily summary. Query: `date=YYYY-MM-DD`.
- `GET /monthly`: Monthly report. Query: `month=YYYY-MM`, `format=json|xlsx`. Downloads an Excel file if `format=xlsx`.

### Settings (`/api/settings`) - Admin Only
- `GET /`: Get settings.
- `PUT /`: Update settings. Body: `{ officeIps, geo, weeklyOff, minCheckoutGapMinutes }`.

### Holidays (`/api/holidays`) - Admin Only
- `GET /`: Get holidays.
- `POST /`: Create a holiday. Body: `{ date, title }`.
- `DELETE /:id`: Delete a holiday.
