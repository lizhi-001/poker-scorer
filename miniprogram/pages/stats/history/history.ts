Page({
  data: { rooms: [] as any[] },
  onShow() { this.loadHistory() },
  async loadHistory() {
    const db = wx.cloud.database()
    const { data } = await db.collection('rooms')
      .where({ status: 'settled' })
      .orderBy('updatedAt', 'desc')
      .get()
    this.setData({ rooms: data })
  },
  onTap(e: any) {
    wx.navigateTo({ url: `/pages/stats/summary/summary?roomId=${e.currentTarget.dataset.id}` })
  },
})
