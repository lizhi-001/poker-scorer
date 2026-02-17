const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { roomId } = event

  try {
    // 生成小程序码
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene: `roomId=${roomId}`,
      page: 'pages/room/detail/detail',
      width: 280,
      autoColor: false,
      lineColor: { r: 233, g: 69, b: 96 },
      isHyaline: false,
    })

    // 上传到云存储
    const uploadResult = await cloud.uploadFile({
      cloudPath: `qrcodes/${roomId}_${Date.now()}.png`,
      fileContent: result.buffer,
    })

    return { fileID: uploadResult.fileID }
  } catch (err) {
    console.error('生成小程序码失败', err)
    throw err
  }
}
