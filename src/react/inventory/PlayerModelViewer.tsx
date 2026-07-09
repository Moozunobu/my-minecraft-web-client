import { useEffect, useState } from 'react'
import { subscribeKey } from 'valtio/utils'
import { loadSkinFromUsername } from 'minecraft-renderer/src/lib/utils/skins'
import { PlayerModelCanvas } from '../OverlayModelViewer'

/**
 * Thin wrapper around PlayerModelCanvas that handles skin resolution:
 * 1. Uses appViewer.playerState.reactive.playerSkin when available (reactive, updates on change)
 * 2. Falls back to loadSkinFromUsername(bot.username) when no local skin is set
 */
export function PlayerModelViewer ({ width, height }: { width: number; height: number }) {
  // スキンURLを空文字に固定し、デフォルトのスティーブを強制する
  const [skinUrl, setSkinUrl] = useState<string>('')

  useEffect(() => {
    // カスタムスキンの読み込みを無効化
    return () => {}
  }, [])

  return <PlayerModelCanvas width={width} height={height} skinUrl={skinUrl} followCursor />
}
