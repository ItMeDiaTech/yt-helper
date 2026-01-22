import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync, statSync } from 'fs'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import log from 'electron-log'
import { VideoInfo, DownloadOptions, DownloadProgress } from '../shared/types'

// Minimum expected size for the bundled executable (in bytes)
const MIN_EXE_SIZE = 10 * 1024 * 1024 // 10 MB

export class PythonBridge extends EventEmitter {
  private process: ChildProcess | null = null
  private port: number = 0
  private ready: boolean = false
  private ws: WebSocket | null = null
  private starting: boolean = false
  private shouldRestart: boolean = true
  private retryCount: number = 0
  private maxRetries: number = 3
  private lastError: string = ''
  private outputBuffer: string[] = []

  async start(): Promise<void> {
    if (this.starting || this.ready) {
      log.info('Python bridge already starting or ready')
      return
    }

    this.starting = true
    this.shouldRestart = true
    this.outputBuffer = []

    try {
      this.port = await this.findAvailablePort()
      const { pythonPath, args, env } = this.getPythonCommand()

      log.info(`Starting Python server on port ${this.port}`)
      log.info(`Python command: ${pythonPath}`)
      log.info(`Arguments: ${args.join(' ')}`)

      // Verify Python/executable exists and has valid size
      if (!existsSync(pythonPath)) {
        throw new Error(`Python executable not found at: ${pythonPath}`)
      }

      // In production, verify the executable size
      if (!is.dev) {
        const stats = statSync(pythonPath)
        if (stats.size < MIN_EXE_SIZE) {
          throw new Error(
            `Python executable appears corrupt (size: ${stats.size} bytes, expected > ${MIN_EXE_SIZE})`
          )
        }
        log.info(`Executable size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`)
      }

      this.process = spawn(pythonPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...env, PYTHONUNBUFFERED: '1' },
        windowsHide: true
      })

      // Capture stdout for diagnostics
      this.process.stdout?.on('data', (data) => {
        const output = data.toString().trim()
        log.info(`Python: ${output}`)
        this.outputBuffer.push(output)
        // Keep buffer limited
        if (this.outputBuffer.length > 100) {
          this.outputBuffer.shift()
        }
      })

      // Capture stderr for error diagnostics
      this.process.stderr?.on('data', (data) => {
        const output = data.toString().trim()
        log.error(`Python Error: ${output}`)
        this.lastError = output
        this.outputBuffer.push(`[ERROR] ${output}`)
        if (this.outputBuffer.length > 100) {
          this.outputBuffer.shift()
        }
      })

      this.process.on('error', (error) => {
        log.error('Failed to start Python process:', error)
        this.lastError = error.message
        this.ready = false
        this.starting = false
        this.emit('status', {
          ready: false,
          error: `Failed to start backend: ${error.message}`
        })
      })

      this.process.on('exit', (code, signal) => {
        log.info(`Python process exited with code ${code}, signal ${signal}`)

        // Log the last few lines of output for debugging
        if (code !== 0) {
          log.error('Process output before exit:')
          this.outputBuffer.slice(-20).forEach((line) => log.error(`  ${line}`))
        }

        this.ready = false
        this.starting = false
        this.ws?.close()
        this.ws = null

        // Auto-restart with exponential backoff
        if (this.shouldRestart && code !== 0 && code !== null) {
          this.retryCount++

          if (this.retryCount <= this.maxRetries) {
            const delay = Math.min(2000 * Math.pow(2, this.retryCount - 1), 16000)
            log.info(
              `Attempting restart ${this.retryCount}/${this.maxRetries} in ${delay}ms...`
            )

            this.emit('status', {
              ready: false,
              error: `Backend crashed. Retrying (${this.retryCount}/${this.maxRetries})...`
            })

            setTimeout(() => this.start(), delay)
          } else {
            log.error(`Max retries (${this.maxRetries}) exceeded, giving up`)
            this.emit('status', {
              ready: false,
              error: `Backend failed to start after ${this.maxRetries} attempts. Last error: ${this.lastError || 'Unknown error'}`
            })
          }
        }
      })

      await this.waitForServer()
      this.connectWebSocket()
      this.ready = true
      this.starting = false
      this.retryCount = 0 // Reset retry count on success
      this.emit('status', { ready: true })
      log.info('Python backend started successfully')
    } catch (error) {
      this.starting = false
      this.ready = false
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.lastError = errorMessage
      log.error('Failed to start Python bridge:', error)

      // Log output buffer for debugging
      log.error('Process output:')
      this.outputBuffer.slice(-20).forEach((line) => log.error(`  ${line}`))

      this.emit('status', { ready: false, error: errorMessage })
      throw error
    }
  }

  stop(): void {
    log.info('Stopping Python bridge...')
    this.shouldRestart = false
    this.ready = false
    this.retryCount = 0

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    if (this.process) {
      // Try graceful shutdown first
      this.process.kill('SIGTERM')

      // Force kill after timeout
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          log.warn('Force killing Python process')
          this.process.kill('SIGKILL')
        }
      }, 3000)

      this.process = null
    }
  }

  isReady(): boolean {
    return this.ready
  }

  getPort(): number {
    return this.port
  }

  getLastError(): string {
    return this.lastError
  }

  getOutputBuffer(): string[] {
    return [...this.outputBuffer]
  }

  private getPythonCommand(): { pythonPath: string; args: string[]; env: Record<string, string> } {
    const env: Record<string, string> = {}

    if (is.dev) {
      // Development: use virtual environment Python
      const appPath = app.getAppPath()
      const venvPython =
        process.platform === 'win32'
          ? join(appPath, 'python', 'venv', 'Scripts', 'python.exe')
          : join(appPath, 'python', 'venv', 'bin', 'python')

      const serverScript = join(appPath, 'python', 'server.py')

      // Check if venv exists, fall back to system Python
      if (existsSync(venvPython)) {
        return {
          pythonPath: venvPython,
          args: [serverScript, '--port', String(this.port)],
          env
        }
      }

      // Fallback to system Python
      log.warn('Virtual environment not found, using system Python')
      const systemPython = process.platform === 'win32' ? 'python' : 'python3'
      return {
        pythonPath: systemPython,
        args: [serverScript, '--port', String(this.port)],
        env
      }
    }

    // Production: use bundled executable
    const exeName = process.platform === 'win32' ? 'yt-helper-backend.exe' : 'yt-helper-backend'
    const pythonPath = join(process.resourcesPath, 'python', exeName)

    // Set PATH to include ffmpeg directory
    const ffmpegDir = join(process.resourcesPath, 'ffmpeg')
    if (existsSync(ffmpegDir)) {
      env['PATH'] = ffmpegDir + (process.platform === 'win32' ? ';' : ':') + (process.env.PATH || '')
      log.info(`Added ffmpeg to PATH: ${ffmpegDir}`)
    } else {
      log.warn(`FFmpeg directory not found at: ${ffmpegDir}`)
    }

    return {
      pythonPath,
      args: ['--port', String(this.port)],
      env
    }
  }

  private async findAvailablePort(): Promise<number> {
    const net = await import('net')
    return new Promise((resolve, reject) => {
      const server = net.createServer()
      server.unref()
      server.on('error', reject)
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        if (address && typeof address === 'object') {
          const port = address.port
          server.close(() => resolve(port))
        } else {
          reject(new Error('Could not allocate port'))
        }
      })
    })
  }

  private async waitForServer(maxAttempts: number = 60, intervalMs: number = 500): Promise<void> {
    log.info('Waiting for Python server to be ready...')

    for (let i = 0; i < maxAttempts; i++) {
      // Check if process is still running
      if (this.process?.killed || this.process?.exitCode !== null) {
        const exitCode = this.process?.exitCode
        throw new Error(
          `Python process terminated unexpectedly (exit code: ${exitCode}). ` +
            `Last error: ${this.lastError || 'Check logs for details'}`
        )
      }

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 1000)

        const response = await fetch(`http://127.0.0.1:${this.port}/api/health`, {
          signal: controller.signal
        })

        clearTimeout(timeout)

        if (response.ok) {
          log.info(`Python server ready after ${(i + 1) * intervalMs}ms`)
          return
        }
      } catch {
        // Server not ready yet, continue waiting
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }

    throw new Error(`Python server failed to start after ${maxAttempts * intervalMs}ms`)
  }

  private connectWebSocket(): void {
    if (this.ws) {
      this.ws.close()
    }

    const wsUrl = `ws://127.0.0.1:${this.port}/ws/progress`
    log.info(`Connecting WebSocket to ${wsUrl}`)

    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      log.info('WebSocket connected')
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as DownloadProgress
        if (data.status === 'complete') {
          this.emit('complete', data)
        } else if (data.status === 'error') {
          this.emit('error', data)
        } else {
          this.emit('progress', data)
        }
      } catch (error) {
        log.error('Failed to parse WebSocket message:', error)
      }
    }

    this.ws.onerror = (error) => {
      log.error('WebSocket error:', error)
    }

    this.ws.onclose = (event) => {
      log.info(`WebSocket closed: code=${event.code}, reason=${event.reason}`)
      this.ws = null

      // Reconnect if server is still supposed to be running
      if (this.ready && this.shouldRestart) {
        log.info('Reconnecting WebSocket in 2 seconds...')
        setTimeout(() => {
          if (this.ready) {
            this.connectWebSocket()
          }
        }, 2000)
      }
    }
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    if (!this.ready) {
      throw new Error('Python server is not ready')
    }

    const url = `http://127.0.0.1:${this.port}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${response.status}`)
    }

    return data as T
  }

  async getVideoInfo(url: string): Promise<VideoInfo> {
    return this.request<VideoInfo>('/api/video/info', {
      method: 'POST',
      body: JSON.stringify({ url })
    })
  }

  async startDownload(options: DownloadOptions): Promise<{ downloadId: string }> {
    return this.request<{ downloadId: string }>('/api/download/start', {
      method: 'POST',
      body: JSON.stringify(options)
    })
  }

  async cancelDownload(downloadId: string): Promise<void> {
    await this.request<{ status: string }>('/api/download/cancel', {
      method: 'POST',
      body: JSON.stringify({ downloadId })
    })
  }
}
