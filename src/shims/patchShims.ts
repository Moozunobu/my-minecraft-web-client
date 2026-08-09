import { EventEmitter } from 'events'

EventEmitter.defaultMaxListeners = 200

const oldEmit = EventEmitter.prototype.emit
EventEmitter.prototype.emit = function (...args) {
  if (args[0] === 'error' && !this._events.error) {
    console.log('Unhandled error event', args.slice(1))
    args[1] = { message: String(args[1]) }
  }
  return oldEmit.apply(this, args)
}

// Global Worker interceptor: resolve worker URLs relative to document.baseURI on GitHub Pages / subpaths
if (typeof window !== 'undefined' && window.Worker) {
  const NativeWorker = window.Worker
  const WorkerWrapper = function (this: Worker, scriptURL: string | URL, options?: WorkerOptions) {
    let finalUrl = scriptURL
    if (typeof scriptURL === 'string' && document.baseURI && !scriptURL.startsWith('blob:') && !scriptURL.startsWith('http://') && !scriptURL.startsWith('https://')) {
      const cleanPath = scriptURL.startsWith('/') ? scriptURL.slice(1) : scriptURL
      finalUrl = new URL(cleanPath, document.baseURI).href
    }
    return new NativeWorker(finalUrl, options)
  }
  WorkerWrapper.prototype = NativeWorker.prototype
  window.Worker = WorkerWrapper as any
}
