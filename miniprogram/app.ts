import { ensureLogin } from './utils/auth'
import { userStore } from './store/user'

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: 'YOUR_CLOUD_ENV_ID', // 替换为你的云开发环境 ID
      traceUser: true,
    })
    ensureLogin()
  },

  globalData: {
    userStore,
  },
})
