Page({
  data: {
    userInfo: null as any,
    totalGames: 0,
    totalProfit: 0,
  },
  onShow() {
    const app = getApp()
    if (app.globalData.userInfo) {
      this.setData({ userInfo: app.globalData.userInfo })
    }
  },
  async onLogin() {
    try {
      const { result } = await wx.cloud.callFunction({ name: 'login' })
      const app = getApp()
      app.globalData.openId = (result as any).openId
      wx.showToast({ title: '登录成功', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '登录失败', icon: 'none' })
    }
  },
})
