export default function generation({ version, seed = '12345', worldHeight = 256, minY = 0 } = {}) {
  const Chunk = require('prismarine-chunk')(version)
  const mcData = require('minecraft-data')(version)
  const theFlattening = mcData.supportFeature('blockStateId')
  const Vec3 = require('vec3').Vec3

  return function generateChunk(chunkX, chunkZ) {
    const chunk = new Chunk({ minY, worldHeight })
    const b = mcData.blocksByName

    for (let lx = 0; lx < 16; lx++) {
      for (let lz = 0; lz < 16; lz++) {
        const vec = new Vec3(lx, 60, lz)
        if (theFlattening) {
          chunk.setBlockStateId(vec, b.grass_block ? b.grass_block.defaultState : (b.grass ? b.grass.defaultState ?? 0 : 0))
        } else {
          chunk.setBlockType(vec, b.grass_block ? b.grass_block.id : (b.grass ? b.grass.id : 0))
          chunk.setBlockData(vec, 0)
        }
      }
    }
    return chunk
  }
}