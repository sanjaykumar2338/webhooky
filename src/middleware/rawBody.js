export const captureRawBody = (req, res, next) => {
  let data = '';
  req.setEncoding('utf8');
  
  req.on('data', (chunk) => {
    data += chunk;
  });
  
  req.on('end', () => {
    req.rawBody = data;
    try {
      req.body = JSON.parse(data);
    } catch (error) {
      req.body = {};
    }
    next();
  });
};

export default captureRawBody;