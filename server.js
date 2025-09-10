// Entry point that uses tsx to run TypeScript backend
import { spawn } from 'child_process'

console.log('Starting GeoNorm backend via tsx...')

const backend = spawn('npx', ['tsx', 'backend/index.ts'], {
    stdio: 'inherit',
    env: { ...process.env }
})

backend.on('error', (error) => {
    console.error('Failed to start backend:', error)
    process.exit(1)
})

backend.on('exit', (code) => {
    console.log(`Backend process exited with code ${code}`)
    process.exit(code || 0)
})

// Forward signals
process.on('SIGTERM', () => {
    console.log('Forwarding SIGTERM to backend')
    backend.kill('SIGTERM')
})

process.on('SIGINT', () => {
    console.log('Forwarding SIGINT to backend')
    backend.kill('SIGINT')
})
