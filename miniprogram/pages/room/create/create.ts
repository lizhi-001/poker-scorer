import { userStore } from '../../../store/user'

Page({
  data: {
    name: '',
    smallBlind: 5,
    bigBlind: 10,
    buyIn: 500,
    loading: false,
    nameError: '',
    blindError: '',
  },
  onNameInput(e: any) {
    const name = e.detail as string
    this.setData({
      name,
      nameError: name.trim().length > 0 && name.trim().length < 2
        ? '牌局名称至少2个字符' : '',
    })
  },
  onSmallBlindChange(e: any) {
    const smallBlind = e.detail
    const bigBlind = this.data.bigBlind
    this.setData({
      smallBlind,
      blindError: bigBlind <= smallBlind ? '大盲注必须大于小盲注' : '',
    })
  },
  onBigBlindChange(e: any) {
    const bigBlind = e.detail
    const smallBlind = this.data.smallBlind
    this.setData({
      bigBlind,
      blindError: bigBlind <= smallBlind ? '大盲注必须大于小盲注' : '',
    })
  },
  onBuyInChange(e: any) { this.setData({ buyIn: e.detail }) },
  _generateRoomCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000))
  },
  async onSubmit() {
    const { name, smallBlind, bigBlind, buyIn } = this.data
    if (!name.trim()) {
      this.setData({ nameError: '请输入牌局名称' })
      return
    }
    if (name.trim().length < 2) {
      this.setData({ nameError: '牌局名称至少2个字符' })
      return
    }
    if (bigBlind <= smallBlind) {
      this.setData({ blindError: '大盲注必须大于小盲注' })
      return
    }
    if (buyIn < bigBlind * 10) {
      wx.showToast({ title: '买入至少为大盲注的10倍', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    try {
      const db = wx.cloud.database()
      const roomCode = this._generateRoomCode()
      const { _id } = await db.collection('rooms').add({
        data: {
          roomCode,
          name: name.trim(),
          creatorId: userStore.openId,
          smallBlind,
          bigBlind,
          buyIn,
          status: 'waiting' as const,
          playerIds: [],
          createdAt: db.serverDate(),
          updatedAt: db.serverDate(),
        },
      })
      wx.redirectTo({ url: `/pages/room/detail/detail?id=${_id}` })
    } catch (err) {
      wx.showToast({ title: '创建失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
})
