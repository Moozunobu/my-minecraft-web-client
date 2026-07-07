'use strict'
import { Vec3 } from 'vec3'
import { PerlinNoise2D } from './perlinNoise'

export default function generation({ version, seed = '12345', worldHeight = 256, minY = 0 } = {}) {
  const Chunk = require('prismarine-chunk')(version)
  const mcData = require('minecraft-data')(version)
  const theFlattening = mcData.supportFeature('blockStateId')

  const numericSeed = typeof seed === 'string'
    ? seed.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)
    : (seed | 0)

  // 高速化のため、使うノイズを3つに絞ります
  const continentNoise = new PerlinNoise2D(numericSeed)
  const mountainNoise = new PerlinNoise2D(numericSeed + 1)
  const biomeNoise = new PerlinNoise2D(numericSeed + 2)

  const SEA_LEVEL = 64
  const BASE_HEIGHT = 60
  const MOUNTAIN_SCALE = 90 // 少し高くして迫力を出します

  function getSurfaceHeight(wx, wz) {
    // オクターブを 2 にして計算量を大幅カット。これで描画距離を伸ばしても動きやすくなります。
    const continent = continentNoise.fbm(wx, wz, { octaves: 2, frequency: 0.001 })
    const mountain = mountainNoise.fbm(wx, wz, { octaves: 2, frequency: 0.004 })

    // 大陸の形（0.4以上なら陸地、それ以下なら海）
    const landFactor = Math.max(0, (continent - 0.4) / 0.6)
    // 山の高さ。pow(mountain, 2) で鋭い山脈にします
    const mountainContribution = Math.pow(mountain, 2) * MOUNTAIN_SCALE
    
    const rawHeight = BASE_HEIGHT + (landFactor * mountainContribution)
    return Math.max(minY + 1, Math.min(Math.floor(rawHeight), worldHeight - 2))
  }

  function getBiome(wx, wz, surfaceHeight) {
    const biome = biomeNoise.fbm(wx, wz, { octaves: 1, frequency: 0.001 })
    if (surfaceHeight < SEA_LEVEL - 2) return 'ocean'
    if (surfaceHeight > 130) return 'mountains'
    if (biome > 0.7) return 'desert'
    return 'plains'
  }

  return function generateSimpleChunk(chunkX, chunkZ) {
    const chunk = new Chunk({ minY, worldHeight })
    const b = mcData.blocksByName

    for (let lx = 0; lx < 16; lx++) {
      for (let lz = 0; lz < 16; lz++) {
        const wx = chunkX * 16 + lx
        const wz = chunkZ * 16 + lz
        const h = getSurfaceHeight(wx, wz)
        const bio = getBiome(wx, wz, h)

        // 岩盤・石・土・水の配置（シンプルにして高速化）
        for (let ly = minY; ly <= minY + 2; ly++) setBlock(chunk, new Vec3(lx, ly, lz), b.bedrock, theFlattening)
        for (let ly = minY + 3; ly < h - 3; ly++) setBlock(chunk, new Vec3(lx, ly, lz), b.stone, theFlattening)

        const vSurface = new Vec3(lx, h, lz)
        if (h < SEA_LEVEL) {
          setBlock(chunk, vSurface, b.sand, theFlattening)
          for (let ly = h + 1; ly <= SEA_LEVEL; ly++) setBlock(chunk, new Vec3(lx, ly, lz), b.water, theFlattening)
        } else if (bio === 'mountains') {
          setBlock(chunk, vSurface, h > 150 ? b.snow_block : b.stone, theFlattening)
        } else if (bio === 'desert') {
          setBlock(chunk, vSurface, b.sand, theFlattening)
        } else {
          setBlock(chunk, vSurface, b.grass_block, theFlattening)
          setBlock(chunk, new Vec3(lx, h - 1, lz), b.dirt, theFlattening)
        }
      }
    }
    return chunk
  }
}

function setBlock(chunk, vec, block, theFlattening) {
  if (!block) return
  if (theFlattening) chunk.setBlockStateId(vec, block.defaultState ?? block.minStateId ?? 0)
  else chunk.setBlockType(vec, block.id)
}