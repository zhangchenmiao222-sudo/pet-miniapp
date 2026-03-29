const { request } = require('../../utils/request')
const app = getApp()

Page({
  data: {
    // 宠物信息
    pet: null,
    // 配方信息
    formula: null,
    ingredients: [],
    // 医学报告
    report: null,
    // 今日养护
    dailyCare: null,
    // 料程
    mealPlan: null,
    // 科普文章
    article: null,
    // 会员信息
    member: null,
    // 加载状态
    loading: true
  },

  onLoad() {
    this.checkLoginAndLoad()
  },

  onShow() {
    // 从其他页面返回时刷新数据
    if (this.data.pet && !this.data.loading) {
      this.loadAllData()
    }
  },

  checkLoginAndLoad() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    app.globalData.token = token
    this.loadAllData()
  },

  async loadAllData() {
    try {
      // 先拿宠物列表，取第一只
      const petRes = await request({ url: '/pets' })
      if (!petRes.data || petRes.data.length === 0) {
        this.setData({ loading: false })
        return
      }
      const pet = petRes.data[0]
      if (typeof pet.health_tags === 'string') {
        pet.health_tags = JSON.parse(pet.health_tags || '[]')
      }
      this.setData({ pet })

      const petId = pet.id

      // 并行请求其余数据
      const [formulaRes, reportRes, careRes, mealRes, articleRes, memberRes] = await Promise.allSettled([
        request({ url: `/pets/${petId}/formula` }),
        request({ url: `/pets/${petId}/medical-report` }),
        request({ url: `/pets/${petId}/daily-care/today` }),
        request({ url: `/pets/${petId}/meal-plan` }),
        request({ url: '/articles' }),
        request({ url: '/member/info' })
      ])

      // 配方
      if (formulaRes.status === 'fulfilled' && formulaRes.value.data) {
        this.setData({
          formula: formulaRes.value.data.formula,
          ingredients: formulaRes.value.data.ingredients || []
        })
      }

      // 医学报告
      if (reportRes.status === 'fulfilled' && reportRes.value.data) {
        const report = reportRes.value.data
        if (typeof report.radar_data === 'string') {
          report.radar_data = JSON.parse(report.radar_data || '{}')
        }
        this.setData({ report })
      }

      // 今日养护
      if (careRes.status === 'fulfilled' && careRes.value.data) {
        const care = careRes.value.data
        if (typeof care.extra_records === 'string') {
          care.extra_records = JSON.parse(care.extra_records || '[]')
        }
        this.setData({ dailyCare: care })
      }

      // 料程
      if (mealRes.status === 'fulfilled' && mealRes.value.data) {
        this.setData({ mealPlan: mealRes.value.data })
      }

      // 科普文章（取第一篇做预览）
      if (articleRes.status === 'fulfilled' && articleRes.value.data) {
        const articles = articleRes.value.data
        if (articles.length > 0) {
          this.setData({
            article: {
              id: articles[0].id,
              title: articles[0].title,
              preview: articles[0].content ? articles[0].content.replace(/<[^>]+>/g, '').substring(0, 100) + '...' : ''
            }
          })
        }
      }

      // 会员信息
      if (memberRes.status === 'fulfilled' && memberRes.value.data) {
        const memberData = memberRes.value.data
        this.setData({
          member: {
            type: memberData.member_type || 'none',
            price: memberData.member_type === 'yearly' ? 128 : memberData.member_type === 'quarterly' ? 48 : 18
          }
        })
      }

    } catch (e) {
      wx.showToast({ title: '数据加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 饮水 +100ml
  async onAddWater() {
    if (!this.data.dailyCare || !this.data.pet) return
    const newWater = this.data.dailyCare.water_ml + 100
    this.setData({ 'dailyCare.water_ml': newWater })
    wx.vibrateShort({ type: 'light' })
    try {
      await request({
        url: `/pets/${this.data.pet.id}/daily-care/water`,
        method: 'POST',
        data: { add_ml: 100 }
      })
    } catch (e) { /* 静默失败，本地已更新 */ }
  },

  // 跳转配方详情
  onViewFormula() {
    const petId = this.data.pet ? this.data.pet.id : 1
    wx.navigateTo({ url: `/pages/formula-detail/formula-detail?petId=${petId}` })
  },

  // 跳转医学报告
  onViewReport() {
    const petId = this.data.pet ? this.data.pet.id : 1
    wx.navigateTo({ url: `/pages/medical-report/medical-report?petId=${petId}` })
  },

  // 跳转料程详情
  onViewMealPlan() {
    const petId = this.data.pet ? this.data.pet.id : 1
    wx.navigateTo({ url: `/pages/meal-plan-detail/meal-plan-detail?petId=${petId}` })
  },

  // 跳转文章详情
  onViewArticle() {
    const articleId = this.data.article ? this.data.article.id : ''
    if (articleId) {
      wx.navigateTo({ url: `/pages/article-detail/article-detail?id=${articleId}` })
    }
  },

  // 查看会员
  onViewMember() {
    wx.switchTab({ url: '/pages/profile/profile' })
  },

  // 添加额外记录
  async onAddExtra() {
    wx.showModal({
      title: '添加额外记录',
      editable: true,
      placeholderText: '如：西梅花茶 30g',
      success: async (res) => {
        if (res.confirm && res.content) {
          const parts = res.content.trim().split(' ')
          const name = parts[0] || res.content
          const amount = parts[1] || ''
          const list = [...(this.data.dailyCare.extra_records || []), { name, amount }]
          this.setData({ 'dailyCare.extra_records': list })
          // 同步到后端
          if (this.data.pet) {
            try {
              await request({
                url: `/pets/${this.data.pet.id}/daily-care/extra`,
                method: 'POST',
                data: { name, amount }
              })
            } catch (e) { /* 静默 */ }
          }
        }
      }
    })
  }
})
