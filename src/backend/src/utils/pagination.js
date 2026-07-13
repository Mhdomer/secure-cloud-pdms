'use strict';

const { PAGINATION } = require('../config/constants');

/** Clamp query-string page/limit params to safe bounds and derive offset. */
function parsePagination(query) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (!Number.isInteger(page) || page < 1) page = PAGINATION.DEFAULT_PAGE;
  if (!Number.isInteger(limit) || limit < 1) limit = PAGINATION.DEFAULT_LIMIT;
  if (limit > PAGINATION.MAX_LIMIT) limit = PAGINATION.MAX_LIMIT;

  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

module.exports = { parsePagination };
