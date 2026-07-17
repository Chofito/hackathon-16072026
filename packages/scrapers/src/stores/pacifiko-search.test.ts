import { describe, expect, test } from 'bun:test'
import { parsePacifikoSearchProductUrls } from './pacifiko.ts'

describe('parsePacifikoSearchProductUrls', () => {
  test('extrae URLs absolutas de /compras-en-linea/', () => {
    const html = `
      <a href="/compras-en-linea/audifonos-inalambricos-apple-airpods-pro-3-cancelacion-de-ruido-activa-color-blanco&pid=ABC">AirPods</a>
      <a href="/compras-en-linea/case-for-airpods-pro-3&pid=DEF">Case</a>
      <a href="/otra-cosa">no</a>
    `
    expect(parsePacifikoSearchProductUrls(html)).toEqual([
      'https://www.pacifiko.com/compras-en-linea/audifonos-inalambricos-apple-airpods-pro-3-cancelacion-de-ruido-activa-color-blanco&pid=ABC',
      'https://www.pacifiko.com/compras-en-linea/case-for-airpods-pro-3&pid=DEF',
    ])
  })

  test('deduplica y acepta href absolutos', () => {
    const html = `
      <a href="https://www.pacifiko.com/compras-en-linea/foo&pid=1">a</a>
      <a href="/compras-en-linea/foo&pid=1">b</a>
    `
    expect(parsePacifikoSearchProductUrls(html)).toEqual([
      'https://www.pacifiko.com/compras-en-linea/foo&pid=1',
    ])
  })
})
