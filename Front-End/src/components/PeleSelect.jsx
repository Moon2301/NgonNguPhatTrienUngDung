import { useEffect, useId, useMemo, useRef, useState } from 'react'

export default function PeleSelect({ label, value, onChange, options, required }) {
  const id = useId()
  const btnRef = useRef(null)
  const listRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const selected = useMemo(() => options.find((o) => String(o.value) === String(value)) || null, [options, value])

  useEffect(() => {
    if (!open) return
    function onDocDown(e) {
      const t = e.target
      if (btnRef.current?.contains(t)) return
      if (listRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const idx = Math.max(
      0,
      options.findIndex((o) => String(o.value) === String(value))
    )
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync active option when dropdown opens
    setActiveIndex(idx === -1 ? 0 : idx)
  }, [open, options, value])

  function pick(opt) {
    onChange?.(String(opt.value))
    setOpen(false)
    btnRef.current?.focus()
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) return setOpen(true)
      setActiveIndex((i) => Math.min(options.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return setOpen(true)
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!open) return setOpen(true)
      const opt = options[activeIndex]
      if (opt) pick(opt)
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        setOpen(false)
      }
    }
  }

  return (
    <div className="pele-select">
      {label && (
        <label htmlFor={id} className="pele-select__label">
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </label>
      )}

      <button
        id={id}
        ref={btnRef}
        type="button"
        className="pele-select__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className="pele-select__value">{selected?.label || '—'}</span>
        <span className="pele-select__chev" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div
          ref={listRef}
          id={`${id}-list`}
          className="pele-select__list"
          role="listbox"
          aria-label={label || 'Chọn'}
        >
          {options.map((o, idx) => {
            const isSelected = String(o.value) === String(value)
            const isActive = idx === activeIndex
            return (
              <button
                key={String(o.value)}
                type="button"
                className={`pele-select__option${isSelected ? ' is-selected' : ''}${isActive ? ' is-active' : ''}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => pick(o)}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

