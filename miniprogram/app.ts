import { ensureLogin } from './utils/auth'
import { userStore } from './store/user'

App({
  onLaunch(options) {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: 'cloud1-4gm99qrd8397ea37',
      traceUser: true,
    })
    ensureLogin()
    // 扫码进入：scene 格式 roomId=xxx
    if (options?.query?.scene) {
      const scene = decodeURIComponent(options.query.scene)
      const match = scene.match(/roomId=([^&]+)/)
      if (match) {
        this.globalData.pendingRoomId = match[1]
      }
    }
  },

  onShow() {
    if (this.globalData.pendingRoomId) {
      const roomId = this.globalData.pendingRoomId
      this.globalData.pendingRoomId = ''
      wx.navigateTo({ url: `/pages/room/detail/detail?id=${roomId}` })
    }
  },

  globalData: {
    userStore,
    pendingRoomId: '',
  },
})
