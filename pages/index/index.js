const { request } = require('../../utils/request')
const app = getApp()

Page({
  data: {
    // 宠物基础信息
    pet: null,
    // 配方
    formula: null,
    ingredients: [],
    // 医学报告（成员C接口）
    report: null,
    // 今日养护（成员A接口）
    dailyCare: null,
    waterIntake: 0,
    waterPercent: 0,
    waterTarget: 1000,
    // 料程
    mealPlan: null,
    // 科普文章
    articles: [],
    // 会员信息（成员C接口）
    memberInfo: null,
    // 动画
    pulse: true,
    // 加载状态
    loading: true
  },

  onLoad() {
    this.checkLoginAndLoad()
    this.startPulse()
  },

  onReady() {
    // 雷达图等数据加载完后再画
  },

  onUnload() {
    if (this.pulseTimer) clearInterval(this.pulseTimer)
  },

  // 检查登录状态，没有 token 就跳登录页
  checkLoginAndLoad() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    app.globalData.token = token
    this.loadAllData()
  },

  // 并行拉取所有数据
  async loadAllData() {
    try {
      // 先拿宠物列表，取第一只
      const petRes = await request({ url: '/pets' })
      if (!petRes.data || petRes.data.length === 0) {
        console.log('宠物列表为空，停止加载')
        this.setData({ loading: false })
        return
      }
      const pet = petRes.data[0]
      // health_tags 后端用 TEXT 存储，需解析
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

      // 医学报告（成员C）
      if (reportRes.status === 'fulfilled' && reportRes.value.data) {
        const report = reportRes.value.data
        if (typeof report.radar_data === 'string') {
          report.radar_data = JSON.parse(report.radar_data || '{}')
        }
        this.setData({ report })
        // 数据就绪后画雷达图
        this.drawRadar(report.radar_data)
      }

      // 今日养护（成员A）
      if (careRes.status === 'fulfilled' && careRes.value.data) {
        const care = careRes.value.data
        if (typeof care.extra_records === 'string') {
          care.extra_records = JSON.parse(care.extra_records || '[]')
        }
        const waterTarget = care.water_target_ml || 1000
        this.setData({
          dailyCare: care,
          waterIntake: care.water_ml || 0,
          waterTarget,
          waterPercent: Math.min(((care.water_ml || 0) / waterTarget) * 100, 100)
        })
      }

      // 料程
      if (mealRes.status === 'fulfilled' && mealRes.value.data) {
        this.setData({ mealPlan: mealRes.value.data })
      }

      // 科普文章
      if (articleRes.status === 'fulfilled' && articleRes.value.data) {
        this.setData({ articles: articleRes.value.data.slice(0, 3) })
      }

      // 会员信息（成员C）
      if (memberRes.status === 'fulfilled' && memberRes.value.data) {
        this.setData({ memberInfo: memberRes.value.data })
      }

    } catch (e) {
      wx.showToast({ title: '数据加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  startPulse() {
    this.pulseTimer = setInterval(() => {
      this.setData({ pulse: !this.data.pulse })
    }, 2000)
  },

  // 点 +100ml
  async addWater() {
    const { waterIntake, waterTarget, pet } = this.data
    if (waterIntake >= waterTarget || !pet) return
    const next = Math.min(waterIntake + 100, waterTarget)
    this.setData({
      waterIntake: next,
      waterPercent: Math.min((next / waterTarget) * 100, 100)
    })
    wx.vibrateShort({ type: 'light' })
    // 同步到后端
    try {
      await request({
        url: `/pets/${pet.id}/daily-care/water`,
        method: 'POST',
        data: { add_ml: 100 }
      })
    } catch (e) { /* 静默失败，数据已在本地更新 */ }
  },

  // 分享档案
  onShareCard() {
    const { pet } = this.data
    wx.showModal({
      title: `分享${pet ? pet.name : ''}的档案`,
      content: '点击右上角「···」可分享给好友',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  onShareAppMessage() {
    const { pet } = this.data
    return {
      title: pet ? `${pet.name}的精准营养档案` : '妙巧巧·MPFD',
      path: '/pages/index/index'
    }
  },

  goJourneyDetail() {
    wx.navigateTo({ url: '/pages/journey/journey' })
  },

  goArticleDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/article-detail/article-detail?id=${id}` })
  },

  goReportDetail() {
    const { pet } = this.data
    if (pet) wx.navigateTo({ url: `/pages/medical-report/medical-report?petId=${pet.id}` })
  },

  // 雷达图绘制（接受真实数据）
  drawRadar(radarData) {
    // 把对象转成有序数组 [代谢, 心血管, 肾脏, 消化, 免疫, 骨骼]
    const keys = ['代谢系统', '心血管', '肾脏', '消化系统', '免疫系统', '骨骼肌肉']
    let dataValues
    if (radarData && typeof radarData === 'object') {
      dataValues = keys.map(k => (radarData[k] || 50) / 100)
    } else {
      dataValues = [0.88, 0.95, 0.45, 0.50, 0.90, 0.85]
    }

    const query = wx.createSelectorQuery().in(this)
    query.select('#radarCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getWindowInfo().pixelRatio || 2
        const width = res[0].width
        const height = res[0].height
        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)

        const cx = width / 2, cy = height / 2
        const maxR = Math.min(width, height) * 0.38
        const sides = 6, levels = 3
        const angles = Array.from({ length: sides }, (_, i) => -Math.PI / 2 + (2 * Math.PI / sides) * i)
        const getPoint = (angle, r) => ({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })

        // 网格
        for (let lv = 1; lv <= levels; lv++) {
          const r = (maxR / levels) * lv
          ctx.beginPath()
          angles.forEach((a, i) => { const p = getPoint(a, r); i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y) })
          ctx.closePath()
          ctx.strokeStyle = lv === levels ? '#E2E8F0' : '#F1F5F9'
          ctx.lineWidth = lv === levels ? 1.5 : 1
          ctx.stroke()
        }
        // 对角线
        ctx.strokeStyle = '#F1F5F9'; ctx.lineWidth = 1
        angles.forEach(a => { const p = getPoint(a, maxR); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p.x, p.y); ctx.stroke() })

        // 数据面
        ctx.beginPath()
        dataValues.forEach((v, i) => { const p = getPoint(angles[i], maxR * v); i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y) })
        ctx.closePath()
        ctx.fillStyle = 'rgba(59,102,245,0.15)'; ctx.fill()
        ctx.strokeStyle = '#3B66F5'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke()

        // 节点
        dataValues.forEach((v, i) => {
          const p = getPoint(angles[i], maxR * v)
          const isAlert = v < 0.6
          ctx.beginPath(); ctx.arc(p.x, p.y, isAlert ? 4 : 3, 0, 2 * Math.PI)
          ctx.fillStyle = isAlert ? '#EF4444' : '#3B66F5'; ctx.fill()
          if (isAlert) { ctx.beginPath(); ctx.arc(p.x, p.y, 5.5, 0, 2 * Math.PI); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5; ctx.stroke() }
        })
      })
  }
})