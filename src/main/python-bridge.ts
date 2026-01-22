import { EventEmitter } from 'events'
import { spawn, ChildProcess, execSync } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import log from 'electron-log'
import { VideoInfo, DownloadOptions, DownloadProgress } from '../shared/types'

export class PythonBridge extends EventEmitter {
  private process: ChildProcess | null = null
  private port: number = 0
  private ready: boolean = false
  private ws: WebSocket | null = null
  private starting: boolean = false
  private shouldRestart: boolean = true

  async start(): Promise<void> {
    if (this.starting || this.ready) {
      log.info('Python bridge already starting or ready')
      return
    }

    this.starting = true
    this.shouldRestart = true

    try {
      this.port = await this.findAvailablePort()
      const { pythonPath, args } = this.getPythonCommand()

      log.info(`Starting Python server on port ${this.port}`)
      log.info(`Python command: ${pythonPath}`)
      log.info(`Arguments: ${args.join(' ')}`)

      // Verify Python/executable exists
      if (!existsSync(pythonPath)) {
        throw new Error(`Python executable not found at: ${pythonPath}`)
      }

      this.process = spawn(pythonPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
        windowsHide: true
      })

      this.process.stdout?.on('data', (data) => {
        log.info(`Python: ${data.toString().trim()}`)
      })

      this.process.stderr?.on('data', (data) => {
        log.error(`Python Error: ${data.toString().trim()}`)
      })

      this.process.on('error', (error) => {
        log.error('Failed to start Python process:', error)
        this.ready = false
        this.starting = false
        this.emit('status', { ready: false, error: error.message })
      })

      this.process.on('exit', (code, signal) => {
        log.info(`Python process exited with code ${code}, signal ${signal}`)
        this.ready = false
        this.starting = false
        this.ws?.close()
        this.ws = null

        // Auto-restart if unexpected exit and app is still running
        if (this.shouldRestart && code !== 0 && code !== null) {
          log.info('Attempting to restart Python server in 2 seconds...')
          setTimeout(() => this.start(), 2000)
        }
      })

      await this.waitForServer()
      this.connectWebSocket()
      this.ready = true
      this.starting = false
      this.emit('status', { ready: true })
      log.info('Python backend started successfully')
    } catch (error) {
      this.starting = false
      this.ready = false
      log.error('Failed to start Python bridge:', error)
      this.emit('status', { ready: false, error: String(error) })
      throw error
    }
  }

  stop(): void {
    log.info('Stopping Python bridge...')
    this.shouldRestart = false
    this.ready = false

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

  private getPythonCommand(): { pythonPath: string; args: string[] } {
    if (is.dev) {
      // Development: use virtual environment Python
      const appPath = app.getAppPath()
      const venvPython = process.platform === 'win32'
        ? join(appPath, 'python', 'venv', 'Scripts', 'python.exe')
        : join(appPath, 'python', 'venv', 'bin', 'python')

      const serverScript = join(appPath, 'python', 'server.py')

      // Check if venv exists, fall back to system Python
      if (existsSync(venvPython)) {
        return {
          pythonPath: venvPython,
          args: [serverScript, '--port', String(this.port)]
        }
      }

      // Fallback to system Python
      log.warn('Virtual environment not found, using system Python')
      const systemPython = process.platform === 'win32' ? 'python' : 'python3'
      return {
        pythonPath: systemPython,
        args: [serverScript, '--port', String(this.port)]
      }
    }

    // Production: use bundled executable
    const exeName = process.platform === 'win32' ? 'yt-helper-backend.exe' : 'yt-helper-backend'
    return {
      pythonPath: join(process.resourcesPath, 'python', exeName),
      args: ['--port', String(this.port)]
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
        throw new Error('Python process terminated unexpectedly')
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

      await new Promise(resolve => setTimeout(resolve, intervalMs))
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
