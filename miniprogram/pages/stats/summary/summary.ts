Page({
  data: {
    roomId: '',
    results: [] as any[],
  },
  onLoad(options) {
    this.setData({ roomId: options.roomId || '' })
    this.loadStats()
  },
  async loadStats() {
    const db = wx.cloud.database()
    const { data: players } = await db.collection('players')
      .where({ roomId: this.data.roomId })
      .get()
    const results = players
      .map(p => ({
        openId: (p as any).openId || (p as any)._id,
        nickname: (p as any).nickname,
        totalBuyIn: (p as any).totalBuyIn,
        finalChips: (p as any).currentChips,
        profit: (p as any).currentChips - (p as any).totalBuyIn,
      }))
      .sort((a, b) => b.profit - a.profit)
    this.setData({ results })
  },
  onShare() {
    wx.navigateTo({ url: `/pages/settlement/share/share?roomId=${this.data.roomId}` })
  },
  onViewRounds() {
    wx.navigateTo({ url: `/pages/stats/rounds/rounds?roomId=${this.data.roomId}` })
  },
  async onEndGame() {
    const db = wx.cloud.database()
    await db.collection('rooms').doc(this.data.roomId).update({
      data: { status: 'settled', updatedAt: db.serverDate() },
    })
    wx.showToast({ title: '牌局已结算', icon: 'success' })
    wx.reLaunch({ url: '/pages/index/index' })
  },
})
