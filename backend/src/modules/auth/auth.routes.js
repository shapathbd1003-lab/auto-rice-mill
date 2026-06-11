const router = require('express').Router();
const { validate, Joi } = require('../../middleware/validate');
const { requireAuth } = require('../../middleware/auth');
const ctrl = require('./auth.controller');

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  millId: Joi.number().integer().positive().required(),
});

const refreshSchema = Joi.object({ refreshToken: Joi.string().required() });

const changePwdSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
});

router.post('/login',           validate(loginSchema),     ctrl.loginHandler);
router.post('/refresh',         validate(refreshSchema),   ctrl.refreshHandler);
router.post('/logout',          validate(refreshSchema),   ctrl.logoutHandler);
router.get('/me',               requireAuth,               ctrl.meHandler);
router.put('/change-password',  requireAuth, validate(changePwdSchema), ctrl.changePasswordHandler);

module.exports = router;
