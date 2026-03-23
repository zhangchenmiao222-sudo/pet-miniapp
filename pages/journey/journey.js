Page({
  data: {},

  onLoad() {
    // 滚动到顶部
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  goBack() {
    wx.navigateBack();
  }
})