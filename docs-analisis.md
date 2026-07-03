# Hellnah Terminal — Implementation Plan

> Platform analisis crypto dengan sinyal bullish/bearish dan multi-market chart dashboard.

---

## Daftar Isi

1. [Overview Arsitektur](#1-overview-arsitektur)
2. [Data Sources](#2-data-sources)
3. [Scoring Logic — Aturan per Indikator](#3-scoring-logic--aturan-per-indikator)
4. [Formula Agregasi](#4-formula-agregasi)
5. [System Architecture](#5-system-architecture)
6. [Tech Stack](#6-tech-stack)
7. [Build Roadmap](#7-build-roadmap)
8. [GTM Strategy](#8-gtm-strategy)
9. [Budget & Timeline](#9-budget--timeline)
10. [SEO Strategy](#10-seo-strategy)

---

## 1. Overview Arsitektur

Hellnah Terminal bekerja dalam 3 lapisan utama:

| Lapisan | Fungsi |
|---|---|
| **Data layer** | Ambil OHLCV, volume, dan sentiment dari exchange & API eksternal |
| **Engine layer** | Hitung indikator teknikal → scoring per indikator → weighted aggregate → % bullish/bearish |
| **Presentation layer** | Tampilkan chart multi-market + sinyal ke user via dashboard |

---

## 2. Data Sources

### Kategori data dan bobotnya

| Kategori | Bobot | Sumber |
|---|---|---|
| Price action | 30% | Binance, OKX, Bybit WebSocket |
| Volume | 20% | Exchange API (OHLCV) |
| Technical indicators | 35% | Dihitung dari raw OHLCV |
| Market sentiment | 15% | Alternative.me, Coinalyze |

### Data yang harus dibaca

#### Price Action (bobot 30%)
- OHLC per candle (1m, 5m, 15m, 1h, 4h, 1d)
- Harga sekarang (last price)
- % perubahan 24h
- High / Low 7d dan 30d
- Jarak dari ATH (All-Time High)

#### Volume (bobot 20%)
- Volume 24h
- Volume vs rata-rata 7 hari
- Buy/sell volume ratio
- OBV (On Balance Volume)
- Volume spike detection

#### Technical Indicators (bobot 35%)
- RSI 14 period
- MACD + signal line + histogram
- EMA 20 / EMA 50 / EMA 200
- Bollinger Bands width
- Stochastic RSI

#### Market Sentiment (bobot 15%)
- Fear & Greed Index — [Alternative.me](https://alternative.me/crypto/fear-and-greed-index/) (gratis, update harian)
- Open Interest futures
- Funding rate
- Long/Short ratio

### API yang digunakan

| API | Data | Biaya |
|---|---|---|
| Binance WebSocket | OHLCV real-time | Gratis |
| CoinGecko API | Harga, market cap, metadata | Gratis (rate limited) |
| Alternative.me | Fear & Greed Index | Gratis |
| Coinalyze | Funding rate, OI, L/S ratio | Freemium |

---

## 3. Scoring Logic — Aturan per Indikator

Setiap indikator menghasilkan skor dalam skala **-1.0 (full bearish) hingga +1.0 (full bullish)**.

### RSI (14 period)

| Kondisi RSI | Interpretasi | Skor |
|---|---|---|
| < 30 | Oversold — potensi reversal naik | +0.8 hingga +1.0 |
| 30–45 | Mild bullish | +0.2 hingga +0.5 |
| 45–55 | Netral | 0 |
| 55–70 | Mild bearish | -0.2 hingga -0.5 |
| > 70 | Overbought — potensi reversal turun | -0.8 hingga -1.0 |

### MACD

| Kondisi | Skor |
|---|---|
| MACD > signal AND histogram naik | +1.0 |
| MACD > signal line | +0.5 |
| MACD < signal AND histogram turun | -1.0 |
| MACD < signal line | -0.5 |

### EMA Alignment

| Kondisi | Skor |
|---|---|
| Harga > EMA20 > EMA50 > EMA200 | +1.0 (strong uptrend) |
| Harga > EMA20 > EMA50 | +0.6 |
| Harga > EMA20 saja | +0.3 |
| Harga < EMA20 < EMA50 < EMA200 | -1.0 (strong downtrend) |

### Bollinger Bands

| Kondisi | Skor |
|---|---|
| Harga menyentuh lower band | +0.8 (potential reversal) |
| Harga mendekati lower band | +0.3 |
| Harga di tengah band | 0 |
| Harga menyentuh upper band | -0.8 |
| Band squeeze (menyempit) | Kalikan skor × 0.5 (uncertainty) |

### Volume vs Rata-rata 7 Hari

| Kondisi | Skor |
|---|---|
| Volume > 2× avg + harga naik | +1.0 |
| Volume > 2× avg + harga turun | -1.0 |
| Volume normal (0.8×–1.2× avg) | 0 |
| Volume rendah (< 0.5× avg) | Kalikan semua skor × 0.7 (sinyal lemah) |

### OBV (On Balance Volume)

| Kondisi | Skor |
|---|---|
| OBV naik konsisten 7 hari | +0.7 (akumulasi) |
| OBV diverge — harga naik tapi OBV turun | -0.6 (distribusi) |
| OBV flat | 0 |

### Fear & Greed Index (Contrarian)

| Nilai | Label | Skor |
|---|---|---|
| 0–25 | Extreme Fear | +0.7 (contrarian bullish) |
| 25–40 | Fear | +0.3 |
| 40–60 | Neutral | 0 |
| 60–75 | Greed | -0.3 |
| 75–100 | Extreme Greed | -0.7 (contrarian bearish) |

### Funding Rate

| Kondisi | Skor |
|---|---|
| Sangat negatif (< -0.1%) | +0.5 (long squeeze potential) |
| Negatif (-0.1% to 0%) | +0.2 |
| Normal (0%–0.05%) | 0 |
| Tinggi (> 0.1%) | -0.5 (exit signal) |

---

## 4. Formula Agregasi

### Step 1 — Hitung skor per kategori

```python
score_price     = (rsi_score * 0.5) + (bb_score * 0.5)
score_volume    = (volume_score * 0.5) + (obv_score * 0.5)
score_technical = (macd_score * 0.4) + (ema_score * 0.6)
score_sentiment = (fg_score * 0.5) + (funding_score * 0.5)
```

### Step 2 — Weighted aggregate

```python
raw_signal = (score_price     * 0.30) \
           + (score_volume    * 0.20) \
           + (score_technical * 0.35) \
           + (score_sentiment * 0.15)

# raw_signal range: -1.0 (full bearish) to +1.0 (full bullish)
```

### Step 3 — Konversi ke persentase bullish

```python
bullish_pct = ((raw_signal + 1) / 2) * 100

# Contoh:
# raw = +0.6  →  bullish = 80%
# raw = -0.4  →  bullish = 30%
# raw =  0.0  →  bullish = 50%
```

### Step 4 — Volume confidence multiplier

```python
if volume_vs_avg < 0.5:
    # Volume rendah → tarik mendekati netral
    bullish_pct = lerp(bullish_pct, 50, 0.4)
```

### Step 5 — Label sinyal

```python
if bullish_pct >= 65:  label = "Bullish"
if bullish_pct >= 55:  label = "Mild Bullish"
if bullish_pct >= 45:  label = "Neutral"
if bullish_pct >= 35:  label = "Mild Bearish"
if bullish_pct <  35:  label = "Bearish"
```

### Contoh perhitungan nyata — BTC uptrend normal

```python
# Input scores
rsi_score      = +0.4   # RSI 42, approaching oversold
macd_score     = +0.5   # MACD > signal, histogram naik
ema_score      = +1.0   # Harga > EMA20 > EMA50 > EMA200
bb_score       = +0.3   # Mendekati lower band
volume_score   = +0.5   # Volume 1.4× avg, harga naik
obv_score      = +0.7   # OBV naik 7 hari berturut
fg_score       = +0.3   # Fear index 35 (Fear zone)
funding_score  =  0.0   # Funding rate normal

# Kalkulasi
score_price     = (0.4*0.5) + (0.3*0.5) = 0.35
score_volume    = (0.5*0.5) + (0.7*0.5) = 0.60
score_technical = (0.5*0.4) + (1.0*0.6) = 0.80
score_sentiment = (0.3*0.5) + (0.0*0.5) = 0.15

raw_signal = (0.35*0.30) + (0.60*0.20) + (0.80*0.35) + (0.15*0.15)
           = 0.105 + 0.12 + 0.28 + 0.0225
           = 0.5275

bullish_pct = ((0.5275 + 1) / 2) * 100 = 76.4%
# → LABEL: "Bullish"
```

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                         │
├───────────────┬──────────────┬───────────────┬─────────────┤
│ Exchange APIs │ CoinGecko    │ Alternative.me│ Coinalyze   │
│ Binance/OKX   │ Harga, mcap  │ Fear & Greed  │ Funding, OI │
└───────┬───────┴──────┬───────┴───────┬───────┴──────┬──────┘
        └──────────────┴───────────────┴──────────────┘
                                │
                                ▼
              ┌─────────────────────────────────┐
              │       DATA INGESTION LAYER       │
              │  Scheduler tiap 1 menit          │
              │  WebSocket (real-time) + REST    │
              └─────────────────┬───────────────┘
                                │
                                ▼
              ┌─────────────────────────────────┐
              │      TIME SERIES DATABASE        │
              │  TimescaleDB / InfluxDB          │
              │  Simpan OHLCV, volume, ticker    │
              └─────────────────┬───────────────┘
                                │
                                ▼
              ┌─────────────────────────────────┐
              │    SIGNAL PROCESSING ENGINE      │
              │  Hitung RSI, MACD, EMA, BB, OBV │
              │  Weighted score → bullish %      │
              └─────────────────┬───────────────┘
                                │
                                ▼
              ┌─────────────────────────────────┐
              │           RESULT CACHE           │
              │  Redis — TTL 60 detik            │
              │  Invalidate saat candle baru     │
              └─────────────────┬───────────────┘
                                │
                                ▼
              ┌─────────────────────────────────┐
              │       REST + WebSocket API       │
              │  FastAPI / Node.js               │
              │  Endpoint per coin, live stream  │
              └──────────┬──────────────────────┘
                         │
              ┌──────────┴──────────────┐
              ▼                         ▼
  ┌───────────────────────┐  ┌──────────────────────────┐
  │  Dashboard multi-chart│  │     Signal display        │
  │  TradingView Charts   │  │  % bullish/bearish        │
  │  Lightweight lib      │  │  Gauge + label            │
  └──────────┬────────────┘  └────────────┬─────────────┘
             └──────────────┬─────────────┘
                            ▼
              ┌─────────────────────────────────┐
              │         FRONTEND APP             │
              │  React / Next.js                 │
              │  WebSocket live update           │
              └─────────────────────────────────┘
```

---

## 6. Tech Stack

### Backend

| Komponen | Teknologi | Alasan |
|---|---|---|
| Language | Python 3.11+ | Library `pandas-ta` / `ta` untuk kalkulasi indikator — 1 baris kode |
| API framework | FastAPI | Async, WebSocket support, cepat |
| Time series DB | TimescaleDB (PostgreSQL) | SQL-compatible, cocok untuk OHLCV |
| Cache | Redis | TTL-based cache, pub/sub untuk live update |
| Task scheduler | Celery + Redis | Cron job ingestion tiap 1 menit |

### Frontend

| Komponen | Teknologi | Alasan |
|---|---|---|
| Framework | Next.js (React) | SSR untuk SEO, routing mudah |
| Chart library | TradingView Lightweight Charts | Gratis, open source, performa tinggi |
| State management | Zustand | Ringan, cocok untuk real-time data |
| WebSocket | native browser WebSocket | Koneksi langsung ke FastAPI |

### DevOps (MVP)

| Komponen | Teknologi |
|---|---|
| Hosting backend | Railway / Render (murah, mudah deploy) |
| Hosting frontend | Vercel |
| Database | Supabase (TimescaleDB managed) |
| Monitoring | Grafana + Prometheus |

### Library Python untuk kalkulasi indikator

```bash
pip install pandas-ta websocket-client httpx redis celery
```

```python
import pandas_ta as ta
import pandas as pd

# Dari DataFrame OHLCV, hitung semua indikator sekaligus
df = pd.DataFrame(ohlcv_data, columns=['open','high','low','close','volume'])

df['rsi']    = ta.rsi(df['close'], length=14)
df['macd']   = ta.macd(df['close'])['MACD_12_26_9']
df['signal'] = ta.macd(df['close'])['MACDs_12_26_9']
df['ema20']  = ta.ema(df['close'], length=20)
df['ema50']  = ta.ema(df['close'], length=50)
df['ema200'] = ta.ema(df['close'], length=200)
df['obv']    = ta.obv(df['close'], df['volume'])
bb           = ta.bbands(df['close'], length=20)
df['bb_upper'] = bb['BBU_20_2.0']
df['bb_lower'] = bb['BBL_20_2.0']
```

---

## 7. Build Roadmap

### Fase 0 — Setup & infrastruktur (Minggu 1–2)

- [ ] Setup repo (monorepo: `/backend`, `/frontend`)
- [ ] Setup TimescaleDB (Supabase)
- [ ] Setup Redis (Railway)
- [ ] Koneksi Binance WebSocket — stream OHLCV BTC/USDT
- [ ] Simpan raw candle ke database
- [ ] Unit test: verifikasi data tersimpan benar

### Fase 1 — Signal engine MVP (Minggu 3–4)

- [ ] Implementasi RSI scoring function
- [ ] Implementasi MACD scoring function
- [ ] Implementasi EMA alignment scoring
- [ ] Implementasi Bollinger Bands scoring
- [ ] Implementasi volume scoring + multiplier
- [ ] Implementasi weighted aggregate formula
- [ ] Endpoint `GET /signal/{coin}` — return bullish %
- [ ] Unit test per indikator dengan data historis

### Fase 2 — Multi-market + sentiment (Minggu 5–6)

- [ ] Tambah 10 market: ETH, BNB, SOL, XRP, ADA, DOGE, AVAX, MATIC, LINK, DOT
- [ ] Integrasikan Fear & Greed API (Alternative.me)
- [ ] Integrasikan funding rate (Coinalyze)
- [ ] Redis cache untuk hasil sinyal (TTL 60 detik)
- [ ] WebSocket endpoint untuk live update
- [ ] Endpoint `GET /markets` — semua market + sinyal

### Fase 3 — Frontend dashboard (Minggu 7–9)

- [ ] Setup Next.js + TradingView Lightweight Charts
- [ ] Dashboard grid: tampilkan 4–9 chart sekaligus
- [ ] Komponen signal gauge: % bullish/bearish + label
- [ ] WebSocket client untuk update real-time
- [ ] Filter market (top 10, top 25, custom watchlist)
- [ ] Timeframe selector (1h, 4h, 1d)
- [ ] Responsive design (mobile-first)

### Fase 4 — Auth + monetisasi (Minggu 10–12)

- [ ] Auth: NextAuth.js + Google/email login
- [ ] Freemium logic: free = 3 market, pro = unlimited
- [ ] Integrasi Stripe / Midtrans untuk pembayaran
- [ ] User watchlist (simpan market favorit)
- [ ] Price alert (notifikasi email saat sinyal berubah)
- [ ] Onboarding flow untuk user baru

### Fase 5 — Polish & launch (Minggu 13–14)

- [ ] Error handling & fallback jika API eksternal down
- [ ] Rate limiting di API layer
- [ ] Load testing (target: 1.000 concurrent user)
- [ ] SEO: meta tags, sitemap, structured data
- [ ] Analytics: Mixpanel / PostHog
- [ ] Soft launch ke 100 user waitlist

---

## 8. GTM Strategy

### Tiga pilar utama

| Pilar | Strategi | Channel |
|---|---|---|
| Community-Led Growth | Bangun komunitas sebelum launch | Telegram, Discord, Twitter/X |
| Content & SEO Authority | Jadi sumber analisis crypto terpercaya | Blog, YouTube, Newsletter |
| Product-Led Growth (PLG) | Freemium — user rasakan value dulu | In-app, referral, share chart |

### Freemium model

| Tier | Fitur | Harga |
|---|---|---|
| Free | 3 market + sinyal dasar | Gratis |
| Pro | Unlimited market + advanced signal + alerts | Rp 89.000/bulan |

### Channel priority

| Channel | Prioritas | Fase |
|---|---|---|
| Telegram / Discord | Tinggi | Mulai bulan 1 |
| Twitter / X Crypto | Tinggi | Mulai bulan 1 |
| YouTube / TikTok | Sedang | Mulai bulan 2 |
| SEO / Blog | Sedang | Mulai bulan 2 |
| KOL / Influencer | Sedang (selektif) | Mulai bulan 3 |
| Paid Ads | Rendah | Mulai bulan 5 |

### Action plan per fase

#### Pre-launch (Bulan 1–2)
1. Interview 30 trader aktif — validasi pain point
2. Landing page + waitlist (target 500 email)
3. Buat Telegram group "Hellnah Terminal Insider"
4. Identifikasi 5–10 KOL crypto Indonesia (10k–200k followers)
5. Setup analytics: GA4, Hotjar, Mixpanel

#### Soft launch (Bulan 3–4)
1. Launch eksklusif ke waitlist — badge "Founding Member" + Pro gratis 30 hari
2. Weekly feedback loop — survey tiap Jumat
3. Content engine: 3 post/minggu (analisis, edukasi, UGC)
4. Activate 2–3 KOL pertama

#### Public launch & scale (Bulan 5–12)
1. Press release ke media crypto Indonesia
2. Paid ads Google — keyword "analisis crypto" ($500/bulan awal)
3. Partnership dengan Indodax, Pintu, Tokocrypto
4. Referral program: ajak teman → 1 bulan Pro gratis

### A/B testing roadmap

| Test | Variasi A | Variasi B | Metric |
|---|---|---|---|
| Landing page headline | "Analisis Crypto Jadi Mudah" | "Tau Kapan Harus Beli & Jual Crypto" | Signup rate |
| Onboarding | Langsung ke dashboard | 3-step wizard | Activation rate (buka 3+ chart) |
| Pricing | Free + Pro Rp89k | Trial 14 hari + Pro Rp89k | Conversion berbayar 30 hari |
| CTA button | "Coba Gratis" (biru, bawah hero) | "Lihat Sinyal Hari Ini →" (kuning, sticky) | CTR + bounce rate |

**Aturan A/B testing:**
- Satu perubahan per test — jangan ubah dua elemen sekaligus
- Significance level 95% (p-value < 0.05) sebelum declare winner
- Minimal 1.000 visitor per variasi
- Jangan stop lebih awal meski hasil sudah bagus di hari ke-3
- Urutan: activation → retention → monetization

---

## 9. Budget & Timeline

### Budget bulanan

| Fase | Periode | Estimasi/bulan |
|---|---|---|
| Pre-launch + Soft launch | Bulan 1–4 | Rp 12–15 juta |
| Public launch + Scale | Bulan 5–12 | Rp 33–41 juta |

#### Breakdown Fase 1–2 (Bulan 1–4)

| Item | Biaya |
|---|---|
| Tools (analytics, email, hosting) | Rp 1,2 juta |
| Content creation (desainer, copywriter) | Rp 3 juta |
| KOL / Influencer (2–3 micro) | Rp 5 juta |
| Komunitas & event online | Rp 1 juta |
| Iklan sosial media (testing kecil) | Rp 2 juta |
| **Total** | **~Rp 12–15 juta** |

#### Breakdown Fase 3 (Bulan 5–12)

| Item | Biaya |
|---|---|
| Tools & infrastruktur (scale) | Rp 3 juta |
| Content team (part-time 2 orang) | Rp 8 juta |
| KOL + partnership | Rp 10 juta |
| Google Ads + Meta Ads | Rp 7–15 juta |
| SEO (link building, artikel) | Rp 5 juta |
| **Total** | **~Rp 33–41 juta** |

### Target pertumbuhan

| Milestone | User | Berbayar (15%) | Est. MRR |
|---|---|---|---|
| Akhir bulan 6 | 2.000 | 300 | Rp 26,7 juta |
| Akhir bulan 12 | 10.000 | 1.500 | Rp 133 juta |

### Timeline 12 bulan

| Aktivitas | M1 | M2 | M3 | M4 | M5 | M6 | M7–M12 |
|---|---|---|---|---|---|---|---|
| Validasi & riset | ✓ | ✓ | | | | | |
| Landing + Waitlist | ✓ | ✓ | ✓ | | | | |
| Build backend engine | ✓ | ✓ | ✓ | ✓ | | | |
| Build frontend | | | ✓ | ✓ | | | |
| Komunitas awal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Soft launch | | | ✓ | ✓ | | | |
| KOL activation | | | ✓ | ✓ | ✓ | ✓ | ✓ |
| Content engine | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Public launch | | | | | ✓ | | |
| Paid ads | | | | | ✓ | ✓ | ✓ |
| SEO compound | | | ✓ | ✓ | ✓ | ✓ | ✓ |
| Partnership | | | | | | ✓ | ✓ |

---

## 10. SEO Strategy

### Keyword clusters

#### Cluster 1 — Sinyal Trading (High Intent)
- `analisis crypto hari ini`
- `sinyal bitcoin hari ini`
- `crypto bullish atau bearish`
- `prediksi bitcoin minggu ini`

#### Cluster 2 — Chart & Tools (High Intent)
- `chart bitcoin real time`
- `harga crypto live`
- `crypto chart indonesia`
- `indikator trading crypto`

#### Cluster 3 — Edukasi (Top of Funnel)
- `cara analisis crypto pemula`
- `belajar trading crypto`
- `apa itu RSI crypto`
- `crypto market sentiment`

### Keyword peluang tinggi

| Keyword | Opportunity | Target timeline |
|---|---|---|
| "analisis crypto harian Indonesia" | Volume tinggi, kompetisi rendah | Bulan 3–6 |
| "sinyal bullish bearish crypto" | Belum ada halaman dedicated | Bulan 2–4 |
| "tradingview alternatif indonesia" | Niche, high-intent | Bulan 4–6 |
| "harga bitcoin hari ini" | Sangat kompetitif — hindari dulu | Bulan 9+ |

### Content calendar — bulanan

| Minggu | Konten | Tujuan |
|---|---|---|
| W1 | Weekly Market Recap — update tiap Senin | Ranking evergreen + freshness signal |
| W2 | Pillar content 2.000+ kata — target featured snippet | Topical authority |
| W3 | Coin Spotlight — analisis coin trending | Traffic spike dari search trending |
| W4 | Edukasi + internal link ke tool | Topical authority + funnel ke product |

### Technical SEO checklist

- [ ] Core Web Vitals: LCP < 2.5s, CLS < 0.1
- [ ] Schema markup: `FinancialProduct` + `Article` di setiap halaman
- [ ] Sitemap XML + robots.txt
- [ ] Mobile-first design (70%+ crypto user via HP)
- [ ] Canonical URL untuk halaman chart dinamis (hindari duplicate content)
- [ ] Open Graph tags untuk sharing di Twitter/Telegram

### Off-page SEO — link building

| Taktik | Target | Frekuensi |
|---|---|---|
| Guest post | Indodax Blog, Medium crypto ID, Kompas Tekno | 1–2 artikel/bulan |
| PR / narasumber | Media mainstream Indonesia | 1×/bulan |
| Resource page outreach | Blog "tools crypto" populer | Ongoing |

**Target:** DA 30+ di bulan 6, minimum 20 backlink berkualitas.

### SEO targets

| Metric | Bulan 6 | Bulan 12 |
|---|---|---|
| Organic traffic | 3.000 visit/bulan | 12.000 visit/bulan |
| Keywords ranked (posisi 1–20) | 50+ | 200+ |
| Conversion SEO → signup | 3–5% | 3–5% |

---

## Referensi & Tools

| Kebutuhan | Tool / Resource |
|---|---|
| Kalkulasi indikator Python | [pandas-ta](https://github.com/twopirllc/pandas-ta) |
| Chart frontend | [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts) |
| Exchange WebSocket | [Binance WebSocket API](https://binance-docs.github.io/apidocs/spot/en/#websocket-market-streams) |
| Fear & Greed | [Alternative.me API](https://alternative.me/crypto/fear-and-greed-index/) |
| Funding rate | [Coinalyze API](https://coinalyze.net/api/) |
| A/B testing | [abtestguide.com calculator](https://abtestguide.com/calc/) |
| Hosting backend | [Railway.app](https://railway.app) |
| Hosting frontend | [Vercel](https://vercel.com) |

---

*Dokumen ini adalah living document — update setiap sprint berdasarkan feedback dan data aktual.*