Page({
  data: {
    rooms: [] as any[],
  },
  onShow() {
    this.loadRooms()
  },
  async loadRooms() {
    const db = wx.cloud.database()
    const { data } = await db.collection('rooms')
      .where({ status: 'active' })
      .orderBy('updatedAt', 'desc')
      .get()
    this.setData({ rooms: data })
  },
  onCreateRoom() {
    wx.navigateTo({ url: '/pages/room/create/create' })
  },
  onEnterRoom(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/room/detail/detail?id=${id}` })
  },
})
