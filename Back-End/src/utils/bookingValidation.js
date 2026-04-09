/**
 * Business rules for seat selection
 */

/**
 * Check if the selected seats are "connected" (Adjacent in 2D space)
 * Allows blocks like 2x2, 1x3, 3x2 etc.
 * @param {string[]} seats - e.g. ['A1', 'A2', 'B1', 'B2']
 * @returns {boolean}
 */
export function areAdjacent(seats) {
    if (seats.length <= 1) return true
    
    const seatSet = new Set(seats)
    const visited = new Set()
    const queue = [seats[0]]
    visited.add(seats[0])

    // BFS to find connected component
    while (queue.length > 0) {
        const current = queue.shift()
        const row = current.charAt(0)
        const col = parseInt(current.substring(1))

        // Possible neighbors: Up, Down, Left, Right
        const neighbors = [
            `${String.fromCharCode(row.charCodeAt(0) - 1)}${col}`,
            `${String.fromCharCode(row.charCodeAt(0) + 1)}${col}`,
            `${row}${col - 1}`,
            `${row}${col + 1}`
        ]

        for (const n of neighbors) {
            if (seatSet.has(n) && !visited.has(n)) {
                visited.add(n)
                queue.push(n)
            }
        }
    }

    // If all selected seats were visited, they are one connected block
    return visited.size === seats.length
}

/**
 * Check if the selection would leave a "lone seat" (gap of 1) in the row.
 * A lone seat is an empty seat whose neighbors are both occupied or wall.
 */
export function leavesLoneSeat(rowId, selectedCols, occupiedCols, totalCols) {
    const finalOccupied = new Set([...occupiedCols, ...selectedCols])
    
    for (let c = 1; c <= totalCols; c++) {
        if (!finalOccupied.has(c)) {
            const leftIsBound = c === 1 || finalOccupied.has(c - 1)
            const rightIsBound = c === totalCols || finalOccupied.has(c + 1)
            
            if (leftIsBound && rightIsBound) {
                return true
            }
        }
    }
    return false
}

/**
 * Friday 18:00 to Sunday 23:59
 */
export function isPeakHour(date = new Date()) {
    const day = date.getDay()
    const hour = date.getHours()
    if (day === 5 && hour >= 18) return true
    if (day === 6 || day === 0) return true
    return false
}

export function getHoldDurationMS(date = new Date()) {
    return isPeakHour(date) ? 3 * 60 * 1000 : 5 * 60 * 1000
}
