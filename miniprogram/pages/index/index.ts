let watcher: any = null

Page({
  data: {
    rooms: [] as any[],
    showJoinDialog: false,
    joinCode: '',
    joinLoading: false,
  },
  async onShow() {
    await getApp().globalData.loginReady
    this._startWatch()
  },
  onHide() {
    this._stopWatch()
  },
  onUnload() {
    this._stopWatch()
  },
  _startWatch() {
    this._stopWatch()
    const db = wx.cloud.database()
    watcher = db.collection('rooms')
      .where({ status: db.command.in(['waiting', 'active']) })
      .orderBy('updatedAt', 'desc')
      .watch({
        onChange: (snapshot: any) => {
          this.setData({ rooms: snapshot.docs })
        },
        onError: (err: any) => {
          console.error('room watch error', err)
          this._fallbackLoad()
        },
      })
  },
  _stopWatch() {
    if (watcher) {
      watcher.close()
      watcher = null
    }
  },
  async _fallbackLoad() {
    const db = wx.cloud.database()
    const { data } = await db.collection('rooms')
      .where({ status: db.command.in(['waiting', 'active']) })
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
  onShowJoinDialog() {
    this.setData({ showJoinDialog: true, joinCode: '' })
  },
  onJoinCodeInput(e: any) {
    this.setData({ joinCode: e.detail })
  },
  onCloseJoinDialog() {
    this.setData({ showJoinDialog: false, joinCode: '' })
  },
  async onConfirmJoin() {
    const code = this.data.joinCode.trim()
    if (!code) {
      wx.showToast({ title: '请输入房间号', icon: 'none' })
      return
    }
    this.setData({ joinLoading: true })
    try {
      const db = wx.cloud.database()
      const { data } = await db.collection('rooms')
        .where({ roomCode: code, status: db.command.in(['waiting', 'active']) })
        .limit(1)
        .get()
      if (!data.length) {
        wx.showToast({ title: '房间不存在或已结束', icon: 'none' })
        return
      }
      this.setData({ showJoinDialog: false })
      wx.navigateTo({ url: `/pages/room/detail/detail?id=${data[0]._id}` })
    } catch (err) {
      wx.showToast({ title: '查找房间失败', icon: 'none' })
    } finally {
      this.setData({ joinLoading: false })
    }
  },
  onScanJoin() {
    wx.scanCode({
      onlyFromCamera: false,
      success: (res) => {
        const scene = decodeURIComponent(res.result || '')
        const match = scene.match(/roomId=([^&]+)/)
        if (match) {
          wx.navigateTo({ url: `/pages/room/detail/detail?id=${match[1]}` })
        } else {
          wx.showToast({ title: '无效的房间二维码', icon: 'none' })
        }
      },
    })
  },
})
