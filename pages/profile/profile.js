const { request } = require('../../utils/request')
const app = getApp()

Page({
  data: {
    userInfo: null,
    memberInfo: null,
    pet: null,
    loading: true
  },

  onLoad() {
    this.loadUserData()
  },

  onShow() {
    // 每次显示刷新数据
    if (this.data.userInfo) this.loadUserData()
  },

  async loadUserData() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    try {
      const [memberRes, petRes] = await Promise.allSettled([
        request({ url: '/member/info' }),
        request({ url: '/pets' })
      ])

      if (memberRes.status === 'fulfilled' && memberRes.value.data) {
        this.setData({ memberInfo: memberRes.value.data })
      }

      if (petRes.status === 'fulfilled' && petRes.value.data) {
        const pets = petRes.value.data
        if (pets.length > 0) {
          const pet = pets[0]
          if (typeof pet.health_tags === 'string') {
            pet.health_tags = JSON.parse(pet.health_tags || '[]')
          }
          this.setData({ pet })
        }
      }

      // 用户基础信息从本地读取
      const nickname = wx.getStorageSync('nickname') || '宠物主人'
      const avatar = wx.getStorageSync('avatar') || ''
      this.setData({ userInfo: { nickname, avatar } })
    } catch (e) {
      console.error('加载用户数据失败', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 跳转会员购买
  onBuyMember() {
    wx.showModal({
      title: '开通会员',
      content: '年度会员 128元/年，享受全部专属功能',
      confirmText: '立即开通',
      success: async (res) => {
        if (res.confirm) {
          try {
            const payRes = await request({
              url: '/payment/create',
              method: 'POST',
              data: { plan_type: 'yearly' }
            })
            if (payRes.data && payRes.data.payParams) {
              wx.requestPayment({
                ...payRes.data.payParams,
                success: () => {
                  wx.showToast({ title: '支付成功' })
                  this.loadUserData()
                },
                fail: () => {
                  wx.showToast({ title: '支付取消', icon: 'none' })
                }
              })
            } else {
              wx.showToast({ title: '会员开通成功' })
              this.loadUserData()
            }
          } catch (e) {
            wx.showToast({ title: '开通失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 查看隐私协议
  onViewPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' })
  },

  // 退出登录
  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token')
          wx.removeStorageSync('nickname')
          wx.removeStorageSync('avatar')
          app.globalData.token = ''
          wx.redirectTo({ url: '/pages/login/login' })
        }
      }
    })
  },

  // 联系客服
  onContact() {
    wx.showModal({
      title: '联系我们',
      content: '邮箱：support@miaoqiaoqiao.com',
      showCancel: false,
      confirmText: '知道了'
    })
  }
})
