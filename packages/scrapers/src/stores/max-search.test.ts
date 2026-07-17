import { describe, expect, test } from 'bun:test'
import { parseMaxSearchProductUrls } from './max.ts'

describe('parseMaxSearchProductUrls', () => {
  test('extrae URLs de producto desde productsList en __NEXT_DATA__', () => {
    const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          productsList: [
            { sku: 'PS5LASTOFUS2RM', title: 'Juego PS5 The Last of Us Part II Remastered', slug: 'juego-ps5-the-last-of-us-part-ii-remastered' },
            { sku: 'OTHER', title: 'Otro', slug: 'otro-juego' },
          ],
        },
      },
    })}</script></html>`

    expect(parseMaxSearchProductUrls(html)).toEqual([
      'https://www.max.com.gt/juego-ps5-the-last-of-us-part-ii-remastered',
      'https://www.max.com.gt/otro-juego',
    ])
  })

  test('omite items sin slug y HTML sin __NEXT_DATA__', () => {
    expect(parseMaxSearchProductUrls('<html></html>')).toEqual([])
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: { pageProps: { productsList: [{ sku: 'X', title: 'Sin slug' }] } },
    })}</script>`
    expect(parseMaxSearchProductUrls(html)).toEqual([])
  })
})
