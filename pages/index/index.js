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
    // 邀请相关
    showInviteCard: false,
    inviteCode: '',
    inviteGenerating: false,
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

  // ========== 邀请相关 ==========
  async onInviteFriend() {
    if (this.data.pageState !== 'live') { this._guardTip(); return }
    if (this.data.inviteGenerating) return

    this.setData({ inviteGenerating: true })
    try {
      const res = await request({ url: '/invite/generate', method: 'POST' })
      if (res.data && res.data.invite_code) {
        this.setData({
          inviteCode: res.data.invite_code,
          showInviteCard: true
        })
        setTimeout(() => this.drawInviteCard(), 300)
      }
    } catch (e) {
      wx.showToast({ title: '生成失败', icon: 'none' })
    } finally {
      this.setData({ inviteGenerating: false })
    }
  },

  drawInviteCard() {
    const { pet } = this.data
    const petName = pet ? pet.name : '狗狗'
    // 尝试加载狗狗头像
    let petPhoto = ''
    if (pet && pet.photo_urls) {
      const urls = typeof pet.photo_urls === 'string' ? JSON.parse(pet.photo_urls || '[]') : pet.photo_urls
      if (Array.isArray(urls) && urls.length > 0) petPhoto = urls[0]
    }

    const query = wx.createSelectorQuery().in(this)
    query.select('#inviteCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getWindowInfo().pixelRatio || 2
        const w = res[0].width
        const h = res[0].height
        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)

        const doRender = (avatarImg) => {
          const P = 28 // padding（稍大留白，缩小后更透气）

          // ===== 背景渐变 =====
          const bg = ctx.createLinearGradient(0, 0, w, h)
          bg.addColorStop(0, '#0f172a')
          bg.addColorStop(1, '#020617')
          ctx.fillStyle = bg
          ctx.fillRect(0, 0, w, h)

          // 氛围光晕 - 右上蓝
          const g1 = ctx.createRadialGradient(w * 0.82, h * 0.1, 0, w * 0.82, h * 0.1, 175)
          g1.addColorStop(0, 'rgba(59,130,246,0.14)')
          g1.addColorStop(1, 'rgba(59,130,246,0)')
          ctx.fillStyle = g1
          ctx.fillRect(0, 0, w, h)

          // 氛围光晕 - 左下青
          const g2 = ctx.createRadialGradient(w * 0.12, h * 0.9, 0, w * 0.12, h * 0.9, 175)
          g2.addColorStop(0, 'rgba(34,211,238,0.10)')
          g2.addColorStop(1, 'rgba(34,211,238,0)')
          ctx.fillStyle = g2
          ctx.fillRect(0, 0, w, h)

          // 狗爪装饰 (半透明)
          this._drawPaw(ctx, w * 0.38, h * 0.08, 22, 'rgba(255,255,255,0.035)', 12)
          this._drawPaw(ctx, w * 0.82, h * 0.62, 14, 'rgba(255,255,255,0.03)', -12)

          // ===== 1. 头部：Special Gift 标签 + 狗狗头像（标题文字已移至 onShareAppMessage title） =====
          // Special Gift 标签
          this._roundRect(ctx, P, P, 110, 24, 12)
          ctx.fillStyle = 'rgba(59,130,246,0.15)'
          ctx.fill()
          ctx.strokeStyle = 'rgba(59,130,246,0.25)'
          ctx.lineWidth = 0.5
          ctx.stroke()
          // 标签内狗爪小图标
          this._drawPaw(ctx, P + 12, P + 12, 5, '#60a5fa', 0)
          ctx.fillStyle = '#93c5fd'
          ctx.font = '800 10px sans-serif'
          ctx.fillText('SPECIAL GIFT', P + 22, P + 16)

          // 脉冲圆点
          ctx.beginPath()
          ctx.arc(P + 120, P + 12, 3, 0, Math.PI * 2)
          ctx.fillStyle = '#22d3ee'
          ctx.fill()
          ctx.beginPath()
          ctx.arc(P + 120, P + 12, 6, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(34,211,238,0.2)'
          ctx.fill()

          // 右上角狗狗头像
          const avatarCx = w - P - 28
          const avatarCy = P + 26
          const avatarR = 26

          // 外环科技感
          ctx.beginPath()
          ctx.arc(avatarCx, avatarCy, avatarR + 5, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(34,211,238,0.25)'
          ctx.lineWidth = 1
          ctx.stroke()

          // 头像裁圆
          ctx.save()
          ctx.beginPath()
          ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2)
          ctx.clip()
          if (avatarImg) {
            ctx.drawImage(avatarImg, avatarCx - avatarR, avatarCy - avatarR, avatarR * 2, avatarR * 2)
          } else {
            ctx.fillStyle = '#1e293b'
            ctx.fillRect(avatarCx - avatarR, avatarCy - avatarR, avatarR * 2, avatarR * 2)
            ctx.fillStyle = 'rgba(255,255,255,0.5)'
            ctx.font = 'bold 14px sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(petName.slice(0, 2), avatarCx, avatarCy + 5)
            ctx.textAlign = 'left'
          }
          ctx.restore()

          // 头像白边
          ctx.beginPath()
          ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(255,255,255,0.15)'
          ctx.lineWidth = 2
          ctx.stroke()

          // 头像下方宠物名字
          ctx.fillStyle = '#FFFFFF'
          ctx.font = 'bold 11px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(petName, avatarCx, avatarCy + avatarR + 14)
          ctx.textAlign = 'left'

          // ===== 2. 中间：价值卡片 + 寄语（去掉标题后空间更充裕） =====
          const midY = P + 66
          const midH = h - midY - 86
          const gapX = 14
          const leftW = (w - P * 2 - gapX) * 0.55
          const rightW = (w - P * 2 - gapX) * 0.45

          // -- 左上两个数据卡片 --
          const card1W = (leftW - 10) / 2
          const card1H = 62

          // 卡片1: 15P
          this._glassCard(ctx, P, midY, card1W, card1H, 14)
          this._drawPaw(ctx, P + card1W - 10, midY + card1H - 10, 10, 'rgba(59,130,246,0.15)', 0)
          ctx.fillStyle = '#FFFFFF'
          ctx.font = '900 italic 26px sans-serif'
          ctx.fillText('15P', P + 14, midY + 32)
          ctx.fillStyle = '#64748b'
          ctx.font = 'bold 10px sans-serif'
          ctx.fillText('深度代谢报告', P + 10, midY + 50)

          // 卡片2: 1:1
          const c2x = P + card1W + 10
          this._glassCard(ctx, c2x, midY, card1W, card1H, 14)
          this._drawPaw(ctx, c2x + card1W - 10, midY + card1H - 10, 10, 'rgba(59,130,246,0.15)', 0)
          ctx.fillStyle = '#FFFFFF'
          ctx.font = '900 italic 26px sans-serif'
          ctx.fillText('1:1', c2x + 14, midY + 32)
          ctx.fillStyle = '#64748b'
          ctx.font = 'bold 10px sans-serif'
          ctx.fillText('定制健康方案', c2x + 10, midY + 50)

          // -- 左下说明面板 --
          const descY = midY + card1H + 10
          const descH = midH - card1H - 10
          this._glassCard(ctx, P, descY, leftW, descH, 14)

          // 两行文字带爪印图标
          const lines = [
            '解析血液数据，看透它无法言说的需求',
            '科学营养配比，生成它的专属定制食谱'
          ]
          lines.forEach((txt, i) => {
            const ly = descY + 24 + i * 28
            this._drawPaw(ctx, P + 16, ly, 6, '#60a5fa', 0)
            ctx.fillStyle = '#cbd5e1'
            ctx.font = '13px sans-serif'
            ctx.fillText(txt, P + 30, ly + 4)
          })

          // -- 右侧寄语气泡 --
          const rightX = P + leftW + gapX
          this._glassCard(ctx, rightX, midY, rightW, midH, 14)

          // 大引号装饰
          ctx.fillStyle = 'rgba(255,255,255,0.06)'
          ctx.font = 'bold 40px serif'
          ctx.fillText('\u201C', rightX + 10, midY + 36)

          // 寄语文字
          ctx.fillStyle = 'rgba(191,219,254,0.85)'
          ctx.font = 'italic 13px sans-serif'
          const quoteLines = this._wrapText(ctx,
            `\u201C懂它，从数据开始。我已为${petName}定制了专属粮，现在把这份专业关爱分享给你。\u201D`,
            rightW - 30
          )
          quoteLines.forEach((line, i) => {
            ctx.fillText(line, rightX + 16, midY + 56 + i * 20)
          })

          // ===== 3. 底部：钩子 + 按钮 =====
          const btmY = h - 74
          const btmLeftW = (w - P * 2 - gapX) * 0.6

          // 左侧「你知道吗」面板
          this._roundRect(ctx, P, btmY, btmLeftW, 60, 14)
          ctx.fillStyle = 'rgba(59,130,246,0.08)'
          ctx.fill()
          ctx.strokeStyle = 'rgba(59,130,246,0.15)'
          ctx.lineWidth = 0.5
          ctx.stroke()

          // 脉冲点 + 标题
          ctx.beginPath()
          ctx.arc(P + 14, btmY + 16, 3, 0, Math.PI * 2)
          ctx.fillStyle = '#22d3ee'
          ctx.fill()
          ctx.beginPath()
          ctx.arc(P + 14, btmY + 16, 5, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(34,211,238,0.15)'
          ctx.fill()
          ctx.fillStyle = '#60a5fa'
          ctx.font = '800 11px sans-serif'
          ctx.fillText('你知道吗？', P + 24, btmY + 20)

          ctx.fillStyle = '#94a3b8'
          ctx.font = '11px sans-serif'
          const tipLines = this._wrapText(ctx,
            '90%的代谢异常在显症前已存在。它的身体得分及格了吗？领用特权看真相。',
            btmLeftW - 28
          )
          tipLines.forEach((line, i) => {
            ctx.fillText(line, P + 14, btmY + 36 + i * 15)
          })

          // 右侧：渐变按钮
          const btnX = P + btmLeftW + gapX
          const btnW = w - btnX - P
          const btnGrad = ctx.createLinearGradient(btnX, btmY, btnX + btnW, btmY)
          btnGrad.addColorStop(0, '#2563eb')
          btnGrad.addColorStop(1, '#0891b2')

          // 按钮阴影
          this._roundRect(ctx, btnX, btmY + 2, btnW, 42, 16)
          ctx.fillStyle = 'rgba(37,99,235,0.3)'
          ctx.fill()

          // 按钮主体
          this._roundRect(ctx, btnX, btmY, btnW, 42, 16)
          ctx.fillStyle = btnGrad
          ctx.fill()

          ctx.fillStyle = '#FFFFFF'
          ctx.font = 'bold 14px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('立即免费领用  →', btnX + btnW / 2, btmY + 26)

          // 副文字
          ctx.fillStyle = '#475569'
          ctx.font = 'bold 9px sans-serif'
          ctx.fillText('好友专享 · 限额领取', btnX + btnW / 2, btmY + 56)
          ctx.textAlign = 'left'

          // 保存引用
          this._inviteCanvas = canvas
          setTimeout(() => {
            wx.canvasToTempFilePath({
              canvas,
              success: (tempRes) => {
                this._inviteCardImage = tempRes.tempFilePath
              }
            })
          }, 100)
        }

        // 尝试加载头像图片，无论成功失败都绘制
        if (petPhoto) {
          const img = canvas.createImage()
          img.onload = () => doRender(img)
          img.onerror = () => doRender(null)
          img.src = petPhoto
        } else {
          doRender(null)
        }
      })
  },

  // 绘制狗爪图标
  _drawPaw(ctx, cx, cy, size, color, rotation) {
    ctx.save()
    ctx.translate(cx, cy)
    if (rotation) ctx.rotate(rotation * Math.PI / 180)
    ctx.fillStyle = color
    const s = size / 12
    // 主掌
    ctx.beginPath()
    ctx.ellipse(0, 2 * s, 6 * s, 5 * s, 0, 0, Math.PI * 2)
    ctx.fill()
    // 四个趾
    const toes = [[-5 * s, -5 * s], [-1.5 * s, -7 * s], [1.5 * s, -7 * s], [5 * s, -5 * s]]
    toes.forEach(([tx, ty]) => {
      ctx.beginPath()
      ctx.ellipse(tx, ty, 2.5 * s, 3 * s, 0, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.restore()
  },

  // 玻璃拟态卡片
  _glassCard(ctx, x, y, w, h, r) {
    this._roundRect(ctx, x, y, w, h, r)
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 0.5
    ctx.stroke()
  },

  // 文字换行工具
  _wrapText(ctx, text, maxWidth) {
    const lines = []
    let line = ''
    for (let i = 0; i < text.length; i++) {
      const testLine = line + text[i]
      if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
        lines.push(line)
        line = text[i]
      } else {
        line = testLine
      }
    }
    if (line) lines.push(line)
    return lines
  },

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  },

  closeInviteCard() {
    this.setData({ showInviteCard: false })
  },

  async saveInviteCard() {
    if (!this._inviteCanvas) return
    try {
      const res = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas: this._inviteCanvas,
          success: resolve,
          fail: reject
        })
      })
      await new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: resolve,
          fail: reject
        })
      })
      wx.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (e) {
      if (e.errMsg && e.errMsg.includes('auth')) {
        wx.showToast({ title: '请授权相册权限', icon: 'none' })
      }
    }
  },

  goMyInvites() {
    if (this.data.pageState !== 'live') { this._guardTip(); return }
    wx.navigateTo({ url: '/pages/my-invites/my-invites' })
  },

  onShareAppMessage() {
    const { pet, inviteCode, showInviteCard } = this.data
    // 如果正在分享邀请卡，带上邀请码 + Canvas生成的封面图
    if (showInviteCard && inviteCode) {
      const shareObj = {
        title: `${pet ? pet.name : ''}主人为你申请了一次免费深度体检名额`,
        path: `/pages/invite-view/invite-view?code=${inviteCode}`
      }
      if (this._inviteCardImage) {
        shareObj.imageUrl = this._inviteCardImage
      }
      return shareObj
    }
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
