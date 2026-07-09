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

  const continentNoise = new PerlinNoise2D(numericSeed)
  const erosionNoise = new PerlinNoise2D(numericSeed + 1)
  const peaksNoise = new PerlinNoise2D(numericSeed + 2)
  const tempNoise = new PerlinNoise2D(numericSeed + 3)
  const humidityNoise = new PerlinNoise2D(numericSeed + 4)
  const vegetationNoise = new PerlinNoise2D(numericSeed + 5)

  const SEA_LEVEL = 64

  // チャンク一貫性のある簡易乱数
  function hashRandom(x, z) {
    const sin = Math.sin(x * 12.9898 + z * 78.233);
    return Math.abs(sin * 43758.5453) % 1;
  }

  function getSurfaceHeight(wx, wz) {
    const continent = continentNoise.fbm(wx, wz, { octaves: 4, frequency: 0.0015 })
    const erosion = erosionNoise.fbm(wx, wz, { octaves: 4, frequency: 0.002 })
    const peaks = peaksNoise.fbm(wx, wz, { octaves: 4, frequency: 0.005 })

    // 海の範囲を広げる: continentが低いと深く沈む
    // continent が 0.5 付近で陸地が始まるように
    let baseHeight = SEA_LEVEL - 30 + (continent * 60)

    let erosionFactor = Math.max(0, erosion - 0.4) * 2.0
    baseHeight -= erosionFactor * 20

    // 山脈の隆起: 山のスケールを 150 にして3乗で絶壁を作る
    if (erosion < 0.6 && continent > 0.4) {
       const mountainFactor = Math.pow(peaks, 3) * (1.0 - (erosion / 0.6))
       baseHeight += mountainFactor * 150
    }

    const detail = peaksNoise.noise(wx * 0.05, wz * 0.05) * 3

    return Math.max(minY + 1, Math.min(Math.floor(baseHeight + detail), worldHeight - 2))
  }

  function getBiome(wx, wz, h) {
    if (h < SEA_LEVEL - 2) return 'ocean'
    if (h <= SEA_LEVEL) return 'beach'

    const t = tempNoise.fbm(wx, wz, { octaves: 2, frequency: 0.002 })
    const hum = humidityNoise.fbm(wx, wz, { octaves: 2, frequency: 0.002 })

    if (h > 120) {
      if (t < 0.5) return 'snow_mountains'
      return 'mountains'
    }

    if (t > 0.6 && hum < 0.4) return 'desert'
    if (hum > 0.55 && t > 0.4) return 'forest'

    return 'plains'
  }

  function generateTree(chunk, lx, ly, lz, b, type) {
    const r = hashRandom(lx, lz)
    const height = type === 'spruce' ? 6 + Math.floor(r * 4) : 4 + Math.floor(r * 3)
    
    // ブロックIDのフォールバック (古いバージョン対策)
    const logBlock = type === 'spruce' ? (b.spruce_log || b.log) : (b.oak_log || b.log)
    const leavesBlock = type === 'spruce' ? (b.spruce_leaves || b.leaves) : (b.oak_leaves || b.leaves)

    const leavesRadius = 2

    if (lx < leavesRadius || lx >= 16 - leavesRadius || lz < leavesRadius || lz >= 16 - leavesRadius) {
      return
    }
    if (ly + height + 2 >= worldHeight) {
      return
    }

    for (let i = 0; i < height; i++) {
      setBlockSafe(chunk, new Vec3(lx, ly + i, lz), logBlock, theFlattening)
    }

    if (type === 'spruce') {
      for (let y = ly + 2; y <= ly + height + 1; y++) {
        const radius = (y % 2 === 0) ? 1 : 2;
        const topRadius = y > ly + height - 1 ? 1 : radius;
        for (let x = -topRadius; x <= topRadius; x++) {
          for (let z = -topRadius; z <= topRadius; z++) {
             if (x === 0 && z === 0 && y < ly + height) continue;
             if (Math.abs(x) === topRadius && Math.abs(z) === topRadius && topRadius > 1) continue;
             setBlockSafe(chunk, new Vec3(lx + x, y, lz + z), leavesBlock, theFlattening)
          }
        }
      }
    } else { // Oak
      for (let y = ly + height - 2; y <= ly + height + 1; y++) {
        const isTop = y >= ly + height
        const radius = isTop ? 1 : 2
        for (let x = -radius; x <= radius; x++) {
          for (let z = -radius; z <= radius; z++) {
             if (x === 0 && z === 0 && y < ly + height) continue;
             if (Math.abs(x) === radius && Math.abs(z) === radius && radius > 1) continue;
             setBlockSafe(chunk, new Vec3(lx + x, y, lz + z), leavesBlock, theFlattening)
          }
        }
      }
    }
  }

  function setBlockSafe(chunk, vec, block, theFlattening) {
    if (vec.x < 0 || vec.x > 15 || vec.z < 0 || vec.z > 15) return
    if (vec.y < minY || vec.y >= worldHeight) return
    setBlock(chunk, vec, block, theFlattening)
  }

  return function generateSimpleChunk(chunkX, chunkZ) {
    const chunk = new Chunk({ minY, worldHeight })
    const b = mcData.blocksByName

    const decorations = []

    for (let lx = 0; lx < 16; lx++) {
      for (let lz = 0; lz < 16; lz++) {
        const wx = chunkX * 16 + lx
        const wz = chunkZ * 16 + lz
        const h = getSurfaceHeight(wx, wz)
        const bio = getBiome(wx, wz, h)

        for (let ly = minY; ly <= minY + 2; ly++) {
          setBlock(chunk, new Vec3(lx, ly, lz), b.bedrock, theFlattening)
        }
        
        const dirtDepth = bio === 'desert' || bio === 'beach' ? 4 : (bio === 'mountains' || bio === 'snow_mountains' ? 1 : 3)
        for (let ly = minY + 3; ly < h - dirtDepth; ly++) {
          setBlock(chunk, new Vec3(lx, ly, lz), b.stone, theFlattening)
        }

        for (let ly = Math.max(minY + 3, h - dirtDepth); ly < h; ly++) {
           if (bio === 'desert' || bio === 'beach' || bio === 'ocean') {
             setBlock(chunk, new Vec3(lx, ly, lz), b.sand, theFlattening)
           } else if (bio === 'mountains' || bio === 'snow_mountains') {
             setBlock(chunk, new Vec3(lx, ly, lz), b.stone, theFlattening)
           } else {
             setBlock(chunk, new Vec3(lx, ly, lz), b.dirt, theFlattening)
           }
        }

        const vSurface = new Vec3(lx, h, lz)
        if (h < SEA_LEVEL && bio === 'ocean') {
          setBlock(chunk, vSurface, b.gravel || b.sand, theFlattening)
          for (let ly = h + 1; ly <= SEA_LEVEL; ly++) setBlock(chunk, new Vec3(lx, ly, lz), b.water, theFlattening)
        } else if (bio === 'beach') {
          setBlock(chunk, vSurface, b.sand, theFlattening)
        } else if (bio === 'desert') {
          setBlock(chunk, vSurface, b.sand, theFlattening)
        } else if (bio === 'snow_mountains') {
          setBlock(chunk, vSurface, b.snow_block, theFlattening)
        } else if (bio === 'mountains') {
          setBlock(chunk, vSurface, b.stone, theFlattening)
        } else {
          setBlock(chunk, vSurface, b.grass_block || b.grass, theFlattening) // b.grass フォールバック
          
          const vegVal = vegetationNoise.noise(wx * 0.1, wz * 0.1)
          const r = hashRandom(wx, wz)
          
          if (bio === 'forest') {
            if (vegVal > 0.0 && r < 0.1) decorations.push({ type: 'tree', treeType: 'oak', x: lx, y: h + 1, z: lz })
            else if (r < 0.3) decorations.push({ type: 'tall_grass', x: lx, y: h + 1, z: lz })
            else if (r < 0.32) decorations.push({ type: 'poppy', x: lx, y: h + 1, z: lz })
          } else if (bio === 'plains') {
            if (vegVal > 0.4 && r < 0.02) decorations.push({ type: 'tree', treeType: 'oak', x: lx, y: h + 1, z: lz })
            else if (r < 0.15) decorations.push({ type: 'tall_grass', x: lx, y: h + 1, z: lz })
            else if (r < 0.17) decorations.push({ type: 'dandelion', x: lx, y: h + 1, z: lz })
          }
        }

        if (bio === 'mountains' && h < 110) {
           const r = hashRandom(wx, wz)
           if (r < 0.05) decorations.push({ type: 'tree', treeType: 'spruce', x: lx, y: h + 1, z: lz })
        }
      }
    }

    for (const dec of decorations) {
      if (dec.type === 'tree') {
        generateTree(chunk, dec.x, dec.y, dec.z, b, dec.treeType)
      } else if (dec.type === 'tall_grass') {
        setBlockSafe(chunk, new Vec3(dec.x, dec.y, dec.z), b.tall_grass ?? b.grass, theFlattening)
      } else if (dec.type === 'poppy') {
        setBlockSafe(chunk, new Vec3(dec.x, dec.y, dec.z), b.poppy ?? b.red_flower, theFlattening)
      } else if (dec.type === 'dandelion') {
        setBlockSafe(chunk, new Vec3(dec.x, dec.y, dec.z), b.dandelion ?? b.yellow_flower, theFlattening)
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