# AADHAR — The Soul Serves

A Smart Community Welfare Platform connecting NGOs, Volunteers, and Donors for food, clothes, grocery,
money, medicine, book, and skill donations — with live tracking, smart volunteer assignment, and a
public impact dashboard.

Built with Node.js, Express, MongoDB (Mongoose), EJS, vanilla JavaScript, and Socket.io. No frontend
framework, no build step — this is a classic server-rendered app you can run with `npm install && npm run dev`.

---

## 1. Prerequisites

- **Node.js 18 or later** (needed for native `fetch`, used by the Distance Matrix integration) — check with `node -v`
- **npm** (comes with Node)
- **MongoDB** — either a local install or a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster

---

## 2. Installation

```bash
cd aadhar
npm install
```

---

## 3. Set up your environment file

```bash
cp .env.example .env
```

Then open `.env` and fill in the values below.

| Variable | Required? | What it does |
|---|---|---|
| `PORT` | No (defaults to 3000) | Port the server runs on |
| `NODE_ENV` | No | `development` locally; only affects cookie security flags |
| `MONGO_URI` | **Yes** | Your MongoDB connection string (local or Atlas — see §4) |
| `JWT_SECRET` | **Yes** | Any long random string — signs login tokens |
| `COOKIE_SECRET` | **Yes** | Any long random string — used by cookie-parser |
| `BCRYPT_SALT_ROUNDS` | No (defaults to 10) | Password hashing cost |
| `RECAPTCHA_SITE_KEY` / `RECAPTCHA_SECRET_KEY` | No | Leave as the placeholder text to skip CAPTCHA verification entirely in dev. Add real [reCAPTCHA v2](https://www.google.com/recaptcha/admin) keys to enable it. |
| `GOOGLE_MAPS_API_KEY` | No | Leave as the placeholder text and the app falls back to plain address inputs + "Open in Google Maps" links everywhere. Add a real key (with Places, Maps Embed, and Distance Matrix APIs enabled) to unlock the map picker, embedded maps, and real travel-time volunteer ranking. |

Generate strong random secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Run it twice — once for `JWT_SECRET`, once for `COOKIE_SECRET`.

---

## 4. Set up MongoDB

**Option A — Local MongoDB**
1. Install [MongoDB Community Server](https://www.mongodb.com/try/download/community)
2. Start it (`mongod`, or as a background service)
3. Leave `MONGO_URI` as the default in `.env.example`:
   ```
   MONGO_URI=mongodb://127.0.0.1:27017/aadhar_dev
   ```

**Option B — MongoDB Atlas (free tier)**
1. Create a cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Get your connection string (Atlas → Connect → Drivers)
3. Paste it into `MONGO_URI` in `.env`

---

## 5. Seed demo data (recommended)

This populates the database with a full Lions Club demo dataset — one administrator, five volunteers in different approval
states, eight donors, and ~20 donations spread across every type and every stage of the pipeline
(pending, assigned, picked up, delivered, cancelled), plus feedback, badges, and an active emergency
alert. It goes through the app's real logic (not raw inserts), so reports, leaderboard scores, and
volunteer ratings are all populated correctly.

```bash
npm run seed
```

**⚠️ This wipes all existing data in the target database** — only run it against a dev database.

### Demo login credentials

| Role | Email | Password |
|---|---|---|
| Lions Club Admin | `lionsclubkopargaon@gmail.com` | `lion@#06` |
| Volunteer (approved) | `volunteer@aadhar.test` | `Password123!` |
| Donor | `donor@aadhar.test` | `Password123!` |

The seed script also creates a **pending-approval** volunteer (`kavita.v@aadhar.test`) and a
**deactivated** volunteer (`deepak.v@aadhar.test`) so you can test the NGO's volunteer-approval screens
without having to sign up new accounts.

If you'd rather start from a completely empty database, just skip this step and sign up fresh accounts
through the UI instead.

---

## 6. Run the server

```bash
npm run dev
```

You should see:
```
[db] MongoDB connected: 127.0.0.1/aadhar_dev
[server] AADHAR running at http://localhost:3000
```

Open **http://localhost:3000**.

`npm run dev` uses nodemon, so the server restarts automatically on file changes.
For a production-style run without auto-restart, use `npm start` instead.

---

## 7. Trying out each role

If you ran the seed script, log in directly with the credentials above. Otherwise, sign up donor and
volunteer accounts at `/signup`. The Lions Club administrator uses the seeded/provisioned account at `/admin/login`.

**As a Donor:**
- "Donate" → submit a single donation, or "Bulk Donation" for multiple items at once
- "My Donations" → see the tracking pipeline for anything you've submitted
- "Leaderboard" → see your rank and badges

**As an Admin:**
- "Volunteers" → approve the pending volunteer, or deactivate/reactivate existing ones
- "Donations" → assign a pending donation to a volunteer (ranked by distance/travel time)
- "Logistics" → see active pickups with a directions link
- "Reports" → daily/30-day impact totals
- "Emergency Mode" → declare an urgent zone; volunteers within range get notified live

**As a Volunteer:**
- Dashboard shows assigned tasks — Accept, then Mark Picked Up, then Confirm Delivery
- Confirming delivery requires the OTP generated when the NGO assigned the task (check the `Task`
  document in MongoDB directly if you need to look it up — there's no separate recipient-facing screen
  for this in the MVP), a star rating, a feedback category, and a proof photo (JPG/PNG, up to 5MB)

**Without logging in at all:**
- `/` — the landing page, with live animated impact counters
- `/impact` — the full public impact dashboard

Open the Lions Club admin dashboard and the public `/impact` page in two tabs side by side, then push a donation
through to "delivered" as the volunteer — you'll see both update live via Socket.io, no refresh needed.

---

## 8. Project structure

```
aadhar/
├── server.js              # App entry point — middleware, routes, Socket.io, error handling
├── config/db.js            # MongoDB connection
├── models/                 # Mongoose schemas (User + role discriminators, Donation, Task,
│                            # Feedback, Badge, Report, EmergencyAlert)
├── controllers/             # Route handlers, one file per role area
├── routes/                  # Express routers, mirrors controllers/ + routes/api for JSON endpoints
├── middleware/               # Auth, validation, rate limiting, file upload (Multer)
├── utils/                    # Badge/report/volunteer-stat triggers, geo/distance helpers,
│                            # OTP + donation code generation, the seed script
├── sockets/                 # Socket.io setup and emit helpers
├── views/                    # EJS templates, organized by role (donor/ngo/volunteer/public/auth)
├── public/                   # Static CSS/JS served directly (design tokens, client-side scripts)
└── uploads/                  # Delivery proof photos and voice notes (gitignored)
```

---

## 9. What's real vs. what's a documented fallback

Everything in this app is fully functional out of the box **except** two integrations that need keys
only you can provide, and both degrade gracefully rather than breaking anything if left unconfigured:

- **Google Maps** (Places picker, embedded maps, Distance Matrix ranking) — falls back to plain text
  address inputs and "Open in Google Maps" links
- **reCAPTCHA v2** on signup/login — silently skips verification if left as the placeholder key

Everything else — auth, the full donation lifecycle, volunteer assignment (Haversine-ranked without a
Maps key), badges, leaderboard, reports, emergency alerts, real-time updates, and the public impact
dashboard — works with zero external services beyond MongoDB.

---

## 10. Troubleshooting

**`MONGO_URI is not set in your .env file`** — Your `.env` file is missing, misnamed (must be exactly
`.env`, not `.env.txt`), in the wrong folder, or missing that line. See §3.

**`MongoDB connection failed: connect ECONNREFUSED`** — MongoDB isn't running, or your connection string
is wrong. If using local Mongo, make sure `mongod` is actually running before `npm run dev`.

**File upload errors on delivery confirmation** — Photos must be JPG or PNG, voice notes MP3/WAV/WebM,
both under 5MB.

**Map picker / embedded maps not showing** — Expected if `GOOGLE_MAPS_API_KEY` is left as the placeholder.
Add a real key to enable them (see §3).
