const Joi = require('joi');

function validate(schema, property = 'body') {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[property], { abortEarly: false, stripUnknown: true });
    if (error) {
      const err = new Error(error.details.map((d) => d.message).join('; '));
      err.name = 'ValidationError';
      err.details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
      return next(err);
    }
    req[property] = value;
    next();
  };
}

module.exports = { validate, Joi };
