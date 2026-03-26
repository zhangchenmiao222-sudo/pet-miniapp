const { request } = require('../../utils/request')
const app = getApp()

// 硬编码演示数据（未登录 / 无宠物时展示）
const DEMO_DATA = {
  pet: {
    id: 0, name: '示例犬', breed: '柯基', age_years: 4.5, weight_kg: 13.3,
    pet_no: 'MY-XXXX-XXXX', health_tags: ['肠胃敏感', '消化保护'],
    checkup_date: '2026-02-11'
  },
  formula: {
    id: 0, name: '低磷护肾·易消化膳', period_num: 8,
    core_indicator: '磷含量≤0.6%DM，升磷脱氧酶比',
    protein_pct: 29, fat_pct: 14, calories_per_100g: 80,
    special_nutrients: ['Omega-3', '牛磺酸'], goal_text: ''
  },
  ingredients: [
    { name: '鸡胸肉' }, { name: '鳕鱼' }, { name: '鸭胸肉' }
  ],
  report: {
    report_no: 'NO.XXXXX', verified: true, total_pages: 18,
    excellent_count: 7, observe_count: 5, intervene_count: 2,
    radar_data: { '消化系统': 88, '骨骼肌肉': 95, '皮肤毛发': 45, '心血管': 50, '免疫系统': 90, '内分泌': 85 }
  },
  dailyCare: {
    total_food_g: 683, meat_g: 228, middle_g: 228, veggie_g: 227,
    meals_count: 4, day_count: 23, water_ml: 420, water_target_ml: 1000,
    walk_completed: false, walk_plan_name: '舒缓低速环L',
    extra_records: [{ name: '西梅花茶', amount: '30g' }, { name: '蛋黄', amount: '半个' }]
  },
  waterIntake: 420,
  waterPercent: 42,
  waterTarget: 1000,
  mealPlan: {
    current_stage: 'additives', current_stage_label: '特殊添加剂制备',
    progress_pct: 65, planned_days: 15, is_live: true
  },
  articles: [{
    id: 0, title: '为什么说同型半胱氨酸是血管的「慢损指示器」？',
    category: '报告深度解读'
  }],
  alertFlags: [false, false, true, true, false, false]
}

Page({
  data: {
    // 页面状态: demo=未登录展示, locked=已登录无宠物, live=正常
    pageState: 'demo',
    // 宠物基础信息
    pet: null,
    // 配方
    formula: null,
    ingredients: [],
    // 医学报告
    report: null,
    // 今日养护
    dailyCare: null,
    waterIntake: 0,
    waterPercent: 0,
    waterTarget: 1000,
    // 料程
    mealPlan: null,
    // 科普文章
    articles: [],
    // 会员信息
    memberInfo: null,
    // 雷达图标红标记
    alertFlags: [false, false, false, false, false, false],
    // 动画
    pulse: true,
    // 加载状态
    loading: true,
    // 宠物信息表单
    showPetForm: false,
    petForm: { name: '', breed: '', weight_kg: '', age_years: '' },
    formSubmitting: false
  },

  onLoad() {
    this.startPulse()
  },

  onShow() {
    this.checkLoginAndLoad()
  },

  onReady() {},

  onUnload() {
    if (this.pulseTimer) clearInterval(this.pulseTimer)
  },

  // 三种状态判断
  checkLoginAndLoad() {
    const token = wx.getStorageSync('token')
    if (!token) {
      // 状态1：未登录 → 展示硬编码演示数据
      this.setData({
        pageState: 'demo',
        loading: false,
        ...DEMO_DATA
      })
      setTimeout(() => this.drawRadar(DEMO_DATA.report.radar_data), 300)
      return
    }
    app.globalData.token = token
    this.loadAllData()
  },

  // 并行拉取所有数据
  async loadAllData() {
    try {
      const petRes = await request({ url: '/pets' })
      if (!petRes.data || petRes.data.length === 0) {
        // 状态2：已登录但无宠物 → 模糊上锁 + 弹窗填写
        this.setData({
          pageState: 'locked',
          showPetForm: true,
          loading: false,
          ...DEMO_DATA
        })
        setTimeout(() => this.drawRadar(DEMO_DATA.report.radar_data), 300)
        return
      }

      // 状态3：正常展示真实数据
      const pet = petRes.data[0]
      if (typeof pet.health_tags === 'string') {
        pet.health_tags = JSON.parse(pet.health_tags || '[]')
      }
      this.setData({ pageState: 'live', pet })

      const petId = pet.id
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
        const keys = ['消化系统', '骨骼肌肉', '皮肤毛发', '心血管', '免疫系统', '内分泌']
        const alertFlags = keys.map(k => (report.radar_data[k] || 100) < 60)
        this.setData({ report, alertFlags })
        this.drawRadar(report.radar_data)
      }

      // 今日养护
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

      // 会员信息
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

  // ========== 表单相关 ==========
  onPetFormInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`petForm.${field}`]: e.detail.value })
  },

  async submitPetForm() {
    const { name, breed, weight_kg, age_years } = this.data.petForm
    if (!name.trim()) {
      wx.showToast({ title: '请填写宠物名字', icon: 'none' })
      return
    }
    this.setData({ formSubmitting: true })
    try {
      await request({
        url: '/pets',
        method: 'POST',
        data: {
          name: name.trim(),
          breed: breed.trim(),
          weight_kg: parseFloat(weight_kg) || 0,
          age_years: parseFloat(age_years) || 0
        }
      })
      wx.showToast({ title: '添加成功', icon: 'success' })
      this.setData({ showPetForm: false })
      // 重新加载真实数据
      this.loadAllData()
    } catch (e) {
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
    } finally {
      this.setData({ formSubmitting: false })
    }
  },

  closePetForm() {
    this.setData({ showPetForm: false })
  },

  // ========== 跳转相关（非 live 状态拦截） ==========
  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  addWater() {
    if (this.data.pageState !== 'live') {
      this._guardTip()
      return
    }
    const { waterIntake, waterTarget, pet } = this.data
    if (waterIntake >= waterTarget || !pet) return
    const next = Math.min(waterIntake + 100, waterTarget)
    this.setData({
      waterIntake: next,
      waterPercent: Math.min((next / waterTarget) * 100, 100)
    })
    wx.vibrateShort({ type: 'light' })
    request({
      url: `/pets/${pet.id}/daily-care/water`,
      method: 'POST',
      data: { add_ml: 100 }
    }).catch(() => {})
  },

  onShareCard() {
    if (this.data.pageState !== 'live') { this._guardTip(); return }
    const { pet } = this.data
    wx.showModal({
      title: `分享${pet ? pet.name : ''}的档案`,
      content: '点击右上角「···」可分享给好友',
      showCancel: false, confirmText: '知道了'
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
    if (this.data.pageState !== 'live') { this._guardTip(); return }
    wx.navigateTo({ url: '/pages/journey/journey' })
  },

  goArticleDetail(e) {
    if (this.data.pageState !== 'live') { this._guardTip(); return }
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/article-detail/article-detail?id=${id}` })
  },

  goReportDetail() {
    if (this.data.pageState !== 'live') { this._guardTip(); return }
    const { pet } = this.data
    if (pet) wx.navigateTo({ url: `/pages/medical-report/medical-report?petId=${pet.id}` })
  },

  _guardTip() {
    if (this.data.pageState === 'demo') {
      wx.showToast({ title: '请先登录', icon: 'none' })
    } else {
      this.setData({ showPetForm: true })
      wx.showToast({ title: '请先填写宠物信息', icon: 'none' })
    }
  },

  // 雷达图绘制
  drawRadar(radarData) {
    const keys = ['消化系统', '骨骼肌肉', '皮肤毛发', '心血管', '免疫系统', '内分泌']
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
