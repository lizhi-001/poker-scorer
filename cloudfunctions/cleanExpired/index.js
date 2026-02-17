const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const db = cloud.database()
  const _ = db.command

  // 清理 30 天前已结算的房间
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  // 清理 24 小时前仍在等待中的房间
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const { data: expiredRooms } = await db.collection('rooms')
    .where(_.or([
      { status: 'settled', updatedAt: _.lt(thirtyDaysAgo) },
      { status: 'waiting', updatedAt: _.lt(oneDayAgo) },
    ]))
    .get()

  let cleaned = 0
  for (const room of expiredRooms) {
    // 归档房间
    await db.collection('rooms').doc(room._id).update({
      data: { status: 'archived' },
    })
    cleaned++
  }

  return { cleaned, total: expiredRooms.length }
}
