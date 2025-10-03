const AuditLog = require("../models/AuditLog");

const auditMiddleware = (action, targetType, getTargetId = null, getDetails = null) => {
  return async (req, res, next) => {
    // Capture original res.json to log successful responses
    const originalJson = res.json;
    res.json = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        let userId = req.user ? req.user.id : null;
        const ipAddress = req.ip;
        const targetId = getTargetId ? getTargetId(req, body) : null;
        const details = getDetails ? getDetails(req, body) : null;

        // Special case for login/register: the user isn't in req.user yet.
        if ((action === "login" || action === "register") && body && body.user) {
          userId = body.user.id;
        }

        AuditLog.createLog(
          userId,
          action,
          targetType,
          targetId,
          details,
          ipAddress
        );
      }
      originalJson.call(this, body);
    };

    // Capture errors
    res.on('finish', () => {
      if (res.statusCode >= 400) {
        const userId = req.user ? req.user.id : null;
        const ipAddress = req.ip;
        const targetId = getTargetId ? getTargetId(req) : null;
        const details = { error: res.statusMessage || 'Unknown error', statusCode: res.statusCode };
        AuditLog.createLog(userId, `FAILED_${action}`, targetType, targetId, details, ipAddress);
      }
    });

    next();
  };
};

module.exports = auditMiddleware;
