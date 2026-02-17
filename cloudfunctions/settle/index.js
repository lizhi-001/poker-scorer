const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * Side Pot 计算
 * @param {Array} playerBets - [{playerId, betAmount}] 每个玩家的总投入
 * @returns {Array} pots - [{amount, eligible}] 每个底池的金额和有资格的玩家
 */
function calculateSidePots(playerBets) {
  // 按投入金额从小到大排序
  const sorted = [...playerBets].sort((a, b) => a.betAmount - b.betAmount)
  const pots = []
  let prevBet = 0

  for (let i = 0; i < sorted.length; i++) {
    const currentBet = sorted[i].betAmount
    if (currentBet <= prevBet) continue

    const layerBet = currentBet - prevBet
    const eligible = sorted.filter(p => p.betAmount >= currentBet).map(p => p.playerId)
    const amount = layerBet * eligible.length

    // 加上已淘汰但有贡献的玩家在这一层的贡献
    const partialContributors = sorted.filter(p => p.betAmount > prevBet && p.betAmount < currentBet)
    const partialAmount = partialContributors.reduce((sum, p) => sum + (p.betAmount - prevBet), 0)

    pots.push({
      amount: amount + partialAmount,
      eligible,
    })
    prevBet = currentBet
  }

  return pots
}

exports.main = async (event, context) => {
  const { roomId, playerBets, winners } = event
  const db = cloud.database()

  // 计算 side pots
  const pots = calculateSidePots(playerBets)

  // 根据 winners 分配每个 pot
  const changes = {}
  pots.forEach((pot, index) => {
    const winnerId = winners[index] || winners[0]
    if (!changes[winnerId]) changes[winnerId] = 0
    changes[winnerId] += pot.amount
  })

  // 减去每个玩家的投入
  playerBets.forEach(({ playerId, betAmount }) => {
    if (!changes[playerId]) changes[playerId] = 0
    changes[playerId] -= betAmount
  })

  // 创建结算记录
  const settlement = await db.collection('settlements').add({
    data: {
      roomId,
      results: Object.entries(changes).map(([playerId, profit]) => ({
        playerId,
        profit,
      })),
      pots,
      settledAt: db.serverDate(),
    },
  })

  // 更新房间状态
  await db.collection('rooms').doc(roomId).update({
    data: { status: 'settled', updatedAt: db.serverDate() },
  })

  return { settlementId: settlement._id, changes, pots }
}
