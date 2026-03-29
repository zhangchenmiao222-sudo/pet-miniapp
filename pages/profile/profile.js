const { request } = require('../../utils/request')
const app = getApp()

Page({
  data: {
    userInfo: null,
    memberInfo: null,
    pet: null,
    inviteCount: 0,
    rewardAmount: 0,
    loading: true,
    // 编辑弹窗
    showEditUser: false,
    editNickname: '',
    // 编辑宠物弹窗
    showEditPet: false,
    editPetForm: { name: '', breed: '', age_years: '', weight_kg: '', description: '' },
    editSubmitting: false
  },

  onShow() {
    this.loadAllData()
  },

  async loadAllData() {
    const token = wx.getStorageSync('token')
    if (!token) {
      this.setData({ loading: false })
      return
    }

    try {
      const [profileRes, memberRes, petRes, inviteRes, rewardRes] = await Promise.allSettled([
        request({ url: '/user/profile' }),
        request({ url: '/member/info' }),
        request({ url: '/pets' }),
        request({ url: '/invite/my-invites' }),
        request({ url: '/invite/my-rewards' })
      ])

      if (profileRes.status === 'fulfilled' && profileRes.value.data) {
        const u = profileRes.value.data
        this.setData({ userInfo: u })
        wx.setStorageSync('userInfo', { nickname: u.nickname, avatar: u.avatar_url })
      }

      if (memberRes.status === 'fulfilled' && memberRes.value.data) {
        this.setData({ memberInfo: memberRes.value.data })
      }

      if (petRes.status === 'fulfilled' && petRes.value.data) {
        const pets = petRes.value.data
        if (pets.length > 0) {
          const pet = pets[0]
          if (typeof pet.health_tags === 'string') pet.health_tags = JSON.parse(pet.health_tags || '[]')
          if (typeof pet.photo_urls === 'string') pet.photo_urls = JSON.parse(pet.photo_urls || '[]')
          this.setData({ pet })
        }
      }

      if (inviteRes.status === 'fulfilled' && inviteRes.value.data) {
        this.setData({ inviteCount: inviteRes.value.data.length || 0 })
      }

      if (rewardRes.status === 'fulfilled' && rewardRes.value.data) {
        const sum = rewardRes.value.data.summary
        this.setData({ rewardAmount: sum ? sum.available_fen / 100 : 0 })
      }
    } catch (e) {
      console.error('加载失败', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  // ========== 用户头像上传 ==========
  onChooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        wx.showLoading({ title: '上传中...' })
        wx.uploadFile({
          url: 'https://miaoqiaoqiao.com/pet-api/api/upload',
          filePath: tempPath,
          name: 'file',
          header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
          success: (uploadRes) => {
            const data = JSON.parse(uploadRes.data)
            if (data.code === 200 && data.data.url) {
              this.updateUserProfile({ avatar_url: data.data.url })
            }
          },
          complete: () => wx.hideLoading()
        })
      }
    })
  },

  // ========== 编辑昵称 ==========
  openEditUser() {
    this.setData({
      showEditUser: true,
      editNickname: this.data.userInfo?.nickname || ''
    })
  },
  closeEditUser() { this.setData({ showEditUser: false }) },
  onEditNickname(e) { this.setData({ editNickname: e.detail.value }) },
  async saveNickname() {
    const name = this.data.editNickname.trim()
    if (!name) { wx.showToast({ title: '请输入昵称', icon: 'none' }); return }
    await this.updateUserProfile({ nickname: name })
    this.setData({ showEditUser: false })
  },

  async updateUserProfile(data) {
    try {
      const res = await request({ url: '/user/profile', method: 'PUT', data })
      if (res.data) {
        this.setData({ userInfo: res.data })
        wx.setStorageSync('userInfo', { nickname: res.data.nickname, avatar: res.data.avatar_url })
        wx.showToast({ title: '已更新', icon: 'success' })
      }
    } catch (e) {
      wx.showToast({ title: '更新失败', icon: 'none' })
    }
  },

  // ========== 宠物照片上传 ==========
  onChoosePetPhoto() {
    const pet = this.data.pet
    if (!pet) return
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        wx.showLoading({ title: '上传中...' })
        wx.uploadFile({
          url: 'https://miaoqiaoqiao.com/pet-api/api/upload',
          filePath: tempPath,
          name: 'file',
          header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
          success: async (uploadRes) => {
            const data = JSON.parse(uploadRes.data)
            if (data.code === 200 && data.data.url) {
              const photos = this.data.pet.photo_urls || []
              photos.unshift(data.data.url)
              try {
                await request({
                  url: `/pets/${pet.id}`,
                  method: 'PUT',
                  data: { photo_urls: photos }
                })
                this.setData({ 'pet.photo_urls': photos })
                wx.showToast({ title: '照片已上传', icon: 'success' })
              } catch (e) {
                wx.showToast({ title: '保存失败', icon: 'none' })
              }
            }
          },
          complete: () => wx.hideLoading()
        })
      }
    })
  },

  // ========== 编辑宠物信息 ==========
  openEditPet() {
    const pet = this.data.pet
    if (!pet) return
    this.setData({
      showEditPet: true,
      editPetForm: {
        name: pet.name || '',
        breed: pet.breed || '',
        age_years: String(pet.age_years || ''),
        weight_kg: String(pet.weight_kg || ''),
        description: pet.description || ''
      }
    })
  },
  closeEditPet() { this.setData({ showEditPet: false }) },
  onEditPetInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`editPetForm.${field}`]: e.detail.value })
  },
  async savePetInfo() {
    const form = this.data.editPetForm
    if (!form.name.trim()) { wx.showToast({ title: '请填写名字', icon: 'none' }); return }
    this.setData({ editSubmitting: true })
    try {
      await request({
        url: `/pets/${this.data.pet.id}`,
        method: 'PUT',
        data: {
          name: form.name.trim(),
          breed: form.breed.trim(),
          age_years: parseFloat(form.age_years) || 0,
          weight_kg: parseFloat(form.weight_kg) || 0,
          description: form.description.trim()
        }
      })
      wx.showToast({ title: '已更新', icon: 'success' })
      this.setData({ showEditPet: false })
      this.loadAllData()
    } catch (e) {
      wx.showToast({ title: '更新失败', icon: 'none' })
    } finally {
      this.setData({ editSubmitting: false })
    }
  },

  // ========== 跳转 ==========
  goMyInvites() { wx.navigateTo({ url: '/pages/my-invites/my-invites' }) },
  goLogin() { wx.navigateTo({ url: '/pages/login/login' }) },

  onBuyMember() {
    wx.showModal({
      title: '开通会员',
      content: '年度会员 128元/年，享受全部专属功能',
      confirmText: '立即开通',
      success: async (res) => {
        if (res.confirm) {
          try {
            const payRes = await request({ url: '/payment/create', method: 'POST', data: { plan_type: 'yearly' } })
            if (payRes.data && payRes.data.payParams) {
              wx.requestPayment({
                ...payRes.data.payParams,
                success: () => { wx.showToast({ title: '支付成功' }); this.loadAllData() },
                fail: () => { wx.showToast({ title: '支付取消', icon: 'none' }) }
              })
            } else {
              wx.showToast({ title: '会员开通成功' }); this.loadAllData()
            }
          } catch (e) { wx.showToast({ title: '开通失败', icon: 'none' }) }
        }
      }
    })
  },

  onViewPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }) },

  onContact() {
    wx.showModal({
      title: '联系我们',
      content: '邮箱：support@miaoqiaoqiao.com',
      showCancel: false, confirmText: '知道了'
    })
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token')
          wx.removeStorageSync('userInfo')
          app.globalData.token = ''
          wx.redirectTo({ url: '/pages/login/login' })
        }
      }
    })
  },

  onShareAppMessage() {
    const { pet } = this.data
    return {
      title: pet ? `${pet.name}的精准营养档案` : '妙巧巧·MPFD',
      path: '/pages/index/index'
    }
  }
})
