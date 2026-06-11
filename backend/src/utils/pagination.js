function getPagination(query) {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function buildSearchClause(fields, searchTerm) {
  if (!searchTerm) return { clause: '', params: [] };
  const conditions = fields.map((f, i) => `${f} ILIKE $${i + 1}`);
  const params = fields.map(() => `%${searchTerm}%`);
  return { clause: `(${conditions.join(' OR ')})`, params };
}

module.exports = { getPagination, buildSearchClause };
