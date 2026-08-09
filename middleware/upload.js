const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB, per project decision
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg'];

function randomFilename(originalname) {
  const ext = path.extname(originalname) || '';
  return `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
}

// ---------------------------------------------------------------------------
// Delivery confirmation upload — proof photo (required) + voice note (optional)
// ---------------------------------------------------------------------------
const deliveryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.fieldname === 'voiceNote' ? 'voicenotes' : 'proofs';
    cb(null, path.join(__dirname, '..', 'uploads', folder));
  },
  filename: (req, file, cb) => cb(null, randomFilename(file.originalname)),
});

function deliveryFileFilter(req, file, cb) {
  if (file.fieldname === 'proofPhoto') {
    return cb(null, ALLOWED_IMAGE_TYPES.includes(file.mimetype));
  }
  if (file.fieldname === 'voiceNote') {
    return cb(null, ALLOWED_AUDIO_TYPES.includes(file.mimetype));
  }
  cb(null, false);
}

const uploadDelivery = multer({
  storage: deliveryStorage,
  fileFilter: deliveryFileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).fields([
  { name: 'proofPhoto', maxCount: 1 },
  { name: 'voiceNote', maxCount: 1 },
]);

// ---------------------------------------------------------------------------
// Profile image upload — used by donor/volunteer/NGO profile edit (future phase hook-in)
// ---------------------------------------------------------------------------
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'profiles')),
  filename: (req, file, cb) => cb(null, randomFilename(file.originalname)),
});

const uploadProfile = multer({
  storage: profileStorage,
  fileFilter: (req, file, cb) => cb(null, ALLOWED_IMAGE_TYPES.includes(file.mimetype)),
  limits: { fileSize: MAX_FILE_SIZE },
}).single('profileImage');

module.exports = { uploadDelivery, uploadProfile, MAX_FILE_SIZE };
