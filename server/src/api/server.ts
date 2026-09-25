import express, { type Request, type Response, type NextFunction } from 'express'
import { CONFIG } from '../config/env.js'
import { saveState, type AppState } from '../store/state.js'
import { closeAllPositions } from '../engine/positionManager.js'
import { closeAllPositionsLive } from '../engine/livePositionManager.js'
import { getFundingShadowSummary, getFundingSnapshot, onFundingSnapshot } from '../engine/fundingShadow.js'

type LogFn = (msg: string) => void

function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Token kosong = auth dimatikan — cuma masuk akal untuk localhost dev, lihat catatan di server/.env.example.
  if (!CONFIG.controlApiToken) return next()
  if (req.headers.authorization === `Bearer ${CONFIG.controlApiToken}`) return next()
  // EventSource browser tidak bisa kirim custom header, jadi /api/stream juga terima ?token=
  // sebagai fallback (dipakai HANYA oleh endpoint SSE, bukan endpoint control/state biasa).
  const isStream = req.path === '/api/stream' || req.path === '/api/funding-stream'
  if (isStream && req.query.token === CONFIG.controlApiToken) return next()
  res.status(401).json({ error: 'unauthorized' })
}

export function createApiServer(state: AppState, log: LogFn) {
  const app = express()
  app.use(express.json())

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', CONFIG.allowedOrigin)
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    if (req.method === 'OPTIONS') { res.sendStatus(204); return }
    next()
  })

  const sseClients = new Set<Response>()

  function broadcast(current: AppState) {
    const payload = `data: ${JSON.stringify(current)}\n\n`
    for (const client of sseClients) client.write(payload)
  }

  app.get('/api/state', requireAuth, (req: Request, res: Response) => {
    res.json(state)
  })

  // Read-only: ringkasan forward-test F3 (shadow-only, bukan posisi bot).
  app.get('/api/funding-shadow', requireAuth, (req: Request, res: Response) => {
    res.json(getFundingShadowSummary())
  })

  // SSE terpisah dari /api/stream: snapshot panel Funding Squeeze (F3), dikirim tiap siklus
  // fundingShadow selesai (±5 menit) — browser gak perlu polling Binance sendiri.
  const fundingClients = new Set<Response>()
  onFundingSnapshot((snapshot) => {
    const payload = `data: ${JSON.stringify(snapshot)}\n\n`
    for (const client of fundingClients) client.write(payload)
  })

  app.get('/api/funding-stream', requireAuth, (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    const current = getFundingSnapshot()
    if (current) res.write(`data: ${JSON.stringify(current)}\n\n`)
    fundingClients.add(res)
    req.on('close', () => fundingClients.delete(res))
  })

  app.get('/api/stream', requireAuth, (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.write(`data: ${JSON.stringify(state)}\n\n`)
    sseClients.add(res)
    req.on('close', () => sseClients.delete(res))
  })

  app.post('/api/control/enable', requireAuth, (req: Request, res: Response) => {
    state.enabled = true
    saveState(state)
    log('auto-trade ENABLED')
    broadcast(state)
    res.json({ ok: true })
  })

  app.post('/api/control/disable', requireAuth, (req: Request, res: Response) => {
    state.enabled = false
    saveState(state)
    log('auto-trade DISABLED (posisi terbuka tetap dikelola sampai closed)')
    broadcast(state)
    res.json({ ok: true })
  })

  app.post('/api/control/close-all', requireAuth, async (req: Request, res: Response) => {
    state.enabled = false
    if (CONFIG.tradingMode === 'live') await closeAllPositionsLive(state, log)
    else await closeAllPositions(state, log)
    saveState(state)
    log('CLOSE ALL (manual kill switch)')
    broadcast(state)
    res.json({ ok: true, remainingOpen: state.openPositions.length })
  })

  // SSE itu koneksi HTTP yang sengaja dibuat lama nyala — tanpa ini, httpServer.close()
  // nunggu semua klien SSE putus sendiri dan gantung sampai akhirnya force-killed.
  function closeAllStreams() {
    for (const client of sseClients) client.end()
    sseClients.clear()
    for (const client of fundingClients) client.end()
    fundingClients.clear()
  }

  return { app, broadcast, closeAllStreams }
}
