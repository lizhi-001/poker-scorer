Page({
  data: {
    roomId: '',
    players: [] as any[],
    deltas: [] as number[],
    balance: 0,
    balanceOk: false,
    loading: false,
  },
  onLoad(options) {
    this.setData({ roomId: options.roomId || '' })
    this.loadPlayers()
  },
  async loadPlayers() {
    const db = wx.cloud.database()
    const { data } = await db.collection('players')
      .where({ roomId: this.data.roomId, isActive: true })
      .get()
    this.setData({ players: data, deltas: new Array(data.length).fill(0) })
  },
  onDeltaChange(e: any) {
    const idx = e.currentTarget.dataset.index
    const val = Number(e.detail) || 0
    const deltas = [...this.data.deltas]
    deltas[idx] = val
    const balance = deltas.reduce((s, d) => s + d, 0)
    this.setData({ deltas, balance, balanceOk: balance === 0 })
  },
  async onConfirm() {
    this.setData({ loading: true })
    try {
      const db = wx.cloud.database()
      const changes = this.data.players.map((p, i) => ({
        openId: p.openId || p._id,
        delta: this.data.deltas[i],
      }))
      await db.collection('rounds').add({
        data: {
          roomId: this.data.roomId,
          changes,
          pots: [],
          timestamp: db.serverDate(),
        },
      })
      // Update player chips
      for (let i = 0; i < this.data.players.length; i++) {
        await db.collection('players').doc(this.data.players[i]._id).update({
          data: { currentChips: db.command.inc(this.data.deltas[i]) },
        })
      }
      wx.showToast({ title: '记录成功', icon: 'success' })
      wx.navigateBack()
    } catch (err) {
      wx.showToast({ title: '记录失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
})
