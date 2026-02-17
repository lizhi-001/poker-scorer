import { userStore } from '../../../store/user'

Page({
  data: {
    name: '',
    smallBlind: 5,
    bigBlind: 10,
    buyIn: 500,
    loading: false,
  },
  onSmallBlindChange(e: any) { this.setData({ smallBlind: e.detail }) },
  onBigBlindChange(e: any) { this.setData({ bigBlind: e.detail }) },
  onBuyInChange(e: any) { this.setData({ buyIn: e.detail }) },
  async onSubmit() {
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请输入牌局名称', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    try {
      const db = wx.cloud.database()
      const { _id } = await db.collection('rooms').add({
        data: {
          name: this.data.name,
          creatorId: userStore.openId,
          smallBlind: this.data.smallBlind,
          bigBlind: this.data.bigBlind,
          buyIn: this.data.buyIn,
          status: 'active',
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
