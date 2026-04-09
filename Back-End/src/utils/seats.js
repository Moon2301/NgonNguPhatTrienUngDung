export function parseSeats(raw) {
    if (!raw) return [];
    return String(raw)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

export function uniqueSeats(seats) {
    return Array.from(new Set((seats || []).map((s) => String(s).trim()).filter(Boolean)));
}

