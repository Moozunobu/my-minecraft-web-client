import mountainGen from './terrainGenerator/mountainWorldGen'
import flyingSquidGenerations from 'flying-squid/dist/lib/generations'

try {
  flyingSquidGenerations['mountain'] = mountainGen
} catch (e) {}

export const defaultLocalServerOptions = {
  'version': '1.16.1',
  'motd': 'Mountain World',
  'port': 25565,
  'max-players': 10,
  'online-mode': false,
  'generation': {
    'name': 'mountain',
    'options': { 'worldHeight': 256, 'seed': '12345' }
  },
  'kickTimeout': 300000, // 修正：10秒から60秒に延ばす（かなり重要）
  'view-distance': 6,    // 修正：負荷を減らすため 3 から 2 に下げる
  'everybody-op': true,
  'max-entities': 50,
  'keepAlive': false    // 追加：タイムアウト判定を甘くする
}

export default defaultLocalServerOptions