const { isMapsConfigured } = require('./mapsConfig');

/**
 * Ranks destinations by real road distance/travel time from a single origin
 * using the Google Distance Matrix API (project decision: Distance Matrix,
 * not just straight-line Haversine — see Phase 5 planning).
 *
 * Returns an array parallel to `destinations`, each entry either
 * { distanceKm, durationMin } or null if that leg couldn't be resolved.
 * Returns null (not an array) if the API key isn't configured or the whole
 * request fails — callers should fall back to Haversine in that case.
 */
async function getDistanceMatrix(origin, destinations) {
  if (!isMapsConfigured() || destinations.length === 0) return null;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const originParam = `${origin.lat},${origin.lng}`;
  const destParam = destinations.map((d) => `${d.lat},${d.lng}`).join('|');

  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${encodeURIComponent(originParam)}` +
    `&destinations=${encodeURIComponent(destParam)}` +
    `&units=metric&key=${apiKey}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // don't hang the assignment page on a slow API
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'OK' || !data.rows?.[0]?.elements) return null;

    return data.rows[0].elements.map((el) => {
      if (el.status !== 'OK') return null;
      return {
        distanceKm: el.distance.value / 1000,
        durationMin: Math.round(el.duration.value / 60),
      };
    });
  } catch (err) {
    console.error('[distanceMatrix] request failed, falling back to Haversine:', err.message);
    return null;
  }
}

module.exports = { getDistanceMatrix };
