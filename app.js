App({
  globalData: {
    // 开发阶段用本地地址，部署后换成服务器地址
    baseURL: 'http://82.157.202.238:3003/api',
    token: ''
  },

  onLaunch() {
    // 启动时读取本地存储的 token
    const token = wx.getStorageSync('token')
    if (token) {
      this.globalData.token = token
    }
  }
})