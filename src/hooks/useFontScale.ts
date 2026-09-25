import { useState, useEffect } from 'react'

// Key diganti tiap default berubah (sekarang v4: 90), key lama sengaja ditinggal biar nilai lama yang
// tersimpan otomatis dari versi sebelumnya gak nimpa default baru.
const STORAGE_KEY = 'hellnah-font-scale-v4'
export const FONT_SCALES = [60, 70, 80, 90, 100, 112, 125]
const DEFAULT_SCALE = 90

function readStoredScale(): number {
  const stored = Number(localStorage.getItem(STORAGE_KEY))
  return FONT_SCALES.includes(stored) ? stored : DEFAULT_SCALE
}

function applyScale(scale: number) {
  document.documentElement.style.fontSize = `${scale}%`
}

// Dipasang saat modul di-import (bukan nunggu Dashboard mount) supaya halaman lain
// juga langsung pakai skala tersimpan tanpa kedip ukuran default dulu.
applyScale(readStoredScale())

export function useFontScale() {
  const [scale, setScale] = useState(readStoredScale)

  useEffect(() => {
    applyScale(scale)
    localStorage.setItem(STORAGE_KEY, String(scale))
  }, [scale])

  const idx = FONT_SCALES.indexOf(scale)
  return {
    scale,
    canDecrease: idx > 0,
    canIncrease: idx < FONT_SCALES.length - 1,
    decrease: () => setScale(FONT_SCALES[Math.max(0, idx - 1)]),
    increase: () => setScale(FONT_SCALES[Math.min(FONT_SCALES.length - 1, idx + 1)]),
  }
}
