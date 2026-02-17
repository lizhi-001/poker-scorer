# 🃏 德扑记分器

微信小程序德州扑克记分器，专为线下德扑局设计。

## 功能特性

- **多人实时协同** — 房间内所有玩家手机实时同步筹码变化
- **微信登录** — 一键登录，自动获取头像昵称
- **智能记分** — 支持 Side Pot（边池）自动计算
- **买入管理** — 记录每位玩家的多次买入
- **牌局统计** — 实时盈亏排行，历史战绩回顾
- **结算分享** — 一键生成结算图，支持分享到微信群
- **扫码加入** — 生成房间小程序码，扫码即可加入牌局

## 技术栈

| 层面 | 技术 |
|------|------|
| 框架 | 原生微信小程序 |
| 语言 | TypeScript |
| UI | Vant Weapp |
| 后端 | 微信云开发 |
| 状态管理 | MobX miniprogram bindings |
| 实时同步 | 云数据库 watch() |

## 本地开发

### 前置条件

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- Node.js 18+
- 微信小程序 AppID（在 [微信公众平台](https://mp.weixin.qq.com/) 注册）

### 开始开发

1. 克隆仓库
```bash
git clone https://github.com/lizhi-001/poker-scorer.git
cd poker-scorer
```

2. 安装小程序依赖
```bash
cd miniprogram && npm install
```

3. 用微信开发者工具打开项目根目录

4. 在开发者工具中点击「工具 → 构建 npm」

5. 开通云开发并在 `miniprogram/app.ts` 中配置环境 ID

### 项目结构

```
poker-scorer/
├── miniprogram/           # 小程序前端
│   ├── pages/             # 页面
│   │   ├── index/         # 首页：房间列表
│   │   ├── room/          # 房间：创建 & 详情
│   │   ├── game/          # 牌局：记分 & 结算
│   │   ├── stats/         # 统计：汇总 & 历史
│   │   ├── settlement/    # 结算分享
│   │   └── profile/       # 个人中心
│   ├── components/        # 自定义组件
│   ├── store/             # MobX 状态管理
│   ├── utils/             # 工具函数
│   └── typings/           # TypeScript 类型
├── cloudfunctions/        # 云函数
│   ├── login/             # 登录
│   ├── settle/            # 结算计算
│   ├── genShareImage/     # 生成分享图
│   ├── getQRCode/         # 生成小程序码
│   └── cleanExpired/      # 定时清理
├── docs/                  # 文档
│   └── tech-spec.md       # 技术方案
└── CLAUDE.md              # AI 开发上下文
```

## 文档

- [技术方案](docs/tech-spec.md) — 架构设计、数据模型、实时同步方案

## License

MIT
