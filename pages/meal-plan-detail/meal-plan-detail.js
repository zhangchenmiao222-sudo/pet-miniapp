const { request } = require('../../utils/request')

Page({
  data: { mealPlan: null, loading: true },

  onLoad(options) {
    const petId = options.petId || 1
    this.loadMealPlan(petId)
  },

  async loadMealPlan(petId) {
    try {
      const res = await request({ url: `/pets/${petId}/meal-plan` })
      if (res.data) this.setData({ mealPlan: res.data })
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  goBack() { wx.navigateBack() }
})
