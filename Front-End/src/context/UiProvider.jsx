import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { UiContext } from './uiContext.js'

function ToastHost({ toasts, remove }) {
  if (!toasts.length) return null
  return createPortal(
    <div className="ui-toast-host" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <div key={t.id} className={`ui-toast ui-toast-${t.type || 'info'}`} role="status">
          <div className="ui-toast-body">{t.message}</div>
          <button type="button" className="ui-toast-close" onClick={() => remove(t.id)} aria-label="Đóng">
            ×
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null
  return createPortal(
    <div className="ui-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="ui-modal" role="dialog" aria-modal="true" aria-label={title || 'Hộp thoại'} onMouseDown={(e) => e.stopPropagation()}>
        {title ? <div className="ui-modal-title">{title}</div> : null}
        <div className="ui-modal-content">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function UiProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const toastTimersRef = useRef(new Map())

  const [confirmState, setConfirmState] = useState(null)
  const confirmResolveRef = useRef(null)

  const [promptState, setPromptState] = useState(null)
  const promptResolveRef = useRef(null)

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timers = toastTimersRef.current
    const tm = timers.get(id)
    if (tm) clearTimeout(tm)
    timers.delete(id)
  }, [])

  const toast = useCallback(
    (message, opts = {}) => {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`
      const t = { id, message: String(message || ''), type: opts.type || 'info' }
      setToasts((prev) => [t, ...prev].slice(0, 5))
      const durationMs = Number.isFinite(opts.durationMs) ? opts.durationMs : 3500
      if (durationMs > 0) {
        const tm = setTimeout(() => removeToast(id), durationMs)
        toastTimersRef.current.set(id, tm)
      }
      return id
    },
    [removeToast],
  )

  const confirm = useCallback((opts) => {
    const o = {
      title: opts?.title || 'Xác nhận',
      message: opts?.message || 'Bạn có chắc chắn?',
      confirmText: opts?.confirmText || 'Đồng ý',
      cancelText: opts?.cancelText || 'Hủy',
      tone: opts?.tone || 'default',
    }
    setConfirmState(o)
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve
    })
  }, [])

  const prompt = useCallback((opts) => {
    const o = {
      title: opts?.title || 'Nhập thông tin',
      label: opts?.label || 'Giá trị',
      placeholder: opts?.placeholder || '',
      defaultValue: opts?.defaultValue || '',
      confirmText: opts?.confirmText || 'Xác nhận',
      cancelText: opts?.cancelText || 'Hủy',
      required: Boolean(opts?.required),
    }
    setPromptState(o)
    return new Promise((resolve) => {
      promptResolveRef.current = resolve
    })
  }, [])

  const value = useMemo(
    () => ({
      toast: {
        info: (m, o) => toast(m, { ...o, type: 'info' }),
        success: (m, o) => toast(m, { ...o, type: 'success' }),
        error: (m, o) => toast(m, { ...o, type: 'error' }),
        warn: (m, o) => toast(m, { ...o, type: 'warn' }),
      },
      confirm,
      prompt,
    }),
    [confirm, prompt, toast],
  )

  return (
    <UiContext.Provider value={value}>
      {children}

      <ToastHost toasts={toasts} remove={removeToast} />

      <Modal
        open={Boolean(confirmState)}
        title={confirmState?.title}
        onClose={() => {
          setConfirmState(null)
          confirmResolveRef.current?.(false)
          confirmResolveRef.current = null
        }}
      >
        <p style={{ marginTop: 0 }}>{confirmState?.message}</p>
        <div className="ui-modal-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setConfirmState(null)
              confirmResolveRef.current?.(false)
              confirmResolveRef.current = null
            }}
          >
            {confirmState?.cancelText || 'Hủy'}
          </button>
          <button
            type="button"
            className="btn-primary-pele"
            onClick={() => {
              setConfirmState(null)
              confirmResolveRef.current?.(true)
              confirmResolveRef.current = null
            }}
          >
            {confirmState?.confirmText || 'Đồng ý'}
          </button>
        </div>
      </Modal>

      <PromptModal
        state={promptState}
        onCancel={() => {
          setPromptState(null)
          promptResolveRef.current?.(null)
          promptResolveRef.current = null
        }}
        onSubmit={(val) => {
          setPromptState(null)
          promptResolveRef.current?.(val)
          promptResolveRef.current = null
        }}
      />
    </UiContext.Provider>
  )
}

function PromptModal({ state, onCancel, onSubmit }) {
  const [val, setVal] = useState('')

  useEffect(() => {
    if (!state) return
    setVal(state.defaultValue || '')
  }, [state])

  return (
    <Modal open={Boolean(state)} title={state?.title} onClose={onCancel}>
      <form
        className="ui-modal-form"
        onSubmit={(e) => {
          e.preventDefault()
          const v = String(val || '').trim()
          if (state?.required && !v) return
          onSubmit(v)
        }}
        noValidate
      >
        <label className="ui-modal-label">{state?.label}</label>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={state?.placeholder || ''}
          style={{ width: '100%' }}
        />
        <div className="ui-modal-actions">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            {state?.cancelText || 'Hủy'}
          </button>
          <button type="submit" className="btn-primary-pele">
            {state?.confirmText || 'Xác nhận'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

