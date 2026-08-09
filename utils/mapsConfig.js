function isMapsConfigured() {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  return Boolean(key && key !== 'your_google_maps_api_key_here');
}

module.exports = { isMapsConfigured };
