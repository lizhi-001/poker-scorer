Page({
  data: {
    roomId: '',
    rounds: [] as any[],
    playerMap: {} as Record<string, string>,
    loading: true,
  },
  onLoad(options: any) {
    this.setData({ roomId: options.roomId || '' })
    this.loadData()
  },
  async loadData() {
    const db = wx.cloud.database()
    const [playersRes, roundsRes] = await Promise.all([
      db.collection('players').where({ roomId: this.data.roomId }).get(),
      db.collection('rounds').where({ roomId: this.data.roomId })
        .orderBy('timestamp', 'desc').get(),
    ])
    const playerMap: Record<string, string> = {}
    playersRes.data.forEach((p: any) => {
      playerMap[p.openId || p._id] = p.nickname
    })
    const rounds = roundsRes.data.map((r: any, idx: number) => ({
      ...r,
      displayNum: roundsRes.data.length - idx,
      timeStr: this._fmtTime(r.timestamp),
      changeList: (r.changes || []).map((c: any) => ({
        ...c,
        nickname: playerMap[c.openId] || c.openId,
        sign: c.delta >= 0 ? '+' : '',
      })),
      potList: (r.pots || []).map((p: any) => ({
        ...p,
        winnerName: playerMap[p.winnerId] || p.winnerId,
        eligibleNames: (p.eligible || []).map(
          (id: string) => playerMap[id] || id
        ).join(', '),
      })),
      hasPots: (r.pots || []).length > 0,
    }))
    this.setData({ rounds, playerMap, loading: false })
  },
  _fmtTime(ts: any): string {
    if (!ts) return ''
    const d = typeof ts === 'object' && ts.$date
      ? new Date(ts.$date) : new Date(ts)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  },
})
