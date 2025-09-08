// Test CSV parsing function
function parseCSVLine(line) {
    const result = []
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

// Test cases
const testLines = [
    '"Avenida Lopez Godoy, Ruta 1, Km. 20",Capiata,Other,7739778244/7739778244',
    'caleradelsur95@gmail.com casa,virgen del rosario y parana -general artigas,itapua,0985728119/0985728119',
    '"Paseo del yatch y Del Cerro Edificio Excellence Piso 15 A",Lambare,Central,+595/981511693',
    '"Carlos antonio lopez c/ Constitucion Nacional S3-C2",Encarnacion,Itapua,981177738/981177738'
]

console.log('Testing CSV parsing:')
testLines.forEach((line, index) => {
    console.log(`\nLine ${index + 1}: ${line}`)
    const parsed = parseCSVLine(line)
    console.log('Parsed:', parsed)
    console.log('Fields:', {
        address: parsed[0],
        city: parsed[1],
        state: parsed[2],
        phone: parsed[3]
    })
})

// Test OpenAI response parsing
const openaiResponse = `"Avenida López Godoy, Ruta 1, Km 20","Capiatá","Central","+5957739778244",""`

console.log('\n\nTesting OpenAI response parsing:')
console.log('Response:', openaiResponse)
const parsed = parseCSVLine(openaiResponse)
console.log('Parsed:', parsed)
console.log('Fields:', {
    address: parsed[0],
    city: parsed[1],
    state: parsed[2],
    phone: parsed[3],
    email: parsed[4]
})
