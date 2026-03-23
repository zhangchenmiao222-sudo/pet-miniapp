Component({
  properties: {
    radarData: { type: Object, value: {} },
    size: { type: Number, value: 300 }
  },

  lifetimes: {
    ready() {
      this.drawRadar()
    }
  },

  observers: {
    'radarData': function() {
      this.drawRadar()
    }
  },

  methods: {
    drawRadar() {
      const data = this.properties.radarData
      const keys = Object.keys(data)
      if (keys.length === 0) return

      const size = this.properties.size
      // rpx 转 px（假设750rpx = 屏幕宽度）
      const screenWidth = wx.getSystemInfoSync().windowWidth
      const px = (size / 750) * screenWidth
      const center = px / 2
      const radius = px * 0.35
      const n = keys.length
      const ctx = wx.createCanvasContext('radarCanvas', this)

      // 背景网格
      ctx.setStrokeStyle('rgba(255,255,255,0.1)')
      ctx.setLineWidth(1)
      for (let level = 1; level <= 3; level++) {
        const r = radius * level / 3
        ctx.beginPath()
        for (let i = 0; i < n; i++) {
          const angle = (Math.PI * 2 * i / n) - Math.PI / 2
          const x = center + r * Math.cos(angle)
          const y = center + r * Math.sin(angle)
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.stroke()
      }

      // 轴线
      for (let i = 0; i < n; i++) {
        const angle = (Math.PI * 2 * i / n) - Math.PI / 2
        ctx.beginPath()
        ctx.moveTo(center, center)
        ctx.lineTo(center + radius * Math.cos(angle), center + radius * Math.sin(angle))
        ctx.stroke()
      }

      // 数据区域
      ctx.beginPath()
      ctx.setFillStyle('rgba(59, 125, 216, 0.25)')
      ctx.setStrokeStyle('rgba(59, 125, 216, 0.8)')
      ctx.setLineWidth(2)
      keys.forEach((key, i) => {
        const value = (data[key] || 0) / 100
        const angle = (Math.PI * 2 * i / n) - Math.PI / 2
        const x = center + radius * value * Math.cos(angle)
        const y = center + radius * value * Math.sin(angle)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // 标签
      ctx.setFillStyle('#8899AA')
      ctx.setFontSize(11)
      ctx.setTextAlign('center')
      keys.forEach((key, i) => {
        const angle = (Math.PI * 2 * i / n) - Math.PI / 2
        const labelR = radius + 22
        const x = center + labelR * Math.cos(angle)
        const y = center + labelR * Math.sin(angle) + 5
        ctx.fillText(key, x, y)
      })

      ctx.draw()
    }
  }
})
