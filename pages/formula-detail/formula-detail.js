const { request } = require('../../utils/request')

Page({
  data: { formula: null, ingredients: [], loading: true },

  onLoad(options) {
    const petId = options.petId || 1
    this.loadFormula(petId)
  },

  async loadFormula(petId) {
    try {
      const res = await request({ url: `/pets/${petId}/formula` })
      if (res.data) {
        this.setData({
          formula: res.data.formula,
          ingredients: res.data.ingredients || []
        })
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  goBack() { wx.navigateBack() }
})
