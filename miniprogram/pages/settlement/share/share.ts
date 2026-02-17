Page({
  data: { roomId: '' },
  onLoad(options) {
    this.setData({ roomId: options.roomId || '' })
    this.drawShareImage()
  },
  async drawShareImage() {
    // TODO: 调用云函数生成分享图或本地 Canvas 绘制
    wx.showToast({ title: '生成中...', icon: 'loading' })
  },
  onSave() {
    wx.canvasToTempFilePath({
      canvasId: 'shareCanvas',
      success(res) {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success() { wx.showToast({ title: '已保存', icon: 'success' }) },
          fail() { wx.showToast({ title: '保存失败', icon: 'none' }) },
        })
      },
    })
  },
  onShareAppMessage() {
    return { title: '德扑牌局结算', path: `/pages/stats/summary/summary?roomId=${this.data.roomId}` }
  },
})
