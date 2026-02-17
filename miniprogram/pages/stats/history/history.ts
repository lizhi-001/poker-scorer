Page({
  data: {
    allRooms: [] as any[],
    rooms: [] as any[],
    keyword: '',
    dateFilter: 'all',
    dateOptions: [
      { text: '全部时间', value: 'all' },
      { text: '最近7天', value: '7d' },
      { text: '最近30天', value: '30d' },
      { text: '最近90天', value: '90d' },
    ],
    profitFilter: 'all',
    profitOptions: [
      { text: '全部盈亏', value: 'all' },
      { text: '盈利', value: 'win' },
      { text: '亏损', value: 'lose' },
    ],
  },
  onShow() { this.loadHistory() },

  async loadHistory() {
    const db = wx.cloud.database()
    const app = getApp()
    const openId = app.globalData.userStore?.openId || ''

    const { data: rooms } = await db.collection('rooms')
      .where({ status: db.command.in(['settled', 'archived']) })
      .orderBy('updatedAt', 'desc')
      .get()

    // Load player records for current user to show per-room profit
    let myPlayers: any[] = []
    if (openId) {
      const res = await db.collection('players')
        .where({ openId })
        .get()
      myPlayers = res.data
    }
    const profitMap: Record<string, number> = {}
    myPlayers.forEach((p: any) => {
      profitMap[p.roomId] = p.currentChips - p.totalBuyIn
    })

    const allRooms = rooms.map((r: any) => {
      const profit = profitMap[r._id]
      return {
        ...r,
        dateStr: this._fmtDate(r.updatedAt),
        myProfit: profit !== undefined ? profit : null,
        profitSign: profit !== undefined && profit >= 0 ? '+' : '',
      }
    })
    this.setData({ allRooms })
    this._applyFilters()
  },

  onSearch(e: any) {
    this.setData({ keyword: e.detail || '' })
    this._applyFilters()
  },
  onDateChange(e: any) {
    this.setData({ dateFilter: e.detail })
    this._applyFilters()
  },
  onProfitChange(e: any) {
    this.setData({ profitFilter: e.detail })
    this._applyFilters()
  },

  _applyFilters() {
    let list = this.data.allRooms
    const kw = this.data.keyword.trim().toLowerCase()
    if (kw) {
      list = list.filter((r: any) =>
        (r.name || '').toLowerCase().includes(kw) ||
        (r.roomCode || '').includes(kw)
      )
    }
    if (this.data.dateFilter !== 'all') {
      const days = parseInt(this.data.dateFilter)
      const cutoff = Date.now() - days * 86400000
      list = list.filter((r: any) => {
        const t = r.updatedAt?.$date || new Date(r.updatedAt).getTime()
        return t >= cutoff
      })
    }
    if (this.data.profitFilter === 'win') {
      list = list.filter((r: any) => r.myProfit !== null && r.myProfit > 0)
    } else if (this.data.profitFilter === 'lose') {
      list = list.filter((r: any) => r.myProfit !== null && r.myProfit < 0)
    }
    this.setData({ rooms: list })
  },

  _fmtDate(ts: any): string {
    if (!ts) return ''
    const d = typeof ts === 'object' && ts.$date
      ? new Date(ts.$date) : new Date(ts)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  },

  onTap(e: any) {
    wx.navigateTo({
      url: `/pages/stats/summary/summary?roomId=${e.currentTarget.dataset.id}`,
    })
  },
})
