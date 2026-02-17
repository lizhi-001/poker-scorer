# 德扑记分器微信小程序 — 技术方案

## 技术选型

| 层面 | 选型 | 理由 |
|------|------|------|
| 框架 | 原生微信小程序 | 云开发集成最无缝，实时数据监听原生支持，无额外抽象层 |
| 语言 | TypeScript | Side pot 等复杂计算需要类型安全 |
| UI 组件库 | Vant Weapp | 成熟稳定，德扑场景需要的弹窗/表单/列表组件齐全 |
| 后端 | 微信云开发 | 免运维，内置实时数据库、云函数、云存储，天然支持多端同步 |
| 状态管理 | MobX miniprogram bindings | 轻量，适合中等复杂度，官方推荐 |

## 核心架构

```
┌─────────────────────────────────────────────┐
│                 小程序前端                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ 房间管理  │ │ 牌局记分  │ │ 统计 & 分享  │ │
│  └────┬─────┘ └────┬─────┘ └──────┬───────┘ │
│       │            │              │          │
│  ┌────┴────────────┴──────────────┴───────┐  │
│  │         MobX Store (全局状态)           │  │
│  └────────────────┬───────────────────────┘  │
└───────────────────┼──────────────────────────┘
                    │ wx.cloud / realtime listener
┌───────────────────┼──────────────────────────┐
│            微信云开发后端                      │
│  ┌────────────────┴───────────────────────┐  │
│  │          Cloud Database                 │  │
│  │  rooms / players / rounds / settlements │  │
│  │  (realtime watch 实现多端同步)           │  │
│  ├─────────────────────────────────────────┤  │
│  │          Cloud Functions                │  │
│  │  - settle: side pot 结算计算             │  │
│  │  - genShareImage: 生成分享图             │  │
│  │  - auth: 用户登录 & 绑定                 │  │
│  ├─────────────────────────────────────────┤  │
│  │          Cloud Storage                  │  │
│  │  分享图片 / 用户头像缓存                  │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

## 数据模型

### rooms (房间/牌局)

```typescript
interface Room {
  _id: string              // 云数据库自动生成
  name: string             // 房间名称
  creatorId: string        // 创建者 openId
  smallBlind: number       // 小盲注
  bigBlind: number         // 大盲注
  buyIn: number            // 默认买入金额
  status: 'active' | 'settled' | 'archived'
  playerIds: string[]      // 玩家 openId 列表
  createdAt: Date
  updatedAt: Date
}
```

### players (玩家-房间关联)

```typescript
interface RoomPlayer {
  _id: string
  roomId: string
  openId: string
  nickname: string
  avatarUrl: string
  initialChips: number     // 初始筹码（含所有买入）
  currentChips: number     // 当前筹码
  buyInCount: number       // 买入次数
  totalBuyIn: number       // 总买入金额
  isActive: boolean        // 是否还在牌局中
}
```

### rounds (每手牌记录)

```typescript
interface Round {
  _id: string
  roomId: string
  roundNumber: number
  changes: PlayerChipChange[]  // 每个玩家的筹码变动
  pots: Pot[]                  // 底池信息（含 side pot）
  timestamp: Date
  operatorId: string           // 记录操作者
}

interface PlayerChipChange {
  openId: string
  delta: number              // 筹码变动（正=赢，负=输）
}

interface Pot {
  amount: number
  eligible: string[]         // 有资格赢此池的玩家 openId
  winnerId: string           // 赢家
}
```

### settlements (结算记录)

```typescript
interface Settlement {
  _id: string
  roomId: string
  results: PlayerResult[]
  shareImageUrl: string      // 云存储中的分享图 URL
  qrCodeUrl: string          // 小程序码 URL
  settledAt: Date
}

interface PlayerResult {
  openId: string
  nickname: string
  totalBuyIn: number
  finalChips: number
  profit: number             // finalChips - totalBuyIn
}
```

## 页面结构

```
pages/
├── index/              # 首页：房间列表 + 创建房间入口
├── room/
│   ├── create/         # 创建房间：设置盲注、买入
│   └── detail/         # 房间详情：玩家列表、开始牌局
├── game/
│   ├── play/           # 牌局进行中：记分主界面
│   └── round/          # 单手牌结算：输入各玩家筹码变动
├── stats/
│   ├── summary/        # 牌局统计汇总
│   └── history/        # 历史牌局列表
├── settlement/
│   └── share/          # 结算页 + 分享图生成
└── profile/            # 个人中心：登录状态、历史战绩
```

## 实时同步方案

使用云数据库的 `watch()` 实现多端实时同步：

```typescript
// 监听房间内玩家筹码变化
const watcher = db.collection('players')
  .where({ roomId: currentRoomId })
  .watch({
    onChange(snapshot) {
      // 更新本地 MobX store
      store.updatePlayers(snapshot.docs)
    },
    onError(err) {
      console.error('realtime sync error', err)
    }
  })
```

关键同步点：
- 玩家加入/退出房间
- 每手牌结算后筹码变动
- 房间状态变更（进行中 → 已结算）

## 分享图生成方案

使用云函数 + Canvas 服务端渲染：

1. 前端调用云函数 `genShareImage`，传入结算数据
2. 云函数用 `node-canvas` 绘制结算表格（玩家、盈亏、排名）
3. 上传到云存储，返回临时链接
4. 前端调用 `wx.showShareImageMenu` 或自定义分享

备选方案：前端用小程序 Canvas API 本地绘制（无需云函数，但兼容性需注意）。

## 云函数列表

| 函数名 | 触发方式 | 功能 |
|--------|----------|------|
| `login` | 前端调用 | wx.login 换取 openId，创建/更新用户记录 |
| `settle` | 前端调用 | 计算 side pot、生成结算记录 |
| `genShareImage` | 前端调用 | 生成结算分享图，存入云存储 |
| `getQRCode` | 前端调用 | 生成房间小程序码，供邀请加入 |
| `cleanExpired` | 定时触发 | 清理超过 30 天的已归档房间 |

## Side Pot 计算逻辑

这是记分器的核心难点。算法概要：

1. 收集每个玩家的总投入（all-in 金额不同导致 side pot）
2. 按投入金额从小到大排序
3. 逐层切分底池：每层 = (当前投入 - 上一层投入) × 该层有资格的玩家数
4. 每个 pot 记录有资格赢取的玩家列表
5. 由操作者指定每个 pot 的赢家，系统计算筹码变动

## Gas Town 任务拆分建议

基于以上架构，建议按以下顺序拆分 Issue：

| 优先级 | Issue | 依赖 |
|--------|-------|------|
| P0 | 项目骨架：目录结构、app.json、云开发初始化、Vant 引入、TS 配置 | 无 |
| P0 | 数据模型：云数据库集合创建、TypeScript 类型定义 | 无 |
| P1 | 用户登录：wx.login 云函数、用户信息获取与存储 | P0 |
| P1 | 房间管理页：创建房间、房间列表、加入房间（扫码/输入） | P0 |
| P1 | 玩家管理：房间内玩家列表、添加/移除、买入操作 | P0 |
| P1 | 记分核心：每手牌结算 UI + side pot 计算云函数 | P0 |
| P2 | 实时同步：watch 监听、多端状态同步、冲突处理 | P1 全部 |
| P2 | 统计汇总：牌局盈亏统计、历史记录页 | 记分核心 |
| P2 | 结算分享：分享图生成、小程序码邀请 | 统计汇总 |
| P3 | 体验优化：动画、音效、深色模式、异常兜底 | 全部 |
