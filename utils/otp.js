function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // always 6 digits
}

module.exports = { generateOtp };
