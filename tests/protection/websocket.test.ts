import { describe, it, expect, afterEach } from 'vitest'
import { createWebSocketLimiter, shieldWs } from '../../src/protection/websocket'
import { MemoryStore } from '../../src/stores/memory'

describe('websocket limiter', () => {
  const stores: MemoryStore[] = []

  afterEach(async () => {
    await Promise.all(stores.map((store) => store.close()))
    stores.length = 0
  })

  function store() {
    const created = new MemoryStore()
    stores.push(created)
    return created
  }

  it('limits connection attempts by key', async () => {
    const limiter = createWebSocketLimiter({
      store: store(),
      connectionLimit: 2,
      connectionWindow: '1m',
    })

    expect((await limiter.connection('1.2.3.4')).allowed).toBe(true)
    expect((await limiter.connection('1.2.3.4')).allowed).toBe(true)
    expect((await limiter.connection('1.2.3.4')).allowed).toBe(false)
  })

  it('limits messages independently per socket id', async () => {
    const limiter = createWebSocketLimiter({
      store: store(),
      messageLimit: 1,
      messageWindow: '1m',
    })

    expect((await limiter.message('1.2.3.4', 'socket-a')).allowed).toBe(true)
    expect((await limiter.message('1.2.3.4', 'socket-a')).allowed).toBe(false)
    expect((await limiter.message('1.2.3.4', 'socket-b')).allowed).toBe(true)
  })

  it('returns booleans for close and drop helpers', async () => {
    const limiter = shieldWs({
      store: store(),
      connectionLimit: 1,
      messageLimit: 1,
    })

    expect(await limiter.shouldCloseConnection('client')).toBe(false)
    expect(await limiter.shouldCloseConnection('client')).toBe(true)
    expect(await limiter.shouldDropMessage('client', 'socket')).toBe(false)
    expect(await limiter.shouldDropMessage('client', 'socket')).toBe(true)
  })

  it('can block a key after a websocket limit is exceeded', async () => {
    const blocks: string[] = []
    const limiter = createWebSocketLimiter({
      store: store(),
      connectionLimit: 1,
      connectionBlock: '1m',
      onBlock: (key, info) => {
        blocks.push(`${key}:${info.reason}:${info.blocked}`)
      },
    })

    await limiter.connection('client')
    const exceeded = await limiter.connection('client')
    const blocked = await limiter.connection('client')

    expect(exceeded.allowed).toBe(false)
    expect(exceeded.blocked).toBe(true)
    expect(blocked.allowed).toBe(false)
    expect(blocked.blocked).toBe(true)
    expect(blocks).toEqual(['client:websocket:true', 'client:websocket:true'])
  })
})
