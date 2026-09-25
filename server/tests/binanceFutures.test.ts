import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { signQuery, formatQuantity, formatOrderPrice } from '../src/broker/binanceFutures.js'

describe('signQuery', () => {
  it('menghasilkan HMAC-SHA256 hex yang sama persis dengan crypto langsung', () => {
    const query = 'symbol=BTCUSDT&side=BUY&type=MARKET&quantity=1&timestamp=1700000000000'
    const secret = 'rahasia-test'
    const expected = createHmac('sha256', secret).update(query).digest('hex')
    expect(signQuery(query, secret)).toBe(expected)
  })

  it('signature beda kalau query beda dikit aja', () => {
    const secret = 'rahasia-test'
    const a = signQuery('symbol=BTCUSDT&quantity=1', secret)
    const b = signQuery('symbol=BTCUSDT&quantity=2', secret)
    expect(a).not.toBe(b)
  })
})

describe('formatQuantity', () => {
  it('ikut jumlah desimal stepSize, hindari floating point residue', () => {
    expect(formatQuantity(0.1 + 0.2, 0.001)).toBe('0.300')
    expect(formatQuantity(4, 0.001)).toBe('4.000')
  })

  it('stepSize bulat (0 desimal) -> qty tanpa titik desimal', () => {
    expect(formatQuantity(20, 1)).toBe('20')
  })
})

describe('formatOrderPrice', () => {
  it('ikut jumlah desimal tickSize', () => {
    expect(formatOrderPrice(71.6449999, 0.01)).toBe('71.64')
  })

  it('tickSize kecil (banyak desimal, notasi exponential)', () => {
    expect(formatOrderPrice(0.0568432, 0.0000001)).toBe('0.0568432')
  })
})
