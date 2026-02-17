interface PotDisplay {
  amount: number
  eligible: string[]
  eligibleNames: string[]
}

function calcSidePots(playerBets: Array<{playerId: string; betAmount: number}>) {
  const sorted = [...playerBets].sort((a, b) => a.betAmount - b.betAmount)
  const pots: Array<{amount: number; eligible: string[]}> = []
  let prev = 0
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i].betAmount
    if (cur <= prev) continue
    const layer = cur - prev
    const eligible = sorted.filter(p => p.betAmount >= cur).map(p => p.playerId)
    let amt = layer * eligible.length
    const partial = sorted.filter(p => p.betAmount > prev && p.betAmount < cur)
    amt += partial.reduce((s, p) => s + (p.betAmount - prev), 0)
    pots.push({ amount: amt, eligible })
    prev = cur
  }
  return pots
}

Page({
  data: {
    roomId: '',
    players: [] as any[],
    activeTab: 'simple',
    mode: 'simple' as string,
    // simple mode
    deltas: [] as number[],
    balance: 0,
    balanceOk: false,
    // side pot mode
    bets: [] as number[],
    pots: [] as PotDisplay[],
    potWinners: [] as string[],
    spChanges: [] as Array<{openId: string; nickname: string; delta: number}>,
    spBalance: 0,
    spReady: false,
    loading: false,
  },

  onLoad(options: any) {
    this.setData({ roomId: options.roomId || '' })
    this.loadPlayers()
  },

  async loadPlayers() {
    const db = wx.cloud.database()
    const { data } = await db.collection('players')
      .where({ roomId: this.data.roomId, isActive: true })
      .get()
    this.setData({
      players: data,
      deltas: new Array(data.length).fill(0),
      bets: new Array(data.length).fill(0),
    })
  },

  onModeChange(e: any) {
    const mode = e.detail.name || 'simple'
    this.setData({ mode, activeTab: mode })
  },

  /* ---- Simple mode ---- */
  onDeltaChange(e: any) {
    const idx = e.currentTarget.dataset.index
    const val = Number(e.detail) || 0
    const deltas = [...this.data.deltas]
    deltas[idx] = val
    const balance = deltas.reduce((s, d) => s + d, 0)
    this.setData({ deltas, balance, balanceOk: balance === 0 })
  },

  /* ---- Side pot mode ---- */
  onBetChange(e: any) {
    const idx = e.currentTarget.dataset.index
    const val = Number(e.detail) || 0
    const bets = [...this.data.bets]
    bets[idx] = val
    this.setData({ bets })
    this.recalcPots()
  },

  recalcPots() {
    const { players, bets } = this.data
    const playerBets = players
      .map((p: any, i: number) => ({
        playerId: p.openId || p._id,
        betAmount: bets[i],
      }))
      .filter((pb: any) => pb.betAmount > 0)

    if (playerBets.length === 0) {
      this.setData({ pots: [], potWinners: [], spReady: false, spChanges: [], spBalance: 0 })
      return
    }

    const nameMap = new Map(players.map((p: any) => [p.openId || p._id, p.nickname]))
    const raw = calcSidePots(playerBets)
    const pots: PotDisplay[] = raw.map(p => ({
      ...p,
      eligibleNames: p.eligible.map(id => nameMap.get(id) || id),
    }))
    const potWinners = pots.map(p => p.eligible.length === 1 ? p.eligible[0] : '')
    this.setData({ pots, potWinners })
    this.updateSpChanges()
  },

  onWinnerSelect(e: any) {
    const potIdx = e.currentTarget.dataset.potIndex
    const potWinners = [...this.data.potWinners]
    potWinners[potIdx] = e.detail
    this.setData({ potWinners })
    this.updateSpChanges()
  },

  updateSpChanges() {
    const { players, bets, pots, potWinners } = this.data
    const allSelected = pots.length > 0 && potWinners.every((w: string) => w !== '')
    if (!allSelected) {
      this.setData({ spReady: false, spChanges: [], spBalance: 0 })
      return
    }
    const changes: Record<string, number> = {}
    players.forEach((p: any, i: number) => {
      const id = p.openId || p._id
      changes[id] = -(bets[i] || 0)
    })
    pots.forEach((pot: PotDisplay, i: number) => {
      const wid = potWinners[i]
      if (wid) changes[wid] = (changes[wid] || 0) + pot.amount
    })
    const spChanges = players.map((p: any) => {
      const id = p.openId || p._id
      return { openId: id, nickname: p.nickname, delta: changes[id] || 0 }
    })
    const spBalance = spChanges.reduce((s: number, c: any) => s + c.delta, 0)
    this.setData({ spChanges, spBalance, spReady: spBalance === 0 })
  },

  async onConfirm() {
    this.setData({ loading: true })
    try {
      const db = wx.cloud.database()
      if (this.data.mode === 'simple') {
        const changes = this.data.players.map((p: any, i: number) => ({
          openId: p.openId || p._id,
          delta: this.data.deltas[i],
        }))
        await db.collection('rounds').add({
          data: { roomId: this.data.roomId, changes, pots: [], timestamp: db.serverDate() },
        })
        for (let i = 0; i < this.data.players.length; i++) {
          await db.collection('players').doc(this.data.players[i]._id).update({
            data: { currentChips: db.command.inc(this.data.deltas[i]) },
          })
        }
      } else {
        const { spChanges, pots, potWinners } = this.data
        const changes = spChanges.map((c: any) => ({ openId: c.openId, delta: c.delta }))
        const potsData = pots.map((pot: PotDisplay, i: number) => ({
          amount: pot.amount, eligible: pot.eligible, winnerId: potWinners[i],
        }))
        await db.collection('rounds').add({
          data: { roomId: this.data.roomId, changes, pots: potsData, timestamp: db.serverDate() },
        })
        for (const c of spChanges) {
          if (c.delta === 0) continue
          const pl = this.data.players.find((p: any) => (p.openId || p._id) === c.openId)
          if (pl) {
            await db.collection('players').doc(pl._id).update({
              data: { currentChips: db.command.inc(c.delta) },
            })
          }
        }
      }
      wx.showToast({ title: '记录成功', icon: 'success' })
      wx.navigateBack()
    } catch (err) {
      wx.showToast({ title: '记录失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
})
