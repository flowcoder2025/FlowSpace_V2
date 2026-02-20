#!/usr/bin/env node
/**
 * Cross-platform LiveKit server launcher
 */
const { spawn } = require('child_process')
const path = require('path')

const isWindows = process.platform === 'win32'
const serverPath = path.join(__dirname, '..', 'bin', isWindows ? 'livekit-server.exe' : 'livekit-server')
const configPath = path.join(__dirname, '..', 'livekit.yaml')

console.log('[LiveKit] Starting server...')
console.log('[LiveKit] Binary:', serverPath)
console.log('[LiveKit] Config:', configPath)

const child = spawn(serverPath, ['--dev', '--config', configPath], {
  stdio: 'inherit',
  shell: false
})

child.on('error', (err) => {
  console.error('[LiveKit] Failed to start:', err.message)
  process.exit(1)
})

child.on('close', (code) => {
  process.exit(code || 0)
})
