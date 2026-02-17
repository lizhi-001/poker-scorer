import { watchPlayers, closeWatcher, updateRoomStatus } from '../../utils/sync'

let playerWatcher: any = null

Page({
  data: {
    roomId: '',
    results: [] as any[],
  },
  onLoad(options) {
    this.setData({ roomId: options.roomId || '' })
    this._startPlayerWatch()
  },
  onUnload() {
    playerWatcher = closeWatcher(playerWatcher)
  },

  _startPlayerWatch() {
    playerWatcher = closeWatcher(playerWatcher)
    const roomId = this.data.roomId
    if (!roomId) return
    playerWatcher = watchPlayers(
      roomId,
      (snapshot: any) => {
        this._updateResults(snapshot.docs || [])
      },
      () => this._fallbackLoad(),
    )
  },

  _updateResults(players: any[]) {
    const results = players
      .map(p => ({
        openId: p.openId || p._id,
        nickname: p.nickname,
        totalBuyIn: p.totalBuyIn,
        finalChips: p.currentChips,
        profit: p.currentChips - p.totalBuyIn,
      }))
      .sort((a, b) => b.profit - a.profit)
    this.setData({ results })
  },

  async _fallbackLoad() {
    const db = wx.cloud.database()
    const { data } = await db.collection('players')
      .where({ roomId: this.data.roomId })
      .get()
    this._updateResults(data)
  },

  onShare() {
    wx.navigateTo({ url: `/pages/settlement/share/share?roomId=${this.data.roomId}` })
  },
  async onEndGame() {
    const ok = await updateRoomStatus(this.data.roomId, 'settled')
    if (!ok) {
      wx.showToast({ title: '操作冲突，请重试', icon: 'none' })
      return
    }
    wx.showToast({ title: '牌局已结算', icon: 'success' })
    wx.reLaunch({ url: '/pages/index/index' })
  },
})
