const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()

  const openId = wxContext.OPENID
  const unionId = wxContext.UNIONID || ''

  // 查找或创建用户记录
  const { data } = await db.collection('users').where({ openId }).get()

  if (data.length === 0) {
    await db.collection('users').add({
      data: {
        openId,
        unionId,
        nickname: '',
        avatarUrl: '',
        createdAt: db.serverDate(),
        lastLoginAt: db.serverDate(),
      },
    })
  } else {
    await db.collection('users').doc(data[0]._id).update({
      data: { lastLoginAt: db.serverDate() },
    })
  }

  return { openId, unionId }
}
