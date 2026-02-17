# Poker Scorer 德扑记分器

## 项目概述
微信小程序德州扑克记分器，支持多人实时协同记分、微信登录、结算分享。

## 技术栈
- 框架：原生微信小程序
- 语言：TypeScript
- UI 组件库：Vant Weapp
- 后端：微信云开发（云数据库 + 云函数 + 云存储）
- 状态管理：MobX miniprogram bindings

## 目录结构
```
miniprogram/          # 小程序前端代码
  pages/              # 页面
  components/         # 自定义组件
  store/              # MobX 全局状态
  utils/              # 工具函数
  typings/            # TypeScript 类型定义
cloudfunctions/       # 云函数
  login/              # 微信登录
  settle/             # Side pot 结算计算
  genShareImage/      # 生成分享图
  getQRCode/          # 生成小程序码
  cleanExpired/       # 定时清理过期房间
docs/                 # 项目文档
```

## 开发规范
- 所有代码使用 TypeScript，严格模式
- 组件命名：kebab-case（如 player-card）
- 页面命名：小写（如 pages/room/create/）
- 云函数每个独立目录，各自 package.json
- 提交信息格式：`type: 描述`（feat/fix/docs/refactor/chore）

## 关键设计
- 实时同步：云数据库 watch() 监听玩家筹码变化
- Side Pot：按 all-in 金额逐层切分底池，独立云函数计算
- 分享图：云函数 node-canvas 绘制，上传云存储
- 房间二维码：调用 getQRCode 云函数生成小程序码，van-popup 弹窗展示，支持保存到相册
- 庄家/盲注：Room.dealerOpenId 记录庄家位置，自动轮转，进入记分页自动预填大小盲注
- 多轮下注：Side Pot 模式支持翻前/翻牌/转牌/河牌四条街逐步下注，弃牌功能，街道快照保存

## 常用命令
```bash
# 云函数部署（在微信开发者工具中右键云函数目录上传）
# 本地开发使用微信开发者工具打开项目根目录
```

## 注意事项
- 云开发环境 ID 配置在 miniprogram/app.ts 中
- Vant Weapp 组件通过 npm 安装后需在开发者工具中「构建 npm」
- 真机调试需在 project.config.json 中配置正确的 appid
