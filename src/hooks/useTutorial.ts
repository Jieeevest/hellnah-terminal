import { useState, useCallback } from 'react'

const STORAGE_KEY = 'hellnah-terminal-tutorial-seen'

export function useTutorial() {
  const [isActive, setIsActive] = useState(() => !localStorage.getItem(STORAGE_KEY))
  const [currentStep, setCurrentStep] = useState(0)

  const nextStep = useCallback((total: number) => {
    setCurrentStep(prev => {
      if (prev >= total - 1) {
        setIsActive(false)
        localStorage.setItem(STORAGE_KEY, '1')
        return prev
      }
      return prev + 1
    })
  }, [])

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1))
  }, [])

  const skip = useCallback(() => {
    setIsActive(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }, [])

  const restart = useCallback(() => {
    setCurrentStep(0)
    setIsActive(true)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return { isActive, currentStep, nextStep, prevStep, skip, restart }
}
