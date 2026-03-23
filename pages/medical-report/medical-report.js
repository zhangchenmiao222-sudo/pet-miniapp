const { request } = require('../../utils/request')

Page({
  data: {
    report: null,
    radarData: null,
    radarLabels: ['消化系统', '骨骼肌肉', '皮肤毛发', '心血管', '免疫系统', '内分泌'],
    indicators: [],
    loading: true
  },

  onLoad(options) {
    const petId = options.petId || 1
    this.loadReport(petId)
  },

  async loadReport(petId) {
    try {
      const res = await request({ url: `/pets/${petId}/medical-report/full` })
      if (res.data) {
        const report = res.data
        // 解析 radar_data
        let radarData = report.radar_data
        if (typeof radarData === 'string') {
          radarData = JSON.parse(radarData || '{}')
        }
        // 解析 indicators
        let indicators = report.indicators
        if (typeof indicators === 'string') {
          indicators = JSON.parse(indicators || '[]')
        }
        this.setData({
          report,
          radarData,
          indicators: indicators || []
        })
        // 画雷达图
        this.drawRadar(radarData)
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  drawRadar(radarData) {
    const keys = this.data.radarLabels
    const dataValues = keys.map(k => (radarData[k] || 50) / 100)

    const query = wx.createSelectorQuery().in(this)
    query.select('#reportRadar')
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
          ctx.strokeStyle = 'rgba(255,255,255,0.1)'
          ctx.lineWidth = 1
          ctx.stroke()
        }
        // 对角线
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'
        ctx.lineWidth = 1
        angles.forEach(a => { const p = getPoint(a, maxR); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p.x, p.y); ctx.stroke() })

        // 数据面
        ctx.beginPath()
        dataValues.forEach((v, i) => { const p = getPoint(angles[i], maxR * v); i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y) })
        ctx.closePath()
        ctx.fillStyle = 'rgba(59,125,216,0.2)'
        ctx.fill()
        ctx.strokeStyle = '#3B7DD8'
        ctx.lineWidth = 2
        ctx.lineJoin = 'round'
        ctx.stroke()

        // 节点
        dataValues.forEach((v, i) => {
          const p = getPoint(angles[i], maxR * v)
          const isAlert = v < 0.6
          ctx.beginPath()
          ctx.arc(p.x, p.y, isAlert ? 5 : 3.5, 0, 2 * Math.PI)
          ctx.fillStyle = isAlert ? '#EF4444' : '#3B7DD8'
          ctx.fill()
        })

        // 标签
        ctx.font = '11px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        keys.forEach((label, i) => {
          const p = getPoint(angles[i], maxR + 20)
          ctx.fillStyle = dataValues[i] < 0.6 ? '#EF4444' : '#8899AA'
          ctx.fillText(label, p.x, p.y)
        })
      })
  },

  // 获取指标等级样式
  getLevel(score) {
    if (score >= 85) return 'excellent'
    if (score >= 60) return 'observe'
    return 'intervene'
  },

  goBack() { wx.navigateBack() }
})
