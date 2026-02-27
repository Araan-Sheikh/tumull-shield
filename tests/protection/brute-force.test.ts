import { describe, it, expect, beforeEach } from 'vitest'
import { BruteForceDetector } from '../../src/protection/brute-force'

describe('BruteForceDetector', () => {
  let detector: BruteForceDetector

  beforeEach(() => {
    detector = new BruteForceDetector({
      maxFailures: 3,
      blockDuration: '1m',
      statusCodes: [401, 403],
    })
  })

  it('knows which status codes are failures', () => {
    expect(detector.isFailureStatus(401)).toBe(true)
    expect(detector.isFailureStatus(403)).toBe(true)
    expect(detector.isFailureStatus(200)).toBe(false)
    expect(detector.isFailureStatus(500)).toBe(false)
  })

  it("doesn't block on first failure", () => {
    expect(detector.recordFailure('k').shouldBlock).toBe(false)
  })

  it('blocks after max failures', () => {
    detector.recordFailure('k')
    detector.recordFailure('k')
    const { shouldBlock, blockInfo } = detector.recordFailure('k')

    expect(shouldBlock).toBe(true)
    expect(blockInfo?.reason).toBe('brute-force')
    expect(blockInfo?.blocked).toBe(true)
  })

  it('tracks keys separately', () => {
    detector.recordFailure('a')
    detector.recordFailure('a')
    detector.recordFailure('b')

    expect(detector.recordFailure('a').shouldBlock).toBe(true) // 3rd for a
    expect(detector.recordFailure('b').shouldBlock).toBe(false) // only 2nd for b
  })

  it('resets on success', () => {
    detector.recordFailure('k')
    detector.recordFailure('k')
    detector.recordSuccess('k') // wipe it

    expect(detector.recordFailure('k').shouldBlock).toBe(false) // back to 1
  })

  it('progressive delay is 0 for first failure', () => {
    detector.recordFailure('k')
    expect(detector.getProgressiveDelay('k')).toBe(0)
  })

  it('delay increases exponentially', () => {
    detector.recordFailure('k')
    detector.recordFailure('k')
    expect(detector.getProgressiveDelay('k')).toBeGreaterThan(0)
  })
})
