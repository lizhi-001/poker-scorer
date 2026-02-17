Page({
  data: {
    roomId: '',
    room: {} as any,
    players: [] as any[],
    buyInAmount: '',
    buyInPlayerId: '',
    showBuyInDialog: false,
  },
  _watcher: null as any,

  onLoad(options) {
    this.setData({ roomId: options.id || '' })
  },
  onShow() {
    this.loadRoom()
    this.loadPlayers()
    this.startWatch()
  },
  onHide() {
    this.closeWatch()
  },
  onUnload() {
    this.closeWatch()
  },

  async loadRoom() {
    const db = wx.cloud.database()
    const { data } = await db.collection('rooms').doc(this.data.roomId).get()
    this.setData({ room: data })
  },
  async loadPlayers() {
    const db = wx.cloud.database()
    const { data } = await db.collection('players')
      .where({ roomId: this.data.roomId, isActive: true })
      .orderBy('createdAt', 'asc')
      .get()
    this.setData({ players: data })
  },

  /** 实时监听玩家数据变化 */
  startWatch() {
    this.closeWatch()
    const db = wx.cloud.database()
    this._watcher = db.collection('players')
      .where({ roomId: this.data.roomId, isActive: true })
      .watch({
        onChange: (snapshot: any) => {
          if (snapshot.docs) {
            this.setData({ players: snapshot.docs })
          }
        },
        onError: (err: any) => {
          console.error('watch error', err)
        },
      })
  },
  closeWatch() {
    if (this._watcher) {
      this._watcher.close()
      this._watcher = null
    }
  },

  /** 移除玩家 */
  async onRemovePlayer(e: any) {
    const playerId = e.currentTarget.dataset.id
    const player = this.data.players.find((p: any) => p._id === playerId)
    if (!player) return

    const { confirm } = await wx.showModal({
      title: '移除玩家',
      content: `确定移除 ${player.nickname} 吗？`,
    })
    if (!confirm) return

    try {
      const db = wx.cloud.database()
      await db.collection('players').doc(playerId).update({
        data: { isActive: false },
      })
      wx.showToast({ title: '已移除', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '移除失败', icon: 'none' })
    }
  },

  /** 打开买入弹窗 */
  onOpenBuyIn(e: any) {
    const playerId = e.currentTarget.dataset.id
    this.setData({
      buyInPlayerId: playerId,
      buyInAmount: String(this.data.room.buyIn || ''),
      showBuyInDialog: true,
    })
  },
  onBuyInAmountChange(e: any) {
    this.setData({ buyInAmount: e.detail })
  },
  onCloseBuyIn() {
    this.setData({ showBuyInDialog: false, buyInPlayerId: '', buyInAmount: '' })
  },

  /** 确认买入 */
  async onConfirmBuyIn() {
    const { buyInPlayerId, buyInAmount, roomId } = this.data
    const amount = Number(buyInAmount)
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    try {
      const db = wx.cloud.database()
      // 更新玩家筹码和买入记录
      await db.collection('players').doc(buyInPlayerId).update({
        data: {
          currentChips: db.command.inc(amount),
          buyInCount: db.command.inc(1),
          totalBuyIn: db.command.inc(amount),
        },
      })
      // 创建买入记录
      await db.collection('buyins').add({
        data: {
          roomId,
          playerId: buyInPlayerId,
          amount,
          createdAt: db.serverDate(),
        },
      })
      this.setData({ showBuyInDialog: false, buyInPlayerId: '', buyInAmount: '' })
      wx.showToast({ title: '买入成功', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '买入失败', icon: 'none' })
    }
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
