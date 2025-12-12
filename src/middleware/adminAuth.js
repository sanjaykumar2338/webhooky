import config from '../config.js';

const realm = 'Templates';

const unauthorized = (res) => {
  res.set('WWW-Authenticate', `Basic realm="${realm}"`);
  return res.status(401).json({ message: 'Unauthorized' });
};

export const requireAdminAuth = (req, res, next) => {
  const { user, pass } = config.admin || {};

  if (!user || !pass) {
    return res
      .status(500)
      .json({ message: 'Admin credentials are not configured. Set ADMIN_USER and ADMIN_PASS.' });
  }

  const header = req.get('authorization') || '';
  const [scheme, encoded] = header.split(' ');

  if (scheme !== 'Basic' || !encoded) {
    return unauthorized(res);
  }

  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const separatorIndex = decoded.indexOf(':');

  if (separatorIndex === -1) {
    return unauthorized(res);
  }

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  if (username !== user || password !== pass) {
    return unauthorized(res);
  }

  return next();
};

export default requireAdminAuth;
