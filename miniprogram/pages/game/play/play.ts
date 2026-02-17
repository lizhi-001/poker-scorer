Page({
  data: {
    roomId: '',
    nickname: '',
    initialChips: '',
    loading: false,
  },
  onLoad(options) {
    this.setData({ roomId: options.roomId || '' })
  },
  async onAdd() {
    const { nickname, initialChips, roomId } = this.data
    if (!nickname.trim() || !initialChips) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    try {
      const db = wx.cloud.database()
      const { _id } = await db.collection('players').add({
        data: {
          roomId,
          nickname: nickname.trim(),
          initialChips: Number(initialChips),
          currentChips: Number(initialChips),
          buyInCount: 1,
          totalBuyIn: Number(initialChips),
          isActive: true,
          createdAt: db.serverDate(),
        },
      })
      // 创建首次买入记录
      await db.collection('buyins').add({
        data: {
          roomId,
          playerId: _id,
          amount: Number(initialChips),
          createdAt: db.serverDate(),
        },
      })
      wx.navigateBack()
    } catch (err) {
      wx.showToast({ title: '添加失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
})
