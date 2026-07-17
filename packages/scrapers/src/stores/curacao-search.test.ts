import { describe, expect, test } from 'bun:test'
import { parseCuracaoSearchProductUrls } from './curacao.ts'

describe('parseCuracaoSearchProductUrls', () => {
  test('extrae links de producto /guatemala/.../p', () => {
    const html = `
      <a class="product-item-link" href="https://www.lacuracaonline.com/guatemala/regulador-forza-2200-123/p">Forza</a>
      <a href="/guatemala/ups-forza-456/p">UPS</a>
      <a href="/guatemala/c/p">categoria</a>
    `
    expect(parseCuracaoSearchProductUrls(html)).toEqual([
      'https://www.lacuracaonline.com/guatemala/regulador-forza-2200-123/p',
      'https://www.lacuracaonline.com/guatemala/ups-forza-456/p',
    ])
  })
})
