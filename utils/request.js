const app = getApp()

/**
 * 统一请求封装
 * 所有API请求都通过这个方法发送，自动带上token和baseURL
 */
const request = (options) => {
  return new Promise((resolve, reject) => {
    const token = app.globalData.token || wx.getStorageSync('token')
    const baseURL = app.globalData.baseURL

    wx.request({
      url: baseURL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success(res) {
        if (res.data.code === 200) {
          resolve(res.data)
        } else if (res.data.code === 401) {
          // token 过期，跳转登录
          wx.removeStorageSync('token')
          wx.redirectTo({ url: '/pages/login/login' })
          reject(res.data)
        } else {
          wx.showToast({
            title: res.data.message || '请求失败',
            icon: 'none'
          })
          reject(res.data)
        }
      },
      fail(err) {
        wx.showToast({
          title: '网络异常，请检查连接',
          icon: 'none'
        })
        reject(err)
      }
    })
  })
}

module.exports = { request }
