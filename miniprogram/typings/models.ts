/** 房间/牌局 */
export interface Room {
  _id: string
  roomCode: string
  name: string
  creatorId: string
  smallBlind: number
  bigBlind: number
  buyIn: number
  status: 'waiting' | 'active' | 'settled' | 'archived'
  playerIds: string[]
  createdAt: Date
  updatedAt: Date
}

/** 房间内玩家 */
export interface RoomPlayer {
  _id: string
  roomId: string
  openId: string
  nickname: string
  avatarUrl: string
  initialChips: number
  currentChips: number
  buyInCount: number
  totalBuyIn: number
  isActive: boolean
}

/** 每手牌记录 */
export interface Round {
  _id: string
  roomId: string
  roundNumber: number
  changes: PlayerChipChange[]
  pots: Pot[]
  timestamp: Date
  operatorId: string
}

/** 玩家筹码变动 */
export interface PlayerChipChange {
  openId: string
  delta: number
}

/** 底池（含 side pot） */
export interface Pot {
  amount: number
  eligible: string[]
  winnerId: string
}

/** 结算记录 */
export interface Settlement {
  _id: string
  roomId: string
  results: PlayerResult[]
  shareImageUrl: string
  qrCodeUrl: string
  settledAt: Date
}

/** 玩家结算结果 */
export interface PlayerResult {
  openId: string
  nickname: string
  totalBuyIn: number
  finalChips: number
  profit: number
}

/** 用户 */
export interface User {
  _id: string
  openId: string
  unionId: string
  nickname: string
  avatarUrl: string
  createdAt: Date
  lastLoginAt: Date
}

/** 买入记录 */
export interface BuyInRecord {
  _id: string
  roomId: string
  playerId: string
  amount: number
  createdAt: Date
}

/** Side Pot 计算输入 */
export interface PlayerBet {
  playerId: string
  betAmount: number
}

/** 云函数 settle 请求参数 */
export interface SettleRequest {
  roomId: string
  playerBets: PlayerBet[]
  winners: string[]
}

/** 云函数 settle 返回结果 */
export interface SettleResponse {
  settlementId: string
  changes: Record<string, number>
  pots: Pot[]
}
