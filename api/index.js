const athletesHandler = require('./athletes');
const featuredHandler = require('./featured');
const detailsHandler = require('./athlete-details');

module.exports = async (req, res) => {
  const parsedUrl = require('url').parse(req.url, true);
  const pathname = parsedUrl.pathname;

  if (pathname.includes('featured')) {
    return featuredHandler(req, res);
  }
  if (pathname.includes('athlete-details')) {
    return detailsHandler(req, res);
  }
  return athletesHandler(req, res);
};
