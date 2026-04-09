import { useContext } from 'react'
import { UiContext } from './uiContext.js'

export function useUi() {
  const ctx = useContext(UiContext)
  if (!ctx) throw new Error('useUi phải được dùng bên trong <UiProvider>.')
  return ctx
}

