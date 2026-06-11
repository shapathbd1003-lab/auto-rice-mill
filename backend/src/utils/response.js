function success(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

function paginated(res, data, total, page, limit, message = 'Success') {
  return res.json({
    success: true,
    message,
    data,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
}

function created(res, data, message = 'Created successfully') {
  return success(res, data, message, 201);
}

module.exports = { success, paginated, created };
