const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { roomId } = event
  const db = cloud.database()

  // 获取房间信息
  const { data: room } = await db.collection('rooms').doc(roomId).get()

  // 获取玩家数据
  const { data: players } = await db.collection('players')
    .where({ roomId })
    .get()

  // 计算盈亏并排序
  const results = players
    .map(p => ({
      nickname: p.nickname,
      totalBuyIn: p.totalBuyIn,
      finalChips: p.currentChips,
      profit: p.currentChips - p.totalBuyIn,
    }))
    .sort((a, b) => b.profit - a.profit)

  // TODO: 使用 node-canvas 或其他方式生成图片
  // 当前返回结构化数据，前端用 Canvas 绘制
  return {
    room: {
      name: room.name,
      smallBlind: room.smallBlind,
      bigBlind: room.bigBlind,
    },
    results,
    generatedAt: new Date().toISOString(),
  }
}
