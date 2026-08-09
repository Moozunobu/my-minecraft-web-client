import fs from 'fs'

const f = './node_modules/minecraft-renderer/dist/minecraft-renderer.js'
if (fs.existsSync(f)) {
  let c = fs.readFileSync(f, 'utf8')
  if (c.includes('else t=new Worker(e)')) {
    c = c.replaceAll('else t=new Worker(e)', 'else t=new Worker(typeof document!=="undefined"&&document.baseURI?new URL(e,document.baseURI).href:e)')
    fs.writeFileSync(f, c, 'utf8')
    console.log('[patchRendererWorker] SUCCESSFULLY PATCHED MINECRAFT-RENDERER WORKER URL!')
  } else {
    console.log('[patchRendererWorker] Pattern not found or already patched.')
  }
}
