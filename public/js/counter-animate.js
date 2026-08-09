/**
 * Animates elements with [data-count-to] from 0 up to their target value
 * once they scroll into view. Re-usable across the landing page and the
 * public impact dashboard.
 */
(function () {
  function animateCount(el) {
    var target = Number(el.dataset.countTo) || 0;
    var duration = 1200;
    var start = null;

    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = Math.round(eased * target).toLocaleString('en-IN');
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function bump(el, by) {
    var current = Number((el.textContent || '0').replace(/,/g, '')) || 0;
    el.dataset.countTo = current + by;
    animateCount(el);
  }

  window.AadharCounters = { animateCount: animateCount, bump: bump };

  document.addEventListener('DOMContentLoaded', function () {
    var els = document.querySelectorAll('[data-count-to]');
    if (els.length === 0) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );

    els.forEach(function (el) { observer.observe(el); });
  });
})();
