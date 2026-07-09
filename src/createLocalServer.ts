import { LocalServer } from './customServer'

const { createMCServer } = require('flying-squid/dist')

export const startLocalServer = (serverOptions) => {
  const passOptions = { ...serverOptions, Server: LocalServer }
  const server: NonNullable<typeof localServer> = createMCServer(passOptions)
  server.formatMessage = (message) => `[server] ${message}`
  server.options = passOptions
  //@ts-expect-error todo remove
  server.looseProtocolMode = true

  // サバイバルモードでもクラフト結果を受け取るために、クリエイティブ用のスロット変更パケットを許可するハック
  server.on('playerJoin', (player: any) => {
    player._client.on('set_creative_slot', ({ slot, item }: any) => {
      // gameMode === 1 (Creative) は flying-squid 本体が処理するため、それ以外を処理する
      if (player.gameMode !== 1) {
        const Item = require('prismarine-item')(server.version)
        player.inventory.updateSlot(slot, item ? Item.fromNotch(item) : null)
      }
    })
  })

  return server
}

// features that flying-squid doesn't support at all
// todo move & generate in flying-squid
export const unsupportedLocalServerFeatures = ['transactionPacketExists', 'teleportUsesOwnPacket']
