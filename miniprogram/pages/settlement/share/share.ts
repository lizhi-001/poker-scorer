interface ShareResult {
  nickname: string
  totalBuyIn: number
  finalChips: number
  profit: number
}

interface ShareData {
  room: { name: string; smallBlind: number; bigBlind: number }
  results: ShareResult[]
  generatedAt: string
}

// Canvas 物理像素尺寸
const W = 650
const H = 900

Page({
  data: {
    roomId: '',
    loading: true,
    tempFilePath: '',
  },
  _canvas: null as any,
  _ctx: null as any,

  onLoad(options) {
    this.setData({ roomId: options.roomId || '' })
    this.initCanvas()
  },

  async initCanvas() {
    const query = wx.createSelectorQuery()
    query.select('#shareCanvas').fields({ node: true, size: true }).exec(async (res) => {
      if (!res[0]) {
        wx.showToast({ title: '画布初始化失败', icon: 'none' })
        return
      }
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getWindowInfo().pixelRatio
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.scale(dpr, dpr)
      this._canvas = canvas
      this._ctx = ctx
      await this.drawShareImage()
    })
  },

  async drawShareImage() {
    const ctx = this._ctx
    if (!ctx) return

    wx.showLoading({ title: '生成中...' })
    try {
      // 并行获取结算数据和小程序码
      const [shareRes, qrRes] = await Promise.all([
        wx.cloud.callFunction({ name: 'genShareImage', data: { roomId: this.data.roomId } }),
        wx.cloud.callFunction({ name: 'getQRCode', data: { roomId: this.data.roomId } }),
      ])
      const shareData = (shareRes as any).result as ShareData
      const qrFileID = (qrRes as any).result.fileID

      // 绘制背景
      this.drawBackground(ctx)
      // 绘制标题和房间信息
      let y = this.drawHeader(ctx, shareData.room)
      // 绘制玩家排名表
      y = this.drawPlayerTable(ctx, shareData.results, y)
      // 绘制小程序码
      await this.drawQRCode(ctx, qrFileID, y)
      // 绘制底部时间戳
      this.drawFooter(ctx, shareData.generatedAt)

      // 导出临时图片路径
      await this.exportImage()
    } catch (err) {
      console.error('生成分享图失败', err)
      wx.showToast({ title: '生成失败', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ loading: false })
    }
  },

  drawBackground(ctx: CanvasRenderingContext2D) {
    // 白色圆角背景
    const r = 16
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(r, 0)
    ctx.lineTo(W - r, 0)
    ctx.arcTo(W, 0, W, r, r)
    ctx.lineTo(W, H - r)
    ctx.arcTo(W, H, W - r, H, r)
    ctx.lineTo(r, H)
    ctx.arcTo(0, H, 0, H - r, r)
    ctx.lineTo(0, r)
    ctx.arcTo(0, 0, r, 0, r)
    ctx.closePath()
    ctx.fill()
  },

  drawHeader(ctx: CanvasRenderingContext2D, room: ShareData['room']): number {
    // 标题
    ctx.fillStyle = '#E94560'
    ctx.font = 'bold 32px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🃏 德扑记分器 · 结算', W / 2, 52)

    // 房间名
    ctx.fillStyle = '#333333'
    ctx.font = '24px sans-serif'
    ctx.fillText(room.name, W / 2, 92)

    // 盲注信息
    ctx.fillStyle = '#888888'
    ctx.font = '20px sans-serif'
    ctx.fillText(`盲注 ${room.smallBlind}/${room.bigBlind}`, W / 2, 122)

    // 分隔线
    ctx.strokeStyle = '#EEEEEE'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(32, 142)
    ctx.lineTo(W - 32, 142)
    ctx.stroke()

    return 170
  },

  drawPlayerTable(ctx: CanvasRenderingContext2D, results: ShareResult[], startY: number): number {
    const padX = 40
    let y = startY

    // 表头
    ctx.fillStyle = '#999999'
    ctx.font = '18px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('排名', padX, y)
    ctx.fillText('玩家', padX + 60, y)
    ctx.textAlign = 'right'
    ctx.fillText('买入', W - padX - 200, y)
    ctx.fillText('结余', W - padX - 100, y)
    ctx.fillText('盈亏', W - padX, y)
    y += 12

    // 表头下划线
    ctx.strokeStyle = '#EEEEEE'
    ctx.beginPath()
    ctx.moveTo(padX, y)
    ctx.lineTo(W - padX, y)
    ctx.stroke()
    y += 28

    // 玩家行
    results.forEach((r, i) => {
      const isProfit = r.profit >= 0
      ctx.textAlign = 'left'
      ctx.fillStyle = i === 0 ? '#E94560' : '#666666'
      ctx.font = i === 0 ? 'bold 22px sans-serif' : '22px sans-serif'
      ctx.fillText(`${i + 1}`, padX, y)

      const name = r.nickname.length > 6 ? r.nickname.slice(0, 6) + '..' : r.nickname
      ctx.fillStyle = '#333333'
      ctx.font = '22px sans-serif'
      ctx.fillText(name, padX + 60, y)

      ctx.textAlign = 'right'
      ctx.fillStyle = '#666666'
      ctx.fillText(`${r.totalBuyIn}`, W - padX - 200, y)
      ctx.fillText(`${r.finalChips}`, W - padX - 100, y)

      ctx.fillStyle = isProfit ? '#27AE60' : '#E94560'
      ctx.font = 'bold 22px sans-serif'
      ctx.fillText(`${isProfit ? '+' : ''}${r.profit}`, W - padX, y)

      y += 40
    })
    return y + 10
  },

  async drawQRCode(ctx: CanvasRenderingContext2D, fileID: string, startY: number) {
    try {
      const { tempFilePath } = await wx.cloud.downloadFile({ fileID })
      const img = this._canvas.createImage()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('QR load failed'))
        img.src = tempFilePath
      })
      const qrSize = 120
      ctx.drawImage(img, (W - qrSize) / 2, startY, qrSize, qrSize)
      ctx.fillStyle = '#999999'
      ctx.font = '16px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('扫码加入房间', W / 2, startY + qrSize + 24)
    } catch (err) {
      console.warn('绘制小程序码失败，跳过', err)
    }
  },

  drawFooter(ctx: CanvasRenderingContext2D, generatedAt: string) {
    const time = generatedAt ? new Date(generatedAt).toLocaleString('zh-CN') : ''
    ctx.fillStyle = '#CCCCCC'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`生成于 ${time}`, W / 2, H - 24)
  },

  async exportImage() {
    return new Promise<void>((resolve) => {
      wx.canvasToTempFilePath({
        canvas: this._canvas,
        width: this._canvas.width,
        height: this._canvas.height,
        destWidth: this._canvas.width,
        destHeight: this._canvas.height,
        fileType: 'png',
        success: (res) => {
          this.setData({ tempFilePath: res.tempFilePath })
          resolve()
        },
        fail: () => resolve(),
      })
    })
  },

  onSave() {
    const filePath = this.data.tempFilePath
    if (!filePath) {
      wx.showToast({ title: '图片未就绪', icon: 'none' })
      return
    }
    wx.saveImageToPhotosAlbum({
      filePath,
      success() { wx.showToast({ title: '已保存到相册', icon: 'success' }) },
      fail(err) {
        if ((err as any).errMsg?.includes('deny') || (err as any).errMsg?.includes('auth')) {
          wx.showModal({
            title: '需要授权',
            content: '请在设置中允许保存图片到相册',
            confirmText: '去设置',
            success(modalRes) { if (modalRes.confirm) wx.openSetting({}) },
          })
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      },
    })
  },

  onShareAppMessage() {
    return {
      title: '德扑牌局结算',
      path: `/pages/stats/summary/summary?roomId=${this.data.roomId}`,
      imageUrl: this.data.tempFilePath || '',
    }
  },
})