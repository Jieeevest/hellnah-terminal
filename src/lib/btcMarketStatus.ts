export type BTCStatusLevel = 'safe' | 'caution' | 'danger'

export interface BTCMarketStatus {
  level: BTCStatusLevel
  label: string
  message: string
}

export function computeBTCMarketStatus(
  btcChange: number | null,
  fgValue: number | null,
): BTCMarketStatus {
  const change = btcChange ?? 0
  const changeStr = `BTC ${change >= 0 ? '+' : ''}${change.toFixed(2)}% (24h)`
  const fgStr = fgValue !== null ? ` · F&G: ${fgValue}` : ''

  if (change <= -5 || (fgValue !== null && fgValue <= 20)) {
    let dangerMsg: string
    if (change <= -5 && fgValue !== null && fgValue <= 20) {
      dangerMsg = `${changeStr}${fgStr}. BTC turun tajam + Extreme Fear — hindari posisi baru, waspadai capitulation.`
    } else if (change <= -5) {
      dangerMsg = `${changeStr}${fgStr}. BTC turun tajam — pertimbangkan kurangi eksposur.`
    } else {
      dangerMsg = `${changeStr}${fgStr}. Extreme Fear — pasar sangat volatil, waspadai false bounce meski harga terlihat naik.`
    }
    return { level: 'danger', label: 'Pasar Berbahaya', message: dangerMsg }
  }

  if (change <= -3 || (fgValue !== null && fgValue <= 30)) {
    const cautionMsg = change <= -3
      ? `${changeStr}${fgStr}. BTC melemah — kelola risiko dengan ketat.`
      : `${changeStr}${fgStr}. Sentimen pasar melemah (Fear) — waspadai volatilitas.`
    return { level: 'caution', label: 'Hati-hati', message: cautionMsg }
  }

  return {
    level: 'safe',
    label: 'Kondisi Normal',
    message: '',
  }
}
