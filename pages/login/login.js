const { request } = require('../../utils/request')
const app = getApp()

Page({
  data: {
    loading: false
  },

  onLoad() {
    // 已有 token 就直接跳主页
    const token = wx.getStorageSync('token')
    if (token) {
      app.globalData.token = token
      wx.switchTab({ url: '/pages/index/index' })
    }
  },

  // 点击登录按钮
  async onLogin() {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      // 第一步：获取微信 code
      const { code } = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        })
      })

      // 第二步：用 code 换 token（不带 auth 头，直接调）
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: app.globalData.baseURL + '/auth/wx-login',
          method: 'POST',
          data: { code },
          header: { 'Content-Type': 'application/json' },
          success: (r) => resolve(r.data),
          fail: reject
        })
      })

      console.log('登录返回结果:', JSON.stringify(res))
      if (res.code === 200) {
        const { token } = res.data
        console.log('登录成功, userId:', res.data.user && res.data.user.id)
        app.globalData.token = token
        wx.setStorageSync('token', token)
        // 登录成功 → 跳主页
        wx.switchTab({ url: '/pages/index/index' })
      } else {
        console.log('登录失败:', res.code, res.message)
        wx.showToast({ title: res.message || '登录失败', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '网络异常，请重试', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
