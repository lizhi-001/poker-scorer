/**
 * 实时同步工具 - 云数据库 watch 管理
 * 统一管理 watcher 生命周期、错误恢复、冲突检测
 */

type WatchCallback = (snapshot: any) => void
type ErrorCallback = (err: any) => void

interface WatcherHandle {
  close: () => void
}

const db = () => wx.cloud.database()

/** 监听房间状态变更 */
export function watchRoom(
  roomId: string,
  onChange: WatchCallback,
  onError?: ErrorCallback,
): WatcherHandle {
  return db().collection('rooms')
    .where({ _id: roomId })
    .watch({
      onChange(snapshot: any) {
        if (snapshot.docs?.length) onChange(snapshot)
      },
      onError(err: any) {
        console.error('[sync] room watch error', err)
        onError?.(err)
      },
    })
}

/** 监听房间内玩家变化（含筹码） */
export function watchPlayers(
  roomId: string,
  onChange: WatchCallback,
  onError?: ErrorCallback,
): WatcherHandle {
  return db().collection('players')
    .where({ roomId })
    .watch({
      onChange(snapshot: any) {
        onChange(snapshot)
      },
      onError(err: any) {
        console.error('[sync] player watch error', err)
        onError?.(err)
      },
    })
}

/**
 * 冲突检测：比较玩家筹码快照
 * 返回有变化的玩家列表
 */
export function detectChipConflicts(
  oldPlayers: any[],
  newPlayers: any[],
): Array<{ id: string; nickname: string; oldChips: number; newChips: number }> {
  const conflicts: Array<{ id: string; nickname: string; oldChips: number; newChips: number }> = []
  const oldMap = new Map(oldPlayers.map(p => [p._id, p]))
  for (const np of newPlayers) {
    const op = oldMap.get(np._id)
    if (op && op.currentChips !== np.currentChips) {
      conflicts.push({
        id: np._id,
        nickname: np.nickname,
        oldChips: op.currentChips,
        newChips: np.currentChips,
      })
    }
  }
  return conflicts
}

/**
 * 带版本号的房间状态更新（乐观锁）
 * 防止多端同时修改房间状态
 */
export async function updateRoomStatus(
  roomId: string,
  newStatus: string,
  expectedVersion?: number,
): Promise<boolean> {
  const d = db()
  const cmd = d.command
  const updateData: any = {
    status: newStatus,
    updatedAt: d.serverDate(),
    _version: cmd.inc(1),
  }
  const where: any = { _id: roomId }
  if (expectedVersion !== undefined) {
    where._version = expectedVersion
  }
  const { stats } = await d.collection('rooms')
    .where(where)
    .update({ data: updateData })
  return (stats?.updated ?? 0) > 0
}

/** 安全关闭 watcher */
export function closeWatcher(watcher: WatcherHandle | null): null {
  if (watcher) {
    try { watcher.close() } catch (_) {}
  }
  return null
}
