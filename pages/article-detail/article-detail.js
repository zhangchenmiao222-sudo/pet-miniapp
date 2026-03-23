const { request } = require('../../utils/request')

Page({
  data: { article: null, loading: true },

  onLoad(options) {
    const { id } = options
    if (id) this.loadArticle(id)
  },

  async loadArticle(id) {
    try {
      const res = await request({ url: `/articles/${id}` })
      if (res.data) this.setData({ article: res.data })
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  goBack() { wx.navigateBack() }
})
