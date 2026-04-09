export function parseSeats(text) {
  if (!text) return []
  return String(text)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function uniqueSeats(seats) {
  return Array.from(new Set((seats || []).map((s) => String(s).trim()).filter(Boolean))).sort()
}

