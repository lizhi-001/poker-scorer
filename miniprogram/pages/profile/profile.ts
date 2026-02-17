import { createStoreBindings } from 'mobx-miniprogram-bindings'
import { userStore } from '../../store/user'
import { login } from '../../utils/auth'

Page({
  data: {
    openId: '',
    nickname: '',
    avatarUrl: '',
    logged: false,
    totalGames: 0,
    totalProfit: 0,
  },

  storeBindings: null as any,

  onLoad() {
    this.storeBindings = createStoreBindings(this, {
      store: userStore,
      fields: ['openId', 'nickname', 'avatarUrl', 'logged'],
    })
  },

  onShow() {
    if (this.storeBindings) {
      this.storeBindings.updateStoreBindings()
    }
    if (userStore.logged && userStore.openId) {
      this.loadStats()
    }
  },

  onUnload() {
    if (this.storeBindings) {
      this.storeBindings.destroyStoreBindings()
    }
  },

  async onLogin() {
    try {
      await login()
      wx.showToast({ title: '登录成功', icon: 'success' })
      this.loadStats()
    } catch (err) {
      console.error('登录失败', err)
      wx.showToast({ title: '登录失败', icon: 'none' })
    }
  },

  async loadStats() {
    try {
      const db = wx.cloud.database()
      const { data } = await db
        .collection('room_players')
        .where({ openId: userStore.openId })
        .get()
      const totalGames = data.length
      const totalProfit = data.reduce(
        (sum: number, p: any) => sum + (p.currentChips - p.totalBuyIn),
        0
      )
      this.setData({ totalGames, totalProfit })
    } catch (_) {}
  },

  onLogout() {
    userStore.logout()
    this.setData({ totalGames: 0, totalProfit: 0 })
    wx.showToast({ title: '已退出', icon: 'success' })
  },
})
