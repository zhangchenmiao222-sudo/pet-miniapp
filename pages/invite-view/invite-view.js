const { request } = require('../../utils/request')

Page({
  data: {
    inviteCode: '',
    loading: true,
    // 母号数据
    parent: null,
    pet: null,
    formula: null,
    report: null,
    dailyCare: null,
    mealPlan: null,
    // 雷达图
    alertFlags: [false, false, false, false, false, false],
    // 体检申请弹窗
    showApplyForm: false,
    applyForm: {
      pet_name: '',
      pet_breed: '',
      pet_age: '',
      pet_weight: '',
      contact_name: '',
      contact_phone: '',
      address: ''
    },
    submitting: false,
    // 是否已申请
    applied: false
  },

  onLoad(options) {
    if (options.code) {
      this.setData({ inviteCode: options.code })
      this.loadParentPage(options.code)
    }
  },

  async loadParentPage(code) {
    try {
      // 公开接口，不需要token
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `https://miaoqiaoqiao.com/pet-api/invite/parent-page/${code}`,
          method: 'GET',
          success: (r) => resolve(r.data),
          fail: reject
        })
      })

      if (res.code !== 200 || !res.data) {
        wx.showToast({ title: '邀请链接无效', icon: 'none' })
        return
      }

      const data = res.data
      const pet = data.pet
      const report = data.report

      // 处理 JSON 字段
      if (pet && typeof pet.health_tags === 'string') {
        pet.health_tags = JSON.parse(pet.health_tags || '[]')
      }
      if (report && typeof report.radar_data === 'string') {
        report.radar_data = JSON.parse(report.radar_data || '{}')
      }
      if (data.formula && typeof data.formula.special_nutrients === 'string') {
        data.formula.special_nutrients = JSON.parse(data.formula.special_nutrients || '[]')
      }
      if (data.dailyCare && typeof data.dailyCare.extra_records === 'string') {
        data.dailyCare.extra_records = JSON.parse(data.dailyCare.extra_records || '[]')
      }

      // 雷达图标红
      let alertFlags = [false, false, false, false, false, false]
      if (report && report.radar_data) {
        const keys = ['消化系统', '骨骼肌肉', '皮肤毛发', '心血管', '免疫系统', '内分泌']
        alertFlags = keys.map(k => (report.radar_data[k] || 100) < 60)
      }

      this.setData({
        parent: data.parent,
        pet,
        formula: data.formula,
        report,
        dailyCare: data.dailyCare,
        mealPlan: data.mealPlan,
        alertFlags,
        loading: false
      })

      if (report && report.radar_data) {
        setTimeout(() => this.drawRadar(report.radar_data), 300)
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  // 打开体检申请表单
  openApplyForm() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.showModal({
        title: '需要登录',
        content: '申请免费体检需要先登录微信',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' })
          }
        }
      })
      return
    }
    this.setData({ showApplyForm: true })
  },

  closeApplyForm() {
    this.setData({ showApplyForm: false })
  },

  onApplyInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`applyForm.${field}`]: e.detail.value })
  },

  async submitApply() {
    const form = this.data.applyForm
    if (!form.pet_name.trim()) {
      wx.showToast({ title: '请填写狗狗名字', icon: 'none' })
      return
    }
    if (!form.contact_phone.trim()) {
      wx.showToast({ title: '请填写联系电话', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      const res = await request({
        url: '/invite/apply-checkup',
        method: 'POST',
        data: {
          invite_code: this.data.inviteCode,
          ...form
        }
      })

      this.setData({ showApplyForm: false, applied: true })
      wx.showModal({
        title: '申请成功',
        content: '您的免费体检申请已提交！我们会尽快寄出采血包，请留意快递信息。',
        showCancel: false,
        confirmText: '知道了'
      })
    } catch (e) {
      wx.showToast({ title: e.message || '提交失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 分享给其他朋友
  onShareAppMessage() {
    const { pet, parent, inviteCode } = this.data
    return {
      title: `${parent?.nickname || '好友'}给你申请了一次免费体检`,
      path: `/pages/invite-view/invite-view?code=${inviteCode}`,
      imageUrl: pet?.photo_urls?.[0] || ''
    }
  },

  // 雷达图绘制（复用首页逻辑）
  drawRadar(radarData) {
    const keys = ['消化系统', '骨骼肌肉', '皮肤毛发', '心血管', '免疫系统', '内分泌']
    const dataValues = keys.map(k => (radarData[k] || 50) / 100)

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

        for (let lv = 1; lv <= levels; lv++) {
          const r = (maxR / levels) * lv
          ctx.beginPath()
          angles.forEach((a, i) => { const p = getPoint(a, r); i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y) })
          ctx.closePath()
          ctx.strokeStyle = lv === levels ? '#E2E8F0' : '#F1F5F9'
          ctx.lineWidth = lv === levels ? 1.5 : 1
          ctx.stroke()
        }
        ctx.strokeStyle = '#F1F5F9'; ctx.lineWidth = 1
        angles.forEach(a => { const p = getPoint(a, maxR); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p.x, p.y); ctx.stroke() })

        ctx.beginPath()
        dataValues.forEach((v, i) => { const p = getPoint(angles[i], maxR * v); i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y) })
        ctx.closePath()
        ctx.fillStyle = 'rgba(59,102,245,0.15)'; ctx.fill()
        ctx.strokeStyle = '#3B66F5'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke()

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
