require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const http = require('http');

const connectDB = require('./config/db');
const { attachUser } = require('./middleware/auth');
const { initSockets } = require('./sockets');
const { isMapsConfigured } = require('./utils/mapsConfig');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
initSockets(server);

// ---------------------------------------------------------------------------
// Database connection
// ---------------------------------------------------------------------------
connectDB().then(() => {
  const { ensureBadgesSeeded } = require('./utils/badgeEngine');
  const { ensureLionsClubAdmin } = require('./utils/lionsClub');
  ensureBadgesSeeded().catch((err) => console.error('[server] Badge seeding failed:', err.message));
  ensureLionsClubAdmin().catch((err) => console.error('[server] Lions Club admin setup failed:', err.message));
});

// ---------------------------------------------------------------------------
// View engine
// ---------------------------------------------------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---------------------------------------------------------------------------
// Security & core middleware
// ---------------------------------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // 'unsafe-inline' is needed because views use inline <script>/<style>
        // blocks throughout rather than a nonce pipeline — a reasonable
        // trade-off for a server-rendered EJS app at this scale.
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://maps.googleapis.com', 'https://www.google.com', 'https://www.gstatic.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://maps.gstatic.com', 'https://maps.googleapis.com', 'https://*.google.com', 'https://*.googleusercontent.com'],
        frameSrc: ["'self'", 'https://www.google.com', 'https://www.google.com/maps/', 'https://maps.google.com'],
        connectSrc: ["'self'", 'https://maps.googleapis.com', 'ws:', 'wss:'],
      },
    },
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(mongoSanitize()); // strips $ and . from req.body/query/params to block NoSQL injection

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Attaches req.user + res.locals.currentUser on every request if a valid
// JWT cookie is present. Must run before routes.
app.use(attachUser);

// Exposes whether a real Google Maps key is configured so views can render
// an embedded map / Places picker, or fall back to plain address inputs and
// a "Directions" link (see utils/mapsConfig.js) — never send a broken map.
app.use((req, res, next) => {
  res.locals.mapsEnabled = isMapsConfigured();
  res.locals.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  res.locals.upiDonationEnabled = Boolean(process.env.NGO_UPI_ID);
  res.locals.upiId = process.env.NGO_UPI_ID || '';
  res.locals.upiName = process.env.NGO_UPI_NAME || 'AADHAR NGO';
  res.locals.upiUri = app.locals.upiUri || '';
  res.locals.upiQrDataUrl = app.locals.upiQrDataUrl || '';
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/', require('./routes/publicRoutes'));
app.use('/api/public', require('./routes/api/publicRoutes'));
app.use('/', require('./routes/authRoutes'));
app.use('/', require('./routes/dashboardRoutes'));
app.use('/donor', require('./routes/donorRoutes'));
app.use('/elderly', require('./routes/elderlyRoutes'));
app.use('/admin', require('./routes/ngoRoutes'));
app.use('/volunteer', require('./routes/volunteerRoutes'));

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page not found',
    message: "The page you're looking for doesn't exist.",
  });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'That file is too large — the limit is 5MB.'
        : 'There was a problem with your file upload. Please check the file type and try again.';
    return res.status(400).render('error', { title: 'Upload failed', message });
  }
  console.error('[server] Unhandled error:', err);
  res.status(500).render('error', {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again.',
  });
});

const PORT = process.env.PORT || 3000;
const upiId = process.env.NGO_UPI_ID || '';
const upiName = process.env.NGO_UPI_NAME || 'AADHAR NGO';
const upiUri = upiId ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&cu=INR` : '';

app.locals.upiUri = upiUri;
if (upiUri) {
  QRCode.toDataURL(upiUri)
    .then((dataUrl) => {
      app.locals.upiQrDataUrl = dataUrl;
    })
    .catch((err) => {
      app.locals.upiQrDataUrl = '';
      console.error('[server] Unable to generate UPI QR code:', err.message || err);
    });
}

server.listen(PORT, () => {
  console.log(`[server] AADHAR running at http://localhost:${PORT}`);
});

module.exports = { app, server };
