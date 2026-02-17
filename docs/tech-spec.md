# 德扑记分器微信小程序 — 技术文档

## 1. 技术选型

| 层面 | 选型 | 理由 |
|------|------|------|
| 框架 | 原生微信小程序 | 云开发集成最无缝，实时数据监听原生支持，无额外抽象层 |
| 语言 | TypeScript | Side pot 等复杂计算需要类型安全，开发者工具内置编译插件 |
| UI 组件库 | Vant Weapp | 成熟稳定，德扑场景需要的弹窗/表单/列表/滑动删除组件齐全 |
| 后端 | 微信云开发 | 免运维，内置实时数据库、云函数、云存储，天然支持多端同步 |
| 状态管理 | MobX miniprogram bindings | 轻量，适合中等复杂度，官方推荐 |

## 2. 核心架构

```
┌─────────────────────────────────────────────┐
│                 小程序前端                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ 房间管理  │ │ 牌局记分  │ │ 统计 & 分享  │ │
│  └────┬─────┘ └────┬─────┘ └──────┬───────┘ │
│       │            │              │          │
│  ┌────┴────────────┴──────────────┴───────┐  │
│  │         MobX Store (用户状态)           │  │
│  └────────────────┬───────────────────────┘  │
└───────────────────┼──────────────────────────┘
                    │ wx.cloud / realtime watch
┌───────────────────┼──────────────────────────┐
│            微信云开发后端                      │
│  ┌────────────────┴───────────────────────┐  │
│  │          Cloud Database                 │  │
│  │  rooms / players / rounds / buyins      │  │
│  │  users / settlements                    │  │
│  │  (realtime watch 实现多端同步)           │  │
│  ├─────────────────────────────────────────┤  │
│  │          Cloud Functions                │  │
│  │  login / settle / genShareImage         │  │
│  │  getQRCode / cleanExpired               │  │
│  ├─────────────────────────────────────────┤  │
│  │          Cloud Storage                  │  │
│  │  小程序码图片 (qrcodes/)                 │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

## 3. 已实现功能总览

| 功能模块 | 状态 | 说明 |
|----------|------|------|
| 微信静默登录 | ✅ | 自动获取 openId，本地缓存恢复 |
| 用户信息授权 | ✅ | 主动授权获取头像昵称，同步云端 |
| 创建牌局房间 | ✅ | 设置房间名、盲注、默认买入，生成6位房间号 |
| 房间列表实时刷新 | ✅ | watch 监听 + fallback 普通查询 |
| 加入房间（房间号） | ✅ | 输入6位房间号查找并加入 |
| 加入房间（扫码） | ✅ | 扫描小程序码直接进入房间 |
| 玩家管理 | ✅ | 添加玩家、滑动删除、买入/补充筹码 |
| 房间状态流转 | ✅ | waiting → active → settled → archived，乐观锁防冲突 |
| 单手牌记分（简单模式） | ✅ | 直接输入每人筹码变动，自动校验总和为零 |
| 单手牌记分（Side Pot） | ✅ | 输入下注额自动切分底池，逐池选赢家 |
| 筹码冲突检测 | ✅ | 多端同时操作时检测并提示筹码变动冲突 |
| 实时同步 | ✅ | 云数据库 watch + WebSocket，失败自动降级普通查询 |
| 牌局统计汇总 | ✅ | 按盈亏排名，显示总买入/最终筹码/盈亏 |
| 手牌历史记录 | ✅ | 查看每手牌的筹码变动和底池详情 |
| 历史牌局浏览 | ✅ | 按关键词/日期/盈亏筛选已结束的牌局 |
| 结算分享图 | ✅ | Canvas 2D 绘制结算卡片，保存到相册 |
| 小程序码生成 | ✅ | 云函数调用 wxacode.getUnlimited，存入云存储 |
| 个人中心 | ✅ | 登录状态、总场次、累计盈亏统计 |
| 过期房间清理 | ✅ | 云函数定时归档30天前已结算 / 24小时前等待中的房间 |
| 房间二维码展示 | ✅ | 房间详情页生成小程序码，van-popup 弹窗展示，支持保存到相册 |
| 庄家按钮与自动盲注 | ✅ | 玩家卡片显示 D/SB/BB 位置标签，庄家自动轮转，记分页自动预填盲注 |
| 多轮下注（Street-by-Street） | ✅ | Side Pot 模式支持翻前→翻牌→转牌→河牌四条街，弃牌功能，街道快照 |

## 4. 数据模型

### 4.1 rooms（房间/牌局）

```typescript
interface Room {
  _id: string              // 云数据库自动生成
  roomCode: string         // 6位数字房间号（用于手动加入）
  name: string             // 房间名称
  creatorId: string        // 创建者 openId
  smallBlind: number       // 小盲注
  bigBlind: number         // 大盲注
  buyIn: number            // 默认买入金额
  status: 'waiting' | 'active' | 'settled' | 'archived'
  playerIds: string[]      // 玩家 openId 列表
  dealerOpenId?: string    // 当前庄家的 openId（用于盲注自动分配和轮转）
  _version: number         // 乐观锁版本号
  createdAt: Date
  updatedAt: Date
}
```

### 4.2 players（玩家-房间关联）

```typescript
interface RoomPlayer {
  _id: string
  roomId: string
  openId: string
  nickname: string
  avatarUrl: string
  initialChips: number     // 初始筹码
  currentChips: number     // 当前筹码（实时更新）
  buyInCount: number       // 买入次数
  totalBuyIn: number       // 总买入金额
  isActive: boolean        // 是否还在牌局中（false = 已移除）
  createdAt: Date
}
```

### 4.3 rounds（每手牌记录）

```typescript
interface Round {
  _id: string
  roomId: string
  roundNumber: number
  changes: PlayerChipChange[]  // 每个玩家的筹码变动
  pots: Pot[]                  // 底池信息（含 side pot）
  timestamp: Date
  operatorId: string           // 记录操作者 openId
  streetBets?: {               // 多轮下注快照（可选，向后兼容）
    preflop: Record<string, number>   // openId -> 累计下注
    flop?: Record<string, number>
    turn?: Record<string, number>
    river?: Record<string, number>
  }
  dealerOpenId?: string        // 本手牌的庄家 openId
}

interface PlayerChipChange {
  playerId: string
  delta: number              // 筹码变动（正=赢，负=输）
}

interface Pot {
  amount: number
  eligible: string[]         // 有资格赢此池的玩家 ID
  winnerId: string           // 赢家 ID
}
```

### 4.4 buyins（买入记录）

```typescript
interface BuyInRecord {
  _id: string
  roomId: string
  playerId: string
  amount: number
  createdAt: Date
}
```

### 4.5 settlements（结算记录）

```typescript
interface Settlement {
  _id: string
  roomId: string
  results: PlayerResult[]
  pots: Pot[]
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

### 4.6 users（用户）

```typescript
interface User {
  _id: string
  openId: string
  unionId: string
  nickname: string
  avatarUrl: string
  createdAt: Date
  lastLoginAt: Date
}
```

## 5. 页面功能详解

### 5.1 首页 — 牌局列表（pages/index/index）

实时展示所有进行中和等待中的牌局，提供创建、加入入口。

**核心交互：**
- 点击「创建新牌局」→ 跳转创建页
- 点击房间卡片 → 进入房间详情
- 点击「输入房间号」→ 弹出输入框，输入6位房间号加入
- 点击「扫码加入」→ 调用 wx.scanCode 扫描小程序码

**使用示例：**
```
用户 A 打开小程序 → 首页显示空状态「还没有牌局，创建一个吧」
→ 点击「创建新牌局」→ 填写信息 → 创建成功
→ 返回首页，列表实时出现新房间卡片，显示「等待中」标签
→ 用户 B 打开小程序，同样看到该房间 → 点击进入
```

**实时同步机制：**
```typescript
// 监听 waiting/active 状态的房间，按更新时间倒序
watcher = db.collection('rooms')
  .where({ status: db.command.in(['waiting', 'active']) })
  .orderBy('updatedAt', 'desc')
  .watch({ onChange, onError: fallbackLoad })
```

### 5.2 创建房间（pages/room/create/create）

表单页面，设置牌局参数并创建房间。

**表单字段：**
| 字段 | 组件 | 默认值 | 说明 |
|------|------|--------|------|
| 房间名称 | van-field | — | 必填，如「周五德扑局」 |
| 小盲注 | van-stepper | 1 | 步进器调整 |
| 大盲注 | van-stepper | 2 | 步进器调整 |
| 默认买入 | van-stepper | 100 | 新玩家加入时的初始筹码 |

**使用示例：**
```
输入房间名「周五德扑局」→ 小盲 5 / 大盲 10 → 默认买入 200
→ 点击「创建房间」→ 系统生成6位房间号（如 382916）
→ 自动跳转到房间详情页，状态为「等待中」
```

### 5.3 房间详情/大厅（pages/room/detail/detail）

牌局的核心操作页面，管理玩家和游戏流程。

**房间状态流转：**
```
waiting（等待中）→ active（进行中）→ settled（已结算）→ archived（已归档）
```

**各状态下可用操作：**

| 状态 | 可用操作 |
|------|----------|
| waiting | 添加玩家、移除玩家、买入、开始游戏、复制房间号、二维码、分享 |
| active | 添加玩家、买入、设置庄家、记录手牌、查看手牌历史、结算、分享 |
| settled | 查看结果、生成分享图 |

**二维码功能：**
房间号旁的二维码图标点击后调用 getQRCode 云函数生成小程序码，在 van-popup 底部弹窗中展示。支持长按保存和「保存到相册」按钮。URL 缓存避免重复调用云函数。

**庄家按钮与位置标签：**
- 牌局进行中（active），每个玩家卡片旁显示可点击的 D 按钮用于指定庄家
- 指定庄家后自动计算并显示 D（庄家）、SB（小盲）、BB（大盲）位置标签
- 2人局（heads-up）：庄家 = 小盲，对手 = 大盲
- 3人及以上：庄家左手边 = 小盲，再左手边 = 大盲
- 点击「记录手牌」时自动将庄家轮转到下一位活跃玩家

**使用示例 — 完整牌局流程：**
```
1. 房主创建房间后进入详情页（waiting 状态）
2. 点击「添加玩家」→ 输入昵称和初始筹码 → 确认
3. 重复添加所有玩家（实时同步，其他人手机上也能看到）
4. 玩家列表左滑可移除玩家
5. 点击玩家的「买入」按钮 → 输入补充金额 → 确认
6. 人齐后点击「开始游戏」→ 状态变为 active
7. 每手牌结束后点击「记录手牌」→ 进入记分页
8. 所有手牌打完后点击「结算」→ 查看盈亏汇总
```

**乐观锁防冲突：**
```typescript
// 更新房间状态时携带版本号，防止多端同时操作
const ok = await updateRoomStatus(roomId, 'active', room._version)
if (!ok) {
  wx.showToast({ title: '操作冲突，请刷新重试', icon: 'none' })
}
```

### 5.4 添加玩家（pages/game/play/play）

简单表单，为房间添加新玩家。

**使用示例：**
```
输入昵称「小明」→ 初始筹码 200（默认取房间 buyIn 值）
→ 点击确认 → 创建 player 记录 + buyin 记录
→ 返回房间详情，玩家列表实时更新
```

### 5.5 单手牌记分（pages/game/round/round）

支持两种记分模式，通过顶部 Tab 切换。

**模式一：简单模式**
直接输入每个玩家的筹码变动值（正数=赢，负数=输）。

```
示例：4人局，小明赢了这手
- 小明: +150
- 小红: -50
- 小李: -60
- 小王: -40
系统校验：150 + (-50) + (-60) + (-40) = 0 ✅
点击确认 → 记录保存，各玩家 currentChips 更新
```

**模式二：Side Pot 模式**
输入每个玩家的下注额，系统自动计算底池分配。

```
示例：3人局，小明 all-in 50，小红下注 100，小李下注 100
系统自动切分：
  主池: 50 × 3 = 150（小明、小红、小李都有资格）
  边池: 50 × 2 = 100（仅小红、小李有资格）
→ 为每个池选择赢家
→ 主池赢家选「小明」→ 小明赢 150
→ 边池赢家选「小红」→ 小红赢 100
→ 系统计算最终变动：小明 +100, 小红 0, 小李 -100
```

**Side Pot 算法（前端本地计算）：**
```typescript
calcSidePots(bets: {playerId: string, amount: number}[]): Pot[] {
  // 1. 按下注额升序排列
  // 2. 逐层切分：每层 = (当前额 - 上层额) × 剩余有资格人数
  // 3. 返回 Pot 数组，每个 pot 记录金额和有资格的玩家
}
```

**冲突检测：**
记分页面会实时监听玩家筹码变化。如果在你记分期间，其他人也修改了筹码（如买入），页面顶部会显示黄色警告条：
```
⚠ 检测到筹码变动：小明 200→300，请确认后再提交
```

**模式三：多轮下注（Street-by-Street Betting）**
在 Side Pot 模式基础上增加四条街的逐步下注流程，更贴近真实德扑。

```
进入记分页 → Side Pot 模式
→ 翻前（Preflop）：自动填充大小盲注
→ 玩家加注/跟注 → 更新下注额
→ 有人弃牌 → 点击「弃牌」按钮（下注额锁定）
→ 点击「下一轮」→ 进入翻牌（Flop），下注额保留
→ 继续更新下注额...
→ 河牌结束 → 系统计算 Side Pot → 选择赢家 → 确认
```

核心特性：
- 街道指示器：顶部显示 翻前 → 翻牌 → 转牌 → 河牌 进度条
- 弃牌功能：弃牌后下注额锁定，不参与后续底池分配（eligible 列表排除弃牌玩家）
- 下注额累进：切换到下一轮时保留上一轮下注额，只能增加不能减少
- 街道快照：每轮切换时保存当前下注快照到 streetSnapshots，可回退查看
- 全员弃牌：所有人弃牌只剩一人时，该玩家自动赢得所有底池
- 盲注预填：如果设置了庄家，进入记分页时自动在翻前预填大小盲注金额

### 5.6 牌局统计汇总（pages/stats/summary/summary）

展示当前牌局所有玩家的盈亏排名。

**使用示例：**
```
进入汇总页 → 实时计算每人 profit = currentChips - totalBuyIn
→ 按盈亏从高到低排序显示：
  🥇 小明  买入 200  最终 450  盈利 +250
  🥈 小红  买入 200  最终 220  盈利 +20
  🥉 小李  买入 300  最终 180  亏损 -120
  4. 小王  买入 200  最终 50   亏损 -150
→ 点击「生成分享图」→ 跳转分享页
→ 点击「结束牌局」→ 房间状态变为 settled
```

### 5.7 手牌历史（pages/stats/rounds/rounds）

查看当前牌局所有已记录的手牌详情。

**使用示例：**
```
进入手牌历史 → 按时间倒序显示：
  第3手 21:30
    小明 +80  小红 -30  小李 -50
    底池: 160
  第2手 21:15
    小明 -40  小红 +100  小李 -60
    主池: 120  边池: 80
  第1手 21:00
    ...
```

### 5.8 历史牌局（pages/stats/history/history）

浏览所有已结束的牌局，支持多维度筛选。

**筛选条件：**
| 筛选项 | 说明 |
|--------|------|
| 搜索框 | 按房间名或房间号模糊搜索 |
| 日期筛选 | 今天 / 本周 / 本月 / 全部 |
| 盈亏筛选 | 全部 / 仅盈利 / 仅亏损 |

**使用示例：**
```
进入历史页 → 显示所有已结算/已归档的牌局
→ 搜索「周五」→ 筛选出所有名称含「周五」的牌局
→ 选择「仅盈利」→ 只显示自己盈利的牌局
→ 每个卡片显示：房间名、日期、玩家数、个人盈亏
```

### 5.9 结算分享图（pages/settlement/share/share）

使用 Canvas 2D 绘制结算卡片，支持保存和分享。

**绘制内容：**
- 标题区：房间名 + 盲注信息
- 玩家表格：排名、昵称、买入、最终筹码、盈亏（盈利绿色/亏损红色）
- 小程序码：扫码可直接进入房间
- 底部：生成时间

**使用示例：**
```
进入分享页 → 自动调用云函数获取结算数据和小程序码
→ Canvas 绘制完成后显示预览
→ 点击「保存到相册」→ 授权后保存为图片
→ 可发送到微信群或朋友圈
```

### 5.10 个人中心（pages/profile/profile）

用户登录状态管理和个人战绩统计。

**使用示例：**
```
未登录状态 → 显示默认头像 + 「点击登录」按钮
→ 点击登录 → 弹出微信授权 → 获取头像昵称
→ 显示个人信息 + 统计数据：
  总场次: 12
  累计盈亏: +580
→ 点击「退出登录」→ 清除本地缓存
```

## 6. 云函数详解

### 6.1 login — 用户登录

```
触发：App.onLaunch 时自动调用
输入：无（通过 wx.cloud.getWXContext 获取 openId）
输出：{ openId, unionId }
逻辑：
  1. 获取 openId
  2. 查询 users 集合是否已有记录
  3. 无记录 → 创建新用户
  4. 有记录 → 更新 lastLoginAt
```

### 6.2 settle — Side Pot 结算

```
触发：前端调用（备用，当前前端本地计算）
输入：{ roomId, playerBets: [{playerId, betAmount}], winners: [playerId] }
输出：{ settlementId, changes: {playerId: delta}, pots }
逻辑：
  1. 按下注额升序排列玩家
  2. 逐层切分底池
  3. 校验赢家是否有资格赢取对应底池
  4. 计算每人净变动 = 赢得金额 - 下注金额
  5. 写入 settlements 集合
```

### 6.3 genShareImage — 生成分享数据

```
触发：进入分享页时调用
输入：{ roomId }
输出：{ room: {name, smallBlind, bigBlind}, results: [{nickname, totalBuyIn, finalChips, profit}], generatedAt }
逻辑：
  1. 查询房间信息
  2. 查询所有活跃玩家
  3. 计算每人盈亏并按盈利排序
  4. 返回结构化数据供前端 Canvas 绘制
```

### 6.4 getQRCode — 生成小程序码

```
触发：分享页绘制时调用
输入：{ roomId }
输出：{ fileID }（云存储文件 ID）
逻辑：
  1. 调用 wxacode.getUnlimited，scene 为 roomId（≤32字符）
  2. 将生成的图片 buffer 上传到云存储 qrcodes/ 目录
  3. 返回 fileID
注意：scene 参数最长32字符，直接传 roomId 不加前缀
```

### 6.5 cleanExpired — 定时清理

```
触发：定时触发器（建议每天凌晨执行）
逻辑：
  1. 将30天前 status=settled 的房间改为 archived
  2. 将24小时前 status=waiting 的房间改为 archived
```

## 7. 实时同步方案

### 7.1 Watch 监听 + Fallback 降级

每个需要实时数据的页面都采用 watch + fallback 双保险：

```typescript
// sync.ts 统一管理
export function watchPlayers(roomId, onChange, onError) {
  return db().collection('players')
    .where({ roomId })
    .watch({
      onChange(snapshot) { onChange(snapshot) },
      onError(err) {
        console.error('[sync] player watch error', err)
        onError?.(err)  // 触发 fallback 普通查询
      },
    })
}
```

### 7.2 登录就绪等待

页面在启动 watch 前等待登录完成，避免 WebSocket 认证失败：

```typescript
// app.ts
this.globalData.loginReady = ensureLogin()

// 各页面 onShow
async onShow() {
  await getApp().globalData.loginReady
  this._startWatch()
}
```

### 7.3 Watcher 生命周期管理

```typescript
// 页面显示时启动，隐藏/卸载时关闭
onShow()   → startWatch()
onHide()   → closeWatcher()
onUnload() → closeWatcher()
```

## 8. 状态管理

### MobX User Store

```typescript
// store/user.ts
class UserStore {
  openId = ''
  nickname = ''
  avatarUrl = ''
  logged = false

  setUser(info)   // 更新用户信息 + 持久化到 localStorage
  restore()       // 从 localStorage 恢复登录态
  logout()        // 清除所有用户数据
}
```

页面通过 `getApp().globalData.userStore` 访问，或使用 `mobx-miniprogram-bindings` 绑定到页面 data。

## 9. 项目配置

### 9.1 project.config.json 关键配置

```json
{
  "miniprogramRoot": "miniprogram/",
  "cloudfunctionRoot": "cloudfunctions/",
  "appid": "wx701fa763b504ded1",
  "setting": {
    "useCompilerPlugins": ["typescript"]
  }
}
```

### 9.2 云开发环境

```
环境 ID: cloud1-4gm99qrd8397ea37
```

### 9.3 数据库集合（需手动创建）

在云开发控制台 → 数据库中创建以下集合：
`rooms`、`players`、`rounds`、`buyins`、`users`、`settlements`

### 9.4 导航结构（app.json）

```
TabBar:
  牌局 → pages/index/index
  历史 → pages/stats/history/history
  我的 → pages/profile/profile

子页面:
  pages/room/create/create      创建房间
  pages/room/detail/detail      房间详情
  pages/game/play/play          添加玩家
  pages/game/round/round        记录手牌
  pages/stats/summary/summary   统计汇总
  pages/stats/rounds/rounds     手牌历史
  pages/settlement/share/share  分享图生成
```

## 10. 典型使用流程

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  创建房间 │────→│ 添加玩家 │────→│ 开始游戏 │
└─────────┘     └─────────┘     └────┬────┘
                                     │
                              ┌──────▼──────┐
                              │  记录每手牌   │◄──── 循环
                              │ (简单/Side Pot)│
                              └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │  查看统计汇总  │
                              └──────┬──────┘
                                     │
                         ┌───────────┼───────────┐
                         ▼           ▼           ▼
                    结束牌局    生成分享图    查看手牌历史
```
