'use strict'
import { Vec3 } from 'vec3'
import { PerlinNoise2D } from './perlinNoise.js'

export default function generation({ version, seed = '12345', worldHeight = 256, minY = 0 } = {}) {
  const Chunk = require('prismarine-chunk')(version)
  const mcData = require('minecraft-data')(version)
  const theFlattening = mcData.supportFeature('blockStateId')

  const numericSeed = typeof seed === 'string'
    ? seed.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)
    : (seed | 0)

  // ノイズジェネレーター群
  const macroContinentNoise = new PerlinNoise2D(numericSeed)
  const continentNoise = new PerlinNoise2D(numericSeed + 1)
  const erosionNoise = new PerlinNoise2D(numericSeed + 2)
  const peaksNoise = new PerlinNoise2D(numericSeed + 3)
  const tempNoise = new PerlinNoise2D(numericSeed + 4)
  const humidityNoise = new PerlinNoise2D(numericSeed + 5)
  const weirdnessNoise = new PerlinNoise2D(numericSeed + 6)
  const riverNoise = new PerlinNoise2D(numericSeed + 7)

  const SEA_LEVEL = 64

  // 決定論的Hash乱数
  function hashRandom(x, z) {
    const sin = Math.sin(x * 12.9898 + z * 78.233)
    return Math.abs(sin * 43758.5453) % 1
  }

  // --- 地形高度計算 (現実的な高度変化・山脈・川) ---
  function getSurfaceHeight(wx, wz) {
    const macroContinent = macroContinentNoise.fbm(wx, wz, { octaves: 2, frequency: 0.0004 })
    const continent = continentNoise.fbm(wx, wz, { octaves: 4, frequency: 0.0015 })
    const erosion = erosionNoise.fbm(wx, wz, { octaves: 4, frequency: 0.002 })
    const peaks = peaksNoise.fbm(wx, wz, { octaves: 5, frequency: 0.004 })

    const combinedContinent = macroContinent * 0.75 + continent * 0.25

    // 基本高度の設定 (海面64前後)
    let baseHeight = SEA_LEVEL - 40 + (combinedContinent * 120)

    // 侵食による平坦化
    const erosionFactor = Math.max(0, erosion - 0.35) * 1.8
    baseHeight -= erosionFactor * 18

    // 険しい山脈 (大陸深部 & 低侵食)
    if (erosion < 0.55 && combinedContinent > 0.48) {
      const mountainFactor = Math.pow(peaks, 3) * (1.0 - (erosion / 0.55))
      const continentScale = Math.min(1.0, (combinedContinent - 0.48) * 6.0)
      baseHeight += mountainFactor * 160 * continentScale
    }

    // 川の削り込み
    const riverRaw = Math.abs(riverNoise.fbm(wx, wz, { octaves: 3, frequency: 0.0018 }))
    if (combinedContinent > 0.42 && riverRaw < 0.04) {
      const riverDepth = (1.0 - (riverRaw / 0.04)) * 14
      baseHeight -= riverDepth
    }

    const detail = peaksNoise.noise(wx * 0.06, wz * 0.06) * 2.5
    return Math.max(minY + 2, Math.min(Math.floor(baseHeight + detail), worldHeight - 3))
  }

  // --- バイオーム判定 (多次元ノイズ) ---
  function getBiome(wx, wz, h) {
    const macroContinent = macroContinentNoise.fbm(wx, wz, { octaves: 2, frequency: 0.0004 })
    const continent = continentNoise.fbm(wx, wz, { octaves: 4, frequency: 0.0015 })
    const combinedContinent = macroContinent * 0.75 + continent * 0.25

    const temp = tempNoise.fbm(wx, wz, { octaves: 3, frequency: 0.0012 })
    const hum = humidityNoise.fbm(wx, wz, { octaves: 3, frequency: 0.0012 })
    const weird = weirdnessNoise.fbm(wx, wz, { octaves: 3, frequency: 0.002 })
    const riverVal = Math.abs(riverNoise.fbm(wx, wz, { octaves: 3, frequency: 0.0018 }))

    // 海洋バイオーム
    if (h < SEA_LEVEL - 2) {
      if (temp < 0.25) return 'frozen_ocean'
      if (temp > 0.75) return 'warm_ocean'
      return 'ocean'
    }

    // 海岸線
    if (h <= SEA_LEVEL + 1 && combinedContinent <= 0.44) {
      if (temp < 0.25) return 'frozen_ocean'
      return 'beach'
    }

    // 河川
    if (combinedContinent > 0.44 && riverVal < 0.04 && h <= SEA_LEVEL + 3) {
      if (temp < 0.25) return 'frozen_river'
      return 'river'
    }

    // 稀なバイオーム：キノコ島 (大陸から隔離された島)
    if (combinedContinent > 0.38 && combinedContinent < 0.44 && weird > 0.75) {
      return 'mushroom_fields'
    }

    // 山岳
    if (h > 115) {
      if (temp < 0.3) return 'snowy_plains'
      if (weird > 0.5) return 'windswept_hills'
      return 'mountains'
    }

    // 乾燥・温帯・寒帯の分類
    // 1. 乾燥帯
    if (temp > 0.68) {
      if (hum < 0.35) {
        if (weird > 0.4) return 'badlands' // メサ
        return 'desert'
      }
      if (hum < 0.6) return 'savanna'
      return 'jungle'
    }

    // 2. 寒帯・冷帯
    if (temp < 0.32) {
      if (hum > 0.6 && weird > 0.4) return 'giant_tree_taiga'
      if (hum > 0.38) return 'taiga'
      return 'snowy_plains'
    }

    // 3. 温暖帯
    if (hum > 0.68) {
      if (weird > 0.5) return 'swamp'
      return 'jungle'
    }
    if (hum > 0.48) {
      if (weird > 0.6) return 'flower_forest'
      return 'forest'
    }

    // 平原系
    if (weird > 0.65) return 'sunflower_plains'
    return 'plains'
  }

  function setBlockSafe(chunk, vec, block, theFlattening) {
    if (!block) return
    if (vec.x < 0 || vec.x > 15 || vec.z < 0 || vec.z > 15) return
    if (vec.y < minY || vec.y >= worldHeight) return
    setBlock(chunk, vec, block, theFlattening)
  }

  // --- 樹木・構造物生成 ---
  function generateTree(chunk, lx, ly, lz, b, type) {
    const r = hashRandom(lx, lz)
    let height = 5 + Math.floor(r * 3)
    let logBlock = b.oak_log || b.log
    let leavesBlock = b.oak_leaves || b.leaves

    if (type === 'spruce') {
      height = 6 + Math.floor(r * 4)
      logBlock = b.spruce_log || b.log
      leavesBlock = b.spruce_leaves || b.leaves
    } else if (type === 'mega_spruce') {
      height = 12 + Math.floor(r * 6)
      logBlock = b.spruce_log || b.log
      leavesBlock = b.spruce_leaves || b.leaves
    } else if (type === 'acacia') {
      height = 5 + Math.floor(r * 3)
      logBlock = b.acacia_log || b.log
      leavesBlock = b.acacia_leaves || b.leaves
    } else if (type === 'jungle') {
      height = 8 + Math.floor(r * 6)
      logBlock = b.jungle_log || b.log
      leavesBlock = b.jungle_leaves || b.leaves
    } else if (type === 'birch') {
      height = 5 + Math.floor(r * 3)
      logBlock = b.birch_log || b.log
      leavesBlock = b.birch_leaves || b.leaves
    }

    const radius = type === 'mega_spruce' ? 3 : 2

    if (lx < radius || lx >= 16 - radius || lz < radius || lz >= 16 - radius) return
    if (ly + height + 3 >= worldHeight) return

    // 幹
    for (let i = 0; i < height; i++) {
      setBlockSafe(chunk, new Vec3(lx, ly + i, lz), logBlock, theFlattening)
      if (type === 'mega_spruce') {
        setBlockSafe(chunk, new Vec3(lx + 1, ly + i, lz), logBlock, theFlattening)
        setBlockSafe(chunk, new Vec3(lx, ly + i, lz + 1), logBlock, theFlattening)
        setBlockSafe(chunk, new Vec3(lx + 1, ly + i, lz + 1), logBlock, theFlattening)
      }
    }

    // 葉
    if (type === 'spruce' || type === 'mega_spruce') {
      const topY = ly + height
      for (let y = ly + 3; y <= topY + 1; y++) {
        const rad = (y % 2 === 0) ? (type === 'mega_spruce' ? 3 : 2) : 1
        for (let x = -rad; x <= rad; x++) {
          for (let z = -rad; z <= rad; z++) {
            if (x === 0 && z === 0 && y < topY) continue
            if (Math.abs(x) === rad && Math.abs(z) === rad && rad > 1) continue
            setBlockSafe(chunk, new Vec3(lx + x, y, lz + z), leavesBlock, theFlattening)
          }
        }
      }
    } else {
      for (let y = ly + height - 2; y <= ly + height + 1; y++) {
        const isTop = y >= ly + height
        const rad = isTop ? 1 : 2
        for (let x = -rad; x <= rad; x++) {
          for (let z = -rad; z <= rad; z++) {
            if (x === 0 && z === 0 && y < ly + height) continue
            if (Math.abs(x) === rad && Math.abs(z) === rad && rad > 1) continue
            setBlockSafe(chunk, new Vec3(lx + x, y, lz + z), leavesBlock, theFlattening)
          }
        }
      }
    }
  }

  // 巨大キノコ生成 (赤 / 茶)
  function generateMushroom(chunk, lx, ly, lz, b, isRed) {
    if (lx < 2 || lx >= 14 || lz < 2 || lz >= 14 || ly + 6 >= worldHeight) return
    const stemBlock = b.mushroom_stem || b.quartz_block || b.white_wool || b.dirt
    const capBlock = isRed ? (b.red_mushroom_block || b.red_wool) : (b.brown_mushroom_block || b.brown_wool)

    // 傘の幹
    for (let i = 0; i < 5; i++) {
      setBlockSafe(chunk, new Vec3(lx, ly + i, lz), stemBlock, theFlattening)
    }

    // 傘の帽子
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        if (Math.abs(x) === 2 && Math.abs(z) === 2) continue
        setBlockSafe(chunk, new Vec3(lx + x, ly + 4, lz + z), capBlock, theFlattening)
        if (isRed) {
          setBlockSafe(chunk, new Vec3(lx + x, ly + 3, lz + z), capBlock, theFlattening)
        }
      }
    }
  }

  // サボテン生成
  function generateCactus(chunk, lx, ly, lz, b) {
    if (ly + 3 >= worldHeight) return
    const cactusBlock = b.cactus || b.green_wool
    const h = 2 + Math.floor(hashRandom(lx, lz) * 2)
    for (let i = 0; i < h; i++) {
      setBlockSafe(chunk, new Vec3(lx, ly + i, lz), cactusBlock, theFlattening)
    }
  }

  return function generateChunk(chunkX, chunkZ) {
    try {
      const chunk = new Chunk({ minY, worldHeight })
      const b = mcData.blocksByName

      const decorations = []

      for (let lx = 0; lx < 16; lx++) {
        for (let lz = 0; lz < 16; lz++) {
          const wx = chunkX * 16 + lx
          const wz = chunkZ * 16 + lz
          const h = getSurfaceHeight(wx, wz)
          const bio = getBiome(wx, wz, h)

          // 最下層：岩盤 (Bedrock)
          for (let ly = minY; ly <= minY + 2; ly++) {
            setBlock(chunk, new Vec3(lx, ly, lz), b.bedrock, theFlattening)
          }

          // 地中：石層 (Stone / Terracotta)
          const depth = (bio === 'desert' || bio === 'beach' || bio === 'badlands') ? 5 : 3
          for (let ly = minY + 3; ly < h - depth; ly++) {
            if (bio === 'badlands') {
              // メサ特有の地層（Terracotta層）
              const layer = (ly + Math.floor(wx * 0.05)) % 12
              if (layer === 0 || layer === 1) setBlock(chunk, new Vec3(lx, ly, lz), b.terracotta || b.hardened_clay || b.stained_hardened_clay || b.stone, theFlattening)
              else if (layer === 3 || layer === 4) setBlock(chunk, new Vec3(lx, ly, lz), b.orange_terracotta || b.stained_hardened_clay || b.stone, theFlattening)
              else if (layer === 7) setBlock(chunk, new Vec3(lx, ly, lz), b.yellow_terracotta || b.stained_hardened_clay || b.stone, theFlattening)
              else if (layer === 9 || layer === 10) setBlock(chunk, new Vec3(lx, ly, lz), b.red_terracotta || b.stained_hardened_clay || b.stone, theFlattening)
              else setBlock(chunk, new Vec3(lx, ly, lz), b.terracotta || b.stone, theFlattening)
            } else {
              setBlock(chunk, new Vec3(lx, ly, lz), b.stone, theFlattening)
            }
          }

          // 地表直下層
          for (let ly = Math.max(minY + 3, h - depth); ly < h; ly++) {
            if (bio === 'desert' || bio === 'beach' || bio === 'warm_ocean') {
              setBlock(chunk, new Vec3(lx, ly, lz), b.sand, theFlattening)
            } else if (bio === 'badlands') {
              setBlock(chunk, new Vec3(lx, ly, lz), b.red_sand || b.sand || b.terracotta || b.dirt, theFlattening)
            } else if (bio === 'mushroom_fields') {
              setBlock(chunk, new Vec3(lx, ly, lz), b.dirt, theFlattening)
            } else if (bio === 'giant_tree_taiga') {
              setBlock(chunk, new Vec3(lx, ly, lz), b.dirt, theFlattening)
            } else if (bio === 'windswept_hills') {
              setBlock(chunk, new Vec3(lx, ly, lz), (hashRandom(wx, wz) > 0.5 ? b.gravel : b.dirt) || b.dirt, theFlattening)
            } else {
              setBlock(chunk, new Vec3(lx, ly, lz), b.dirt, theFlattening)
            }
          }

          const vSurface = new Vec3(lx, h, lz)

          // --- 水域処理（水・氷） ---
          if (h < SEA_LEVEL) {
            const bottomBlock = (bio === 'warm_ocean' || bio === 'ocean' || bio === 'beach') ? (b.sand || b.dirt) : b.dirt
            setBlock(chunk, vSurface, bottomBlock, theFlattening)

            for (let ly = h + 1; ly <= SEA_LEVEL; ly++) {
              if ((bio === 'frozen_ocean' || bio === 'frozen_river') && ly === SEA_LEVEL) {
                setBlock(chunk, new Vec3(lx, ly, lz), b.ice || b.packed_ice || b.water, theFlattening)
              } else {
                setBlock(chunk, new Vec3(lx, ly, lz), b.water, theFlattening)
              }
            }
          }
          // --- 陸地表面処理 ---
          else if (bio === 'desert' || bio === 'beach') {
            setBlock(chunk, vSurface, b.sand, theFlattening)
          } else if (bio === 'badlands') {
            setBlock(chunk, vSurface, b.red_sand || b.sand || b.terracotta, theFlattening)
          } else if (bio === 'mushroom_fields') {
            setBlock(chunk, vSurface, b.mycelium || b.dirt, theFlattening)
          } else if (bio === 'giant_tree_taiga') {
            setBlock(chunk, vSurface, b.podzol || b.coarse_dirt || b.grass_block || b.dirt, theFlattening)
          } else if (bio === 'snowy_plains') {
            setBlock(chunk, vSurface, b.snow_block || b.grass_block || b.dirt, theFlattening)
          } else if (bio === 'windswept_hills') {

    // 構造物・樹木の配置実行
    for (const dec of decorations) {
      if (dec.type === 'tree') {
        generateTree(chunk, dec.x, dec.y, dec.z, b, dec.treeType)
      } else if (dec.type === 'mushroom') {
        generateMushroom(chunk, dec.x, dec.y, dec.z, b, dec.isRed)
      } else if (dec.type === 'cactus') {
        generateCactus(chunk, dec.x, dec.y, dec.z, b)
      }
    }

    return chunk
  } catch (e) {
    console.error('mountainWorldGen chunk generation crashed!', e)
    throw e
  }
  }
}

function setBlock(chunk, vec, block, theFlattening) {
  if (!block) return
  if (theFlattening) {
    chunk.setBlockStateId(vec, block.defaultState ?? block.minStateId ?? 0)
  } else {
    chunk.setBlockType(vec, block.id)
    chunk.setBlockData(vec, 0)
  }
}