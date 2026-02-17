import { observable, action } from 'mobx-miniprogram'

export interface UserState {
  openId: string
  nickname: string
  avatarUrl: string
  logged: boolean
}

const STORAGE_KEY = 'poker_scorer_user'

export const userStore = observable({
  openId: '',
  nickname: '',
  avatarUrl: '',
  logged: false,

  setUser: action(function (this: UserState, info: Partial<UserState>) {
    if (info.openId !== undefined) this.openId = info.openId
    if (info.nickname !== undefined) this.nickname = info.nickname
    if (info.avatarUrl !== undefined) this.avatarUrl = info.avatarUrl
    if (info.logged !== undefined) this.logged = info.logged
    // 持久化到本地存储
    try {
      wx.setStorageSync(STORAGE_KEY, {
        openId: this.openId,
        nickname: this.nickname,
        avatarUrl: this.avatarUrl,
        logged: this.logged,
      })
    } catch (e) {
      console.error('持久化用户信息失败', e)
    }
  }),

  restore: action(function (this: UserState) {
    try {
      const cached = wx.getStorageSync(STORAGE_KEY)
      if (cached && cached.openId) {
        this.openId = cached.openId
        this.nickname = cached.nickname || ''
        this.avatarUrl = cached.avatarUrl || ''
        this.logged = true
        return true
      }
    } catch (e) {
      console.error('恢复用户信息失败', e)
    }
    return false
  }),

  logout: action(function (this: UserState) {
    this.openId = ''
    this.nickname = ''
    this.avatarUrl = ''
    this.logged = false
    try { wx.removeStorageSync(STORAGE_KEY) } catch (_) {}
  }),
})
