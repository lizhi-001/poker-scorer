import { watchRoom, watchPlayers, updateRoomStatus, closeWatcher } from '../../../utils/sync'

let playerWatcher: any = null
let roomWatcher: any = null

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

  onLoad(options) {
    this.setData({ roomId: options.id || '' })
  },
  onShow() {
    this._startRoomWatch()
    this._startPlayerWatch()
  },
  onHide() {
    this._stopAllWatchers()
  },
  onUnload() {
    this._stopAllWatchers()
  },

  _startRoomWatch() {
    roomWatcher = closeWatcher(roomWatcher)
    const roomId = this.data.roomId
    if (!roomId) return
    this.loadRoom()
    roomWatcher = watchRoom(
      roomId,
      (snapshot: any) => {
        const room = snapshot.docs[0]
        if (!room) return
        const app = getApp()
        const prevStatus = this.data.room.status
        this.setData({
          room,
          isCreator: room.creatorId === app.globalData.userStore?.openId,
        })
        if (prevStatus && prevStatus !== room.status) {
          const msgs: Record<string, string> = {
            active: '牌局已开始',
            settled: '牌局已结算',
            archived: '牌局已归档',
          }
          if (msgs[room.status]) {
            wx.showToast({ title: msgs[room.status], icon: 'none' })
          }
        }
      },
      () => this.loadRoom(),
    )
  },

  _startPlayerWatch() {
    playerWatcher = closeWatcher(playerWatcher)
    const roomId = this.data.roomId
    if (!roomId) return
    playerWatcher = watchPlayers(
      roomId,
      (snapshot: any) => {
        this.setData({ players: snapshot.docs })
      },
      () => this._fallbackLoadPlayers(),
    )
  },

  _stopAllWatchers() {
    roomWatcher = closeWatcher(roomWatcher)
    playerWatcher = closeWatcher(playerWatcher)
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
      // 触发房间 updatedAt 更新，让其他端感知变化
      await db.collection('rooms').doc(roomId).update({
        data: { updatedAt: db.serverDate() },
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

  /** 开始游戏 - 使用乐观锁防止多端冲突 */
  async onStartGame() {
    if (this.data.players.length < 2) {
      wx.showToast({ title: '至少需要2名玩家', icon: 'none' })
      return
    }
    const ok = await updateRoomStatus(
      this.data.roomId,
      'active',
      this.data.room._version,
    )
    if (!ok) {
      wx.showToast({ title: '操作冲突，请刷新重试', icon: 'none' })
      this.loadRoom()
      return
    }
  },


  onStartRound() {
    wx.navigateTo({ url: `/pages/game/round/round?roomId=${this.data.roomId}` })
  },
  onViewRounds() {
    wx.navigateTo({ url: `/pages/stats/rounds/rounds?roomId=${this.data.roomId}` })
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
