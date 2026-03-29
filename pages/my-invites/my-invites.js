const { request } = require('../../utils/request')

Page({
  data: {
    tab: 'invites', // invites | rewards
    invites: [],
    rewards: [],
    summary: { total_count: 0, available_fen: 0, used_fen: 0 },
    loading: true
  },

  onLoad() {
    this.loadData()
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const [inviteRes, rewardRes] = await Promise.allSettled([
        request({ url: '/invite/my-invites' }),
        request({ url: '/invite/my-rewards' })
      ])

      if (inviteRes.status === 'fulfilled' && inviteRes.value.data) {
        this.setData({ invites: inviteRes.value.data })
      }

      if (rewardRes.status === 'fulfilled' && rewardRes.value.data) {
        this.setData({
          rewards: rewardRes.value.data.rewards || [],
          summary: rewardRes.value.data.summary || { total_count: 0, available_fen: 0, used_fen: 0 }
        })
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab })
  },

  goBack() {
    wx.navigateBack()
  },

  getStatusText(status) {
    const map = {
      pending: '等待接受',
      accepted: '已接受',
      checkup_applied: '已申请体检',
      checkup_done: '体检完成',
      converted: '已转化'
    }
    return map[status] || status
  },

  getRewardStatusText(status) {
    const map = {
      pending: '待激活',
      active: '可使用',
      used: '已使用',
      expired: '已过期'
    }
    return map[status] || status
  }
})
