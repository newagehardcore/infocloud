/**
 * Guards mutating (non-GET) requests with a shared admin token.
 *
 * Token is supplied via the X-Admin-Token header (or ?token= for manual
 * curl use) and compared against ADMIN_TOKEN from the environment.
 *
 * If ADMIN_TOKEN is not set, requests are allowed in development but
 * refused in production — so a deploy that forgets the token fails
 * closed instead of exposing purge/refresh endpoints to the internet.
 */

let warnedNoToken = false;

function requireAdminForWrites(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const configuredToken = process.env.ADMIN_TOKEN;

  if (!configuredToken) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ message: 'ADMIN_TOKEN is not configured; admin endpoints are disabled.' });
    }
    if (!warnedNoToken) {
      console.warn('[adminAuth] ADMIN_TOKEN not set — admin endpoints are UNPROTECTED (allowed in development only).');
      warnedNoToken = true;
    }
    return next();
  }

  const provided = req.get('X-Admin-Token') || req.query.token;
  if (provided === configuredToken) {
    return next();
  }

  return res.status(401).json({ message: 'Admin token required. Send it in the X-Admin-Token header.' });
}

module.exports = { requireAdminForWrites };
