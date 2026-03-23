Page({
  data: {
    pulse: true,
    waterIntake: 420,
    waterPercent: 39.6
  },

  onLoad() {
    this.startPulse();
  },

  onReady() {
    this.drawRadar();
  },

  onUnload() {
    if (this.pulseTimer) clearInterval(this.pulseTimer);
  },

  startPulse() {
    this.pulseTimer = setInterval(() => {
      this.setData({ pulse: !this.data.pulse });
    }, 2000);
  },

  addWater() {
    const current = this.data.waterIntake;
    if (current >= 1060) return;
    const next = Math.min(current + 100, 1060);
    this.setData({
      waterIntake: next,
      waterPercent: Math.min((next / 1060) * 100, 100)
    });
    wx.vibrateShort({ type: 'light' });
  },

  // 分享档案卡
  onShareCard() {
    wx.showShareImageMenu({
      path: '', // 需要生成分享图的路径
      fail: () => {
        // 回退方案：触发分享
        wx.showModal({
          title: '分享肉丸的档案',
          content: '肉丸 · 柯基 · 4.5岁\n健康评分：14项血检 · 超越同品种 87% 犬只\n点击右上角「···」可分享给好友',
          showCancel: false,
          confirmText: '知道了'
        });
      }
    });
  },

  // 开启页面分享能力
  onShareAppMessage() {
    return {
      title: '肉丸的精准营养档案 · 超越同品种87%犬只',
      path: '/pages/index/index',
      imageUrl: 'https://images.unsplash.com/photo-1544568100-847a948585b9?q=80&w=500&auto=format&fit=crop'
    };
  },

  goTraining() {
    wx.switchTab({ url: '/pages/training/training' });
  },

  goJourneyDetail() {
    wx.navigateTo({ url: '/pages/journey/journey' });
  },

  // 新版 Canvas 2D 绘制雷达图
  drawRadar() {
    const query = wx.createSelectorQuery().in(this);
    query.select('#radarCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return;

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo().pixelRatio || 2;
        const width = res[0].width;
        const height = res[0].height;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        const cx = width / 2;
        const cy = height / 2;
        const maxR = Math.min(width, height) * 0.38;
        const sides = 6;
        const levels = 3;

        const angles = [];
        for (let i = 0; i < sides; i++) {
          angles.push(-Math.PI / 2 + (2 * Math.PI / sides) * i);
        }

        const getPoint = (angle, r) => ({
          x: cx + r * Math.cos(angle),
          y: cy + r * Math.sin(angle)
        });

        // 网格
        for (let lv = 1; lv <= levels; lv++) {
          const r = (maxR / levels) * lv;
          ctx.beginPath();
          for (let i = 0; i < sides; i++) {
            const p = getPoint(angles[i], r);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
          ctx.closePath();
          ctx.strokeStyle = lv === levels ? '#E2E8F0' : '#F1F5F9';
          ctx.lineWidth = lv === levels ? 1.5 : 1;
          ctx.stroke();
        }

        // 对角线
        ctx.strokeStyle = '#F1F5F9';
        ctx.lineWidth = 1;
        for (let i = 0; i < sides; i++) {
          const p = getPoint(angles[i], maxR);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }

        // 数据：代谢、心血管、肾脏(低)、消化(低)、免疫、骨骼
        const dataValues = [0.88, 0.95, 0.45, 0.50, 0.90, 0.85];

        // 数据区域
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
          const r = maxR * dataValues[i];
          const p = getPoint(angles[i], r);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(59, 102, 245, 0.15)';
        ctx.fill();
        ctx.strokeStyle = '#3B66F5';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // 节点
        for (let i = 0; i < sides; i++) {
          const r = maxR * dataValues[i];
          const p = getPoint(angles[i], r);
          const isAlert = (i === 2 || i === 3);

          ctx.beginPath();
          ctx.arc(p.x, p.y, isAlert ? 4 : 3, 0, 2 * Math.PI);
          ctx.fillStyle = isAlert ? '#EF4444' : '#3B66F5';
          ctx.fill();

          if (isAlert) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5.5, 0, 2 * Math.PI);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      });
  }
})