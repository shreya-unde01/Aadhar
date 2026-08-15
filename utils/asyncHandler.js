/**
 * Wraps an async Express handler so a rejected promise is forwarded to
 * next(err) instead of becoming an unhandled rejection. Used on read-heavy
 * controllers that don't need bespoke error rendering (contrast with the
 * auth controller's manual try/catch, which renders form-specific errors)...
 */
module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
