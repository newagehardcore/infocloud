/**
 * Shared admin-token gate. Token is supplied via the X-Admin-Token header
 * (or ?token= for manual curl/browser use) and compared against ADMIN_TOKEN
 * from the environment.
 *
 * If ADMIN_TOKEN is not set, requests are allowed in development but
 * refused in production — so a deploy that forgets the token fails
 * closed instead of exposing admin surface to the internet.
 */

let warnedNoToken = false;

function isValidAdminToken(provided) {
  const configuredToken = process.env.ADMIN_TOKEN;

  if (!configuredToken) {
    if (process.env.NODE_ENV === 'production') return false;
    if (!warnedNoToken) {
      console.warn('[adminAuth] ADMIN_TOKEN not set — admin endpoints are UNPROTECTED (allowed in development only).');
      warnedNoToken = true;
    }
    return true;
  }

  return provided === configuredToken;
}

function tokenFromRequest(req) {
  return req.get('X-Admin-Token') || req.query.token;
}

// Gates mutating (non-GET) requests only. Use on routers that also serve
// public GET data, e.g. /api/news (the tag cloud itself must stay public).
function requireAdminForWrites(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  if (isValidAdminToken(tokenFromRequest(req))) return next();
  return res.status(401).json({ message: 'Admin token required. Send it in the X-Admin-Token header.' });
}

// Gates every request regardless of method. Use on routes/static files that
// have no public purpose at all — the admin panel, status, source config.
function requireAdminAlways(req, res, next) {
  if (isValidAdminToken(tokenFromRequest(req))) return next();
  return res.status(401).json({ message: 'Admin token required. Send it in the X-Admin-Token header.' });
}

module.exports = { requireAdminForWrites, requireAdminAlways, isValidAdminToken };
