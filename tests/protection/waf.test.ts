import { describe, it, expect } from 'vitest'
import { evaluateWaf } from '../../src/protection/waf'

describe('waf rules', () => {
  it('blocks by includes on path', () => {
    const req = new Request('http://localhost/admin/panel')
    const res = evaluateWaf(req, [{ target: 'path', value: '/admin' }])
    expect(res.blocked).toBe(true)
  })

  it('blocks by regex on query', () => {
    const req = new Request('http://localhost/api/search?q=union+select+1')
    const res = evaluateWaf(req, [
      {
        target: 'query',
        operator: 'regex',
        value: 'union\\s*select',
        flags: 'i',
      },
    ])
    expect(res.blocked).toBe(true)
  })

  it('blocks by exact method', () => {
    const req = new Request('http://localhost/api/delete', { method: 'DELETE' })
    const res = evaluateWaf(req, [
      { target: 'method', operator: 'equals', value: 'DELETE', message: 'method not allowed' },
    ])
    expect(res.blocked).toBe(true)
    expect(res.reason).toBe('method not allowed')
  })

  it('does not block when no rule matches', () => {
    const req = new Request('http://localhost/api/ok?x=1')
    const res = evaluateWaf(req, [{ target: 'path', value: '/admin' }])
    expect(res.blocked).toBe(false)
  })
})
