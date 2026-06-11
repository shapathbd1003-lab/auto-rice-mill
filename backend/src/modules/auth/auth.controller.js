const authService = require('./auth.service');
const { success } = require('../../utils/response');

async function loginHandler(req, res) {
  const { email, password, millId } = req.body;
  const data = await authService.login(email, password, millId);
  success(res, data, 'Login successful');
}

async function refreshHandler(req, res) {
  const { refreshToken } = req.body;
  const data = await authService.refresh(refreshToken);
  success(res, data, 'Token refreshed');
}

async function logoutHandler(req, res) {
  const { refreshToken } = req.body;
  await authService.logout(refreshToken);
  success(res, null, 'Logged out');
}

async function meHandler(req, res) {
  success(res, req.user, 'Current user');
}

async function changePasswordHandler(req, res) {
  const { oldPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, oldPassword, newPassword);
  success(res, null, 'Password changed successfully');
}

module.exports = { loginHandler, refreshHandler, logoutHandler, meHandler, changePasswordHandler };
