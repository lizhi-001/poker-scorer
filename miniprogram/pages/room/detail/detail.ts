let playerWatcher: any = null

Page({
  data: {
    roomId: '',
    room: {} as any,
    players: [] as any[],
    buyInAmount: '',
    buyInPlayerId: '',
    showBuyInDialog: false,
    isCreator: false,
  },
  _watcher: null as any,

  onLoad(options) {
    this.setData({ roomId: options.id || '' })
  },
  onShow() {
    this.loadRoom()
    this._startPlayerWatch()
  },
  onHide() {
    this._stopPlayerWatch()
  },
  onUnload() {
    this._stopPlayerWatch()
  },

  async loadRoom() {
    const db = wx.cloud.database()
    const { data } = await db.collection('rooms').doc(this.data.roomId).get() as any
    const app = getApp()
    this.setData({
      room: data,
      isCreator: data.creatorId === app.globalData.userStore?.openId,
    })
  },
  _startPlayerWatch() {
    this._stopPlayerWatch()
    const db = wx.cloud.database()
    playerWatcher = db.collection('players')
      .where({ roomId: this.data.roomId })
      .watch({
        onChange: (snapshot: any) => {
          this.setData({ players: snapshot.docs })
        },
        onError: (err: any) => {
          console.error('player watch error', err)
          this._fallbackLoadPlayers()
        },
      })
  },
  _stopPlayerWatch() {
    if (playerWatcher) {
      playerWatcher.close()
      playerWatcher = null
    }
  },
  async _fallbackLoadPlayers() {
    const db = wx.cloud.database()
    const { data } = await db.collection('players')
      .where({ roomId: this.data.roomId, isActive: true })
      .orderBy('createdAt', 'asc')
      .get()
    this.setData({ players: data })
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
      await db.collection('players').doc(buyInPlayerId).update({
        data: {
          currentChips: db.command.inc(amount),
          buyInCount: db.command.inc(1),
          totalBuyIn: db.command.inc(amount),
        },
      })
      await db.collection('buyins').add({
        data: { roomId, playerId: buyInPlayerId, amount, createdAt: db.serverDate() },
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
  async onStartGame() {
    if (this.data.players.length < 2) {
      wx.showToast({ title: '至少需要2名玩家', icon: 'none' })
      return
    }
    const db = wx.cloud.database()
    await db.collection('rooms').doc(this.data.roomId).update({
      data: { status: 'active', updatedAt: db.serverDate() },
    })
    this.loadRoom()
  },
  onStartRound() {
    wx.navigateTo({ url: `/pages/game/round/round?roomId=${this.data.roomId}` })
  },
  onSettle() {
    wx.navigateTo({ url: `/pages/stats/summary/summary?roomId=${this.data.roomId}` })
  },
  onCopyRoomCode() {
    wx.setClipboardData({
      data: this.data.room.roomCode,
      success: () => wx.showToast({ title: '已复制房间号' }),
    })
  },
  onShareRoom() {
    wx.showShareMenu({ withShareTicket: true })
  },
  onShareAppMessage() {
    return {
      title: `来加入「${this.data.room.name}」`,
      path: `/pages/room/detail/detail?id=${this.data.roomId}`,
    }
  },
})
