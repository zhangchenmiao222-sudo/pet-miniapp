Page({
  data: {},

  onLoad() {},

  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab && wx.switchTab({ url: '/pages/index/index' });
      }
    });
  },

  goToIndex() {
    wx.navigateTo({
      url: '/pages/index/index'
    });
  }
})