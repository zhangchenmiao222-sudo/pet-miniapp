const { request } = require('../../utils/request')

Page({
  data: {
    // 宠物信息
    pet: {
      name: '肉丸',
      breed: '柯基',
      age_years: 4.5,
      weight_kg: 13.3,
      pet_no: 'MY-2829-0403',
      health_tags: ['肠胃敏感', '消化保护'],
      photo_urls: []
    },
    // 配方信息
    formula: {
      period_num: 8,
      name: '低磷护肾·易消化膳',
      core_indicator: '磷含量≤0.6%DM，升磷脱氧酶比',
      protein_pct: 29.0,
      fat_pct: 14.0,
      calories_per_100g: 80,
      special_nutrients: ['Omega-3', '牛磺酸']
    },
    ingredients: [
      { name: '鸡胸肉', category: '肉类' },
      { name: '鸡心', category: '肉类' },
      { name: '鸭胸肉', category: '肉类' }
    ],
    // 医学报告
    report: {
      report_no: 'NO.00005',
      verified: true,
      excellent_count: 7,
      observe_count: 5,
      intervene_count: 2,
      radar_data: {
        '消化系统': 85,
        '骨骼肌肉': 78,
        '皮肤毛发': 92,
        '心血管': 88,
        '免疫系统': 70,
        '神经系统': 95
      }
    },
    // 今日养护
    dailyCare: {
      day_count: 23,
      meals_count: 4,
      total_food_g: 683,
      meat_g: 228,
      middle_g: 228,
      veggie_g: 227,
      water_ml: 420,
      water_target_ml: 1000,
      walk_completed: false,
      walk_plan: { name: '舒缓低速环L', duration_desc: '18-20分钟' },
      extra_records: [
        { name: '西梅花茶', amount: '30g' },
        { name: '蛋黄', amount: '半个' }
      ]
    },
    // 料程
    mealPlan: {
      current_stage: 'additives',
      current_stage_label: '特殊添加剂准备',
      progress_pct: 65,
      planned_days: 15,
      is_live: true
    },
    // 科普文章
    article: {
      title: '为什么说同型半胱氨酸是血管的「慢损指示器」？',
      preview: '同型半胱氨酸（Hcy）是蛋氨酸代谢过程中产生的中间产物。研究表明，当宠物体内Hcy水平持续偏高时，会对血管内皮造成持续性损伤...'
    },
    // 会员信息
    member: {
      type: 'yearly',
      price: 128
    }
  },

  onLoad() {
    // 阶段0：先显示假数据，后续替换为真实API
    // this.loadAllData()
  },

  // 预留：加载所有数据（阶段2-3时启用）
  async loadAllData() {
    try {
      const petId = 1
      const [petRes, formulaRes, reportRes, careRes, planRes] = await Promise.all([
        request({ url: `/pets/${petId}` }),
        request({ url: `/pets/${petId}/formula` }),
        request({ url: `/pets/${petId}/medical-report` }),
        request({ url: `/pets/${petId}/daily-care/today` }),
        request({ url: `/pets/${petId}/meal-plan` })
      ])
      this.setData({
        pet: petRes.data,
        formula: formulaRes.data.formula,
        ingredients: formulaRes.data.ingredients,
        report: reportRes.data,
        dailyCare: careRes.data,
        mealPlan: planRes.data
      })
    } catch (err) {
      console.error('加载数据失败', err)
    }
  },

  // 饮水 +100ml
  onAddWater() {
    const newWater = this.data.dailyCare.water_ml + 100
    this.setData({ 'dailyCare.water_ml': newWater })
    // 后续接API：request({ url: `/pets/1/daily-care/water`, method: 'POST', data: { add_ml: 100 } })
  },

  // 跳转配方详情
  onViewFormula() {
    wx.navigateTo({ url: '/pages/formula-detail/formula-detail' })
  },

  // 跳转医学报告
  onViewReport() {
    wx.navigateTo({ url: '/pages/medical-report/medical-report' })
  },

  // 跳转料程详情
  onViewMealPlan() {
    wx.navigateTo({ url: '/pages/meal-plan-detail/meal-plan-detail' })
  },

  // 跳转文章详情
  onViewArticle() {
    wx.navigateTo({ url: '/pages/article-detail/article-detail' })
  },

  // 添加额外记录
  onAddExtra() {
    wx.showModal({
      title: '添加额外记录',
      editable: true,
      placeholderText: '如：西梅花茶 30g',
      success: (res) => {
        if (res.confirm && res.content) {
          const parts = res.content.trim().split(' ')
          const name = parts[0] || res.content
          const amount = parts[1] || ''
          const list = [...this.data.dailyCare.extra_records, { name, amount }]
          this.setData({ 'dailyCare.extra_records': list })
        }
      }
    })
  }
})
