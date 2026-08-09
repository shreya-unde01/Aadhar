/**
 * Wires up a Places Autocomplete address field + a small draggable-pin map
 * that keeps hidden lat/lng inputs in sync. Called from the Google Maps JS
 * API's callback param once the script has loaded — see donation-form.ejs
 * and donation-bulk-form.ejs for the conditional <script> tags.
 */
function initAadharMapPicker({ addressInputId, latInputId, lngInputId, mapDivId, defaultLat = 20.0059, defaultLng = 73.7898 }) {
  const addressInput = document.getElementById(addressInputId);
  const latInput = document.getElementById(latInputId);
  const lngInput = document.getElementById(lngInputId);
  const mapDiv = document.getElementById(mapDivId);
  if (!addressInput || !mapDiv || typeof google === 'undefined') return;

  const startLat = parseFloat(latInput.value) || defaultLat;
  const startLng = parseFloat(lngInput.value) || defaultLng;

  const map = new google.maps.Map(mapDiv, { center: { lat: startLat, lng: startLng }, zoom: 13 });
  const marker = new google.maps.Marker({ position: { lat: startLat, lng: startLng }, map, draggable: true });

  function setLatLng(lat, lng) {
    latInput.value = lat;
    lngInput.value = lng;
  }
  setLatLng(startLat, startLng);

  marker.addListener('dragend', () => {
    const pos = marker.getPosition();
    setLatLng(pos.lat(), pos.lng());
  });

  map.addListener('click', (e) => {
    marker.setPosition(e.latLng);
    setLatLng(e.latLng.lat(), e.latLng.lng());
  });

  const autocomplete = new google.maps.places.Autocomplete(addressInput, { fields: ['formatted_address', 'geometry'] });
  autocomplete.bindTo('bounds', map);
  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    if (!place.geometry || !place.geometry.location) return;
    const loc = place.geometry.location;
    map.setCenter(loc);
    map.setZoom(15);
    marker.setPosition(loc);
    setLatLng(loc.lat(), loc.lng());
    if (place.formatted_address) addressInput.value = place.formatted_address;
  });
}
