import { describe, expect, test } from 'bun:test'
import {
  pickDistinctiveTokens,
  scoreTokens,
  tokenize,
} from './scoring.ts'

describe('pickDistinctiveTokens', () => {
  test('prioriza tokens de modelo y largos sobre pro/3', () => {
    const q = tokenize('AirPods Pro 3')
    const d = pickDistinctiveTokens(q)
    expect(d[0]).toBe('airpods')
    expect(d).not.toContain('pro')
  })

  test('prioriza sku de modelo QN55Q6FAA', () => {
    const q = tokenize('Samsung QN55Q6FAA 55 Smart QLED TV 4K')
    const d = pickDistinctiveTokens(q)
    expect(d[0]).toBe('qn55q6faa')
  })
})

describe('scoreTokens accessory penalty', () => {
  test('penaliza fundas/cases con los mismos tokens del producto', () => {
    const q = tokenize('AirPods Pro 3')
    const product = tokenize('apple-airpods-pro-3-wireless-earbuds')
    const accessory = tokenize('esr-for-airpods-pro-3-case-2025-compatible')
    expect(scoreTokens(q, product)).toBeGreaterThan(scoreTokens(q, accessory))
  })

  test('modelo match da piso minimo aunque falten tokens de marketing', () => {
    const q = tokenize('Samsung QN55Q6FAA 55 Smart QLED TV 4K')
    const slug = tokenize('samsung-qn55q6faa')
    expect(scoreTokens(q, slug)).toBeGreaterThanOrEqual(0.5)
  })
})
