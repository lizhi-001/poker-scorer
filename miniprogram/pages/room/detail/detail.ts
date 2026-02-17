Page({
  data: {
    roomId: '',
    room: {} as any,
    players: [] as any[],
  },
  onLoad(options) {
    this.setData({ roomId: options.id || '' })
  },
  onShow() {
    this.loadRoom()
    this.loadPlayers()
  },
  async loadRoom() {
    const db = wx.cloud.database()
    const { data } = await db.collection('rooms').doc(this.data.roomId).get()
    this.setData({ room: data })
  },
  async loadPlayers() {
    const db = wx.cloud.database()
    const { data } = await db.collection('players')
      .where({ roomId: this.data.roomId })
      .get()
    this.setData({ players: data })
  },
  onAddPlayer() {
    wx.navigateTo({ url: `/pages/game/play/play?roomId=${this.data.roomId}` })
  },
  onStartRound() {
    wx.navigateTo({ url: `/pages/game/round/round?roomId=${this.data.roomId}` })
  },
  onSettle() {
    wx.navigateTo({ url: `/pages/stats/summary/summary?roomId=${this.data.roomId}` })
  },
})
