import { describe, it, expect } from 'vitest'
import { detectBot, isKnownBot } from '../../src/protection/bot-detect'

describe('detectBot', () => {
  it('flags empty user-agent', () => {
    const req = new Request('http://localhost')
    expect(detectBot(req).isBot).toBe(true)
    expect(detectBot(req).reason).toContain('Empty')
  })

  it('catches known bots', () => {
    const bots = ['Scrapy/1.0', 'curl/7.68', 'python-requests/2.28', 'Wget/1.21']
    for (const ua of bots) {
      const req = new Request('http://localhost', { headers: { 'user-agent': ua } })
      expect(detectBot(req).isBot).toBe(true)
    }
  })

  it('allows real browsers', () => {
    const req = new Request('http://localhost', {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        accept: 'text/html',
        'accept-language': 'en-US',
        'accept-encoding': 'gzip, deflate',
      },
    })
    expect(detectBot(req).isBot).toBe(false)
  })

  it('respects allow patterns', () => {
    const req = new Request('http://localhost', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    })
    expect(detectBot(req, { allowPatterns: ['googlebot'] }).isBot).toBe(false)
  })

  it('blocks custom patterns', () => {
    const req = new Request('http://localhost', {
      headers: {
        'user-agent': 'MyCustomScraper/1.0',
        accept: 'text/html',
        'accept-language': 'en-US',
        'accept-encoding': 'gzip',
      },
    })
    expect(detectBot(req, { blockPatterns: ['mycustomscraper'] }).isBot).toBe(true)
  })

  it('can disable empty-UA check', () => {
    const req = new Request('http://localhost')
    expect(detectBot(req, { flagEmptyUA: false, checkHeaders: false }).isBot).toBe(false)
  })
})

describe('isKnownBot', () => {
  it('catches bots', () => {
    expect(isKnownBot('curl/7.68')).toBe(true)
    expect(isKnownBot('Scrapy Spider')).toBe(true)
  })

  it('passes browsers', () => {
    expect(isKnownBot('Mozilla/5.0 Chrome/120')).toBe(false)
  })

  it('checks extra patterns', () => {
    expect(isKnownBot('MyBot/1.0', ['mybot'])).toBe(true)
  })
})
