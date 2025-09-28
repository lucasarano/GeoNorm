export function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
        const char = line[i]

        if (char === '"') {
            inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ''))
            current = ''
        } else {
            current += char
        }
    }
    result.push(current.trim().replace(/^"|"$/g, ''))
    return result
}

export function parseCSV(csvData: string): string[][] {
    const lines = csvData.trim().split('\n')
    return lines.map(line => parseCSVLine(line))
}
