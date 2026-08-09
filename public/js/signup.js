(function () {
  var form = document.getElementById('signup-form');
  if (!form) return;

  var roleRadios = form.querySelectorAll('input[name="role"]');
  var donorTypeSelect = document.getElementById('donorType');
  var roleSpecificFields = form.querySelectorAll('.role-specific');

  function currentRole() {
    var checked = form.querySelector('input[name="role"]:checked');
    return checked ? checked.value : 'donor';
  }

  function currentDonorType() {
    return donorTypeSelect ? donorTypeSelect.value : 'individual';
  }

  function setFieldEnabled(fieldWrap, enabled) {
    fieldWrap.style.display = enabled ? '' : 'none';
    var inputs = fieldWrap.querySelectorAll('input, select, textarea');
    inputs.forEach(function (input) {
      input.disabled = !enabled;
      if (!enabled) input.removeAttribute('required');
    });
  }

  function refresh() {
    var role = currentRole();
    var donorType = currentDonorType();

    roleSpecificFields.forEach(function (fieldWrap) {
      var forRole = fieldWrap.getAttribute('data-role');
      var matchesRole = forRole === role;

      if (matchesRole && fieldWrap.hasAttribute('data-donor-type')) {
        var allowedTypes = fieldWrap.getAttribute('data-donor-type').split(',');
        setFieldEnabled(fieldWrap, allowedTypes.indexOf(donorType) !== -1);
      } else {
        setFieldEnabled(fieldWrap, matchesRole);
      }
    });
  }

  roleRadios.forEach(function (radio) {
    radio.addEventListener('change', refresh);
  });
  if (donorTypeSelect) {
    donorTypeSelect.addEventListener('change', refresh);
  }

  refresh();
})();
