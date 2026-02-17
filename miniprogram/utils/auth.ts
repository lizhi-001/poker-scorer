import { userStore } from '../store/user'

/** 静默登录：调用云函数获取 openId */
export async function silentLogin(): Promise<string> {
  const { result } = await wx.cloud.callFunction({ name: 'login' })
  const { openId } = result as { openId: string }
  userStore.setUser({ openId, logged: true })
  return openId
}

/** 获取用户头像和昵称（需用户主动授权） */
export async function getUserProfile(): Promise<{
  nickName: string
  avatarUrl: string
}> {
  const res = await wx.getUserProfile({
    desc: '用于显示玩家信息',
  })
  const { nickName, avatarUrl } = res.userInfo
  userStore.setUser({ nickname: nickName, avatarUrl })
  // 同步到云数据库
  try {
    const db = wx.cloud.database()
    await db
      .collection('users')
      .where({ openId: userStore.openId })
      .update({ data: { nickname: nickName, avatarUrl } })
  } catch (e) {
    console.error('同步用户信息到云端失败', e)
  }
  return { nickName, avatarUrl }
}

/** 完整登录流程：静默登录 + 授权用户信息 */
export async function login(): Promise<void> {
  await silentLogin()
  await getUserProfile()
}

/** 尝试恢复登录态，失败则静默登录 */
export async function ensureLogin(): Promise<void> {
  const restored = userStore.restore()
  if (restored) {
    // 后台刷新 openId（静默，不阻塞）
    silentLogin().catch(() => {})
    return
  }
  // 无缓存，仅静默登录拿 openId，不弹授权
  try {
    await silentLogin()
  } catch (e) {
    console.error('静默登录失败', e)
  }
}
