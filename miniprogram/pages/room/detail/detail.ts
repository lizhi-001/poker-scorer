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
    // QR code
    showQRCode: false,
    qrCodeUrl: '',
    qrLoading: false,
    // 庄家/位置标签: openId -> 'D' | 'SB' | 'BB' | ''
    positionMap: {} as Record<string, string>,
  },

  onLoad(options) {
    this.setData({ roomId: options.id || '' })
  },
  async onShow() {
    await getApp().globalData.loginReady
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
        this._updatePositions()
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
        this._updatePositions()
      },
      () => this._fallbackLoadPlayers(),
    )
  },

  _stopAllWatchers() {
    roomWatcher = closeWatcher(roomWatcher)
    playerWatcher = closeWatcher(playerWatcher)
  },

  /** 根据庄家位置计算 D/SB/BB 标签 */
  _updatePositions() {
    const { room, players } = this.data
    const dealerOpenId = room?.dealerOpenId
    const active = players.filter((p: any) => p.isActive !== false)
    const positionMap: Record<string, string> = {}
    if (!dealerOpenId || active.length < 2) {
      this.setData({ positionMap })
      return
    }
    const ids = active.map((p: any) => p.openId)
    const dIdx = ids.indexOf(dealerOpenId)
    if (dIdx === -1) {
      this.setData({ positionMap })
      return
    }
    positionMap[dealerOpenId] = 'D'
    if (active.length === 2) {
      // heads-up: 庄家=小盲，对手=大盲
      positionMap[ids[(dIdx + 1) % ids.length]] = 'BB'
      positionMap[dealerOpenId] = 'D/SB'
    } else {
      const sbIdx = (dIdx + 1) % ids.length
      const bbIdx = (dIdx + 2) % ids.length
      positionMap[ids[sbIdx]] = 'SB'
      positionMap[ids[bbIdx]] = 'BB'
    }
    this.setData({ positionMap })
  },

  async loadRoom() {
    const db = wx.cloud.database()
    const { data } = await db.collection('rooms').doc(this.data.roomId).get() as any
    const app = getApp()
    this.setData({
      room: data,
      isCreator: data.creatorId === app.globalData.userStore?.openId,
    })
    this._updatePositions()
  },

  async _fallbackLoadPlayers() {
    const db = wx.cloud.database()
    const { data } = await db.collection('players')
      .where({ roomId: this.data.roomId, isActive: true })
      .orderBy('createdAt', 'asc')
      .get()
    this.setData({ players: data })
    this._updatePositions()
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
    // 自动分配庄家：首次开局时指定第一位活跃玩家为庄家
    const active = this.data.players.filter((p: any) => p.isActive !== false)
    const needDealer = !this.data.room.dealerOpenId && active.length >= 2
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
    if (needDealer) {
      const db = wx.cloud.database()
      await db.collection('rooms').doc(this.data.roomId).update({
        data: { dealerOpenId: active[0].openId, updatedAt: db.serverDate() },
      })
    }
  },

  onStartRound() {
    const { roomId, room, players } = this.data
    const sb = room.smallBlind || 0
    const bb = room.bigBlind || 0
    const playerOrder = players.filter((p: any) => p.isActive !== false).map((p: any) => p.openId)

    // 自动分配庄家：首次未设置时指定第一位活跃玩家
    let dealerOpenId = room.dealerOpenId || ''
    if (!dealerOpenId && playerOrder.length >= 2) {
      dealerOpenId = playerOrder[0]
    }

    wx.navigateTo({
      url: `/pages/game/round/round?roomId=${roomId}&dealerOpenId=${dealerOpenId}&smallBlind=${sb}&bigBlind=${bb}&playerOrder=${playerOrder.join(',')}`,
    })
    // 自动轮转庄家到下一位活跃玩家
    if (dealerOpenId && playerOrder.length >= 2) {
      const curIdx = playerOrder.indexOf(dealerOpenId)
      const nextIdx = (curIdx + 1) % playerOrder.length
      const nextDealer = playerOrder[nextIdx]
      const db = wx.cloud.database()
      db.collection('rooms').doc(roomId).update({
        data: { dealerOpenId: nextDealer, updatedAt: db.serverDate() },
      })
    }
  },

  /** 设置庄家 */
  async onSetDealer(e: any) {
    const openId = e.currentTarget.dataset.openid
    if (!openId) return
    try {
      const db = wx.cloud.database()
      await db.collection('rooms').doc(this.data.roomId).update({
        data: { dealerOpenId: openId, updatedAt: db.serverDate() },
      })
    } catch (err) {
      wx.showToast({ title: '设置庄家失败', icon: 'none' })
    }
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
  /** 显示二维码弹窗 */
  async onShowQRCode() {
    if (this.data.qrCodeUrl) {
      this.setData({ showQRCode: true })
      return
    }
    this.setData({ qrLoading: true, showQRCode: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getQRCode',
        data: { roomId: this.data.roomId },
      }) as any
      const fileID = res.result.fileID
      const { fileList } = await wx.cloud.getTempFileURL({ fileList: [fileID] })
      const url = fileList[0]?.tempFileURL || ''
      this.setData({ qrCodeUrl: url, qrLoading: false })
    } catch (err) {
      this.setData({ qrLoading: false, showQRCode: false })
      wx.showToast({ title: '获取二维码失败', icon: 'none' })
    }
  },
  onCloseQRCode() {
    this.setData({ showQRCode: false })
  },
  /** 保存二维码到相册 */
  async onSaveQRCode() {
    const url = this.data.qrCodeUrl
    if (!url) return
    try {
      const { tempFilePath } = await wx.downloadFile({ url })
      await wx.saveImageToPhotosAlbum({ filePath: tempFilePath })
      wx.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (err: any) {
      if (err?.errMsg?.includes('auth deny')) {
        wx.showToast({ title: '请授权相册权限', icon: 'none' })
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    }
  },

  onShareAppMessage() {
    return {
      title: `来加入「${this.data.room.name}」`,
      path: `/pages/room/detail/detail?id=${this.data.roomId}`,
    }
  },
})
