const app = getApp()

/**
 * 检查是否已登录
 * @returns {boolean}
 */
const isLoggedIn = () => {
  const token = wx.getStorageSync('token')
  return !!token
}

/**
 * 获取当前 token
 * @returns {string}
 */
const getToken = () => {
  return app.globalData.token || wx.getStorageSync('token') || ''
}

/**
 * 保存登录信息
 * @param {string} token - JWT token
 * @param {object} userInfo - 用户信息（可选）
 */
const saveLoginInfo = (token, userInfo) => {
  wx.setStorageSync('token', token)
  app.globalData.token = token
  if (userInfo) {
    if (userInfo.nickname) wx.setStorageSync('nickname', userInfo.nickname)
    if (userInfo.avatar_url) wx.setStorageSync('avatar', userInfo.avatar_url)
  }
}

/**
 * 清除登录信息并跳转登录页
 */
const logout = () => {
  wx.removeStorageSync('token')
  wx.removeStorageSync('nickname')
  wx.removeStorageSync('avatar')
  app.globalData.token = ''
  wx.redirectTo({ url: '/pages/login/login' })
}

/**
 * 检查登录状态，未登录则跳转登录页
 * @returns {boolean} 是否已登录
 */
const checkLogin = () => {
  if (!isLoggedIn()) {
    wx.redirectTo({ url: '/pages/login/login' })
    return false
  }
  // 确保 globalData 中有 token
  app.globalData.token = wx.getStorageSync('token')
  return true
}

module.exports = {
  isLoggedIn,
  getToken,
  saveLoginInfo,
  logout,
  checkLogin
}
