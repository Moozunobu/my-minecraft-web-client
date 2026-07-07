'use strict'

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a, b, t) {
  return a + t * (b - a)
}

function grad(hash, x, y) {
  const h = hash & 3
  const u = h < 2 ? x : y
  const v = h < 2 ? y : x
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
}

export class PerlinNoise2D {
  constructor(seed) {
    const p = Array.from({ length: 256 }, (_, i) => i)
    let rng = seed
    const rand = () => {
      rng = (rng * 1664525 + 1013904223) & 0xffffffff
      return (rng >>> 0) / 0xffffffff
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]]
    }
    this.perm = new Uint8Array(512)
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255]
  }

  noise(x, y) {
    const xi = Math.floor(x) & 255
    const yi = Math.floor(y) & 255
    const xf = x - Math.floor(x)
    const yf = y - Math.floor(y)
    const u = fade(xf)
    const v = fade(yf)
    const { perm } = this
    const a = perm[xi] + yi
    const b = perm[xi + 1] + yi
    return lerp(
      lerp(grad(perm[a], xf, yf), grad(perm[b], xf - 1, yf), u),
      lerp(grad(perm[a + 1], xf, yf - 1), grad(perm[b + 1], xf - 1, yf - 1), u),
      v
    )
  }

  fbm(x, y, { octaves = 6, frequency = 0.003, persistence = 0.5, lacunarity = 2.0 } = {}) {
    let value = 0
    let amplitude = 1
    let totalAmplitude = 0
    let f = frequency
    for (let i = 0; i < octaves; i++) {
      value += this.noise(x * f, y * f) * amplitude
      totalAmplitude += amplitude
      amplitude *= persistence
      f *= lacunarity
    }
    return (value / totalAmplitude) * 0.5 + 0.5
  }
}