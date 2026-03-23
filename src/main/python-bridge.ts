import { EventEmitter } from 'events'
import { randomBytes } from 'crypto'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync, statSync } from 'fs'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import log from 'electron-log'
import { VideoInfo, DownloadOptions, DownloadProgress } from '../shared/types'

// Minimum expected size for the bundled executable (in bytes)
const MIN_EXE_SIZE = 10 * 1024 * 1024 // 10 MB
const POLL_INTERVAL = 500 // Poll every 500ms
const HEARTBEAT_INTERVAL = 15000 // Check health every 15s when idle
const DEFAULT_TIMEOUT = 30000 // 30s default request timeout
const VIDEO_INFO_TIMEOUT = 60000 // 60s for video info (yt-dlp can be slow)

export class PythonBridge extends EventEmitter {
  private process: ChildProcess | null = null
  private port: number = 0
  private ready: boolean = false
  private starting: boolean = false
  private shouldRestart: boolean = true
  private retryCount: number = 0
  private maxRetries: number = 3
  private lastError: string = ''
  private outputBuffer: string[] = []
  private pollInterval: NodeJS.Timeout | null = null
  private heartbeatInterval: NodeJS.Timeout | null = null
  private activeDownloads: Set<string> = new Set()
  private apiToken: string = ''

  async start(): Promise<void> {
    if (this.starting || this.ready) {
      log.info('Python bridge already starting or ready')
      return
    }

    this.starting = true
    this.shouldRestart = true
    this.outputBuffer = []

    // Generate API token for this session
    this.apiToken = randomBytes(32).toString('hex')

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

      // Build a minimal environment for the child process
      const safeEnv: Record<string, string> = {
        PATH: process.env.PATH || '',
        PYTHONUNBUFFERED: '1',
        YT_HELPER_API_TOKEN: this.apiToken,
        ...env
      }

      // Include platform-specific required env vars
      if (process.platform === 'win32') {
        if (process.env.SystemRoot) safeEnv.SystemRoot = process.env.SystemRoot
        if (process.env.APPDATA) safeEnv.APPDATA = process.env.APPDATA
        if (process.env.LOCALAPPDATA) safeEnv.LOCALAPPDATA = process.env.LOCALAPPDATA
        if (process.env.TEMP) safeEnv.TEMP = process.env.TEMP
        if (process.env.TMP) safeEnv.TMP = process.env.TMP
        if (process.env.USERPROFILE) safeEnv.USERPROFILE = process.env.USERPROFILE
      } else {
        if (process.env.HOME) safeEnv.HOME = process.env.HOME
        if (process.env.TMPDIR) safeEnv.TMPDIR = process.env.TMPDIR
      }

      this.process = spawn(pythonPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: safeEnv,
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
        this.stopHeartbeat()
        this.emit('status', {
          ready: false,
          error: `Failed to start backend: ${error.message}`
        })
      })

      this.process.on('exit', (code, signal) => {
        log.info(`Python process exited with code ${code}, signal ${signal}`)

        const wasStarting = this.starting
        const wasReady = this.ready

        // Log the last few lines of output for debugging
        if (code !== 0) {
          log.error('Process output before exit:')
          this.outputBuffer.slice(-20).forEach((line) => log.error(`  ${line}`))
        }

        this.ready = false
        this.starting = false
        this.stopPolling()
        this.stopHeartbeat()

        // Auto-restart with exponential backoff for non-zero exits
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
        } else if (wasStarting || wasReady) {
          // Process exited with code 0 or was killed by signal while starting/running
          // Emit status so the UI doesn't stay stuck on the loading screen
          this.emit('status', {
            ready: false,
            error: `Backend process exited unexpectedly${signal ? ` (signal: ${signal})` : ''}. ${this.lastError || 'Please restart the application.'}`
          })
        }
      })

      await this.waitForServer()
      this.ready = true
      this.starting = false
      this.retryCount = 0 // Reset retry count on success
      this.startHeartbeat()
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

  async stop(): Promise<void> {
    log.info('Stopping Python bridge...')
    this.shouldRestart = false
    this.ready = false
    this.starting = false
    this.retryCount = 0

    this.stopPolling()
    this.stopHeartbeat()

    // Cancel any active downloads via API
    for (const downloadId of this.activeDownloads) {
      try {
        await fetch(`http://127.0.0.1:${this.port}/api/download/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Token': this.apiToken
          },
          body: JSON.stringify({ downloadId })
        })
      } catch {
        // Ignore errors during shutdown
      }
    }
    this.activeDownloads.clear()

    if (!this.process) {
      return
    }

    return new Promise<void>((resolve) => {
      const proc = this.process!

      // Resolve when process exits
      proc.once('exit', () => {
        log.info('Python process terminated')
        this.process = null
        resolve()
      })

      // Try graceful shutdown first
      proc.kill('SIGTERM')

      // Force kill after timeout
      setTimeout(() => {
        if (proc && !proc.killed) {
          log.warn('Force killing Python process')
          proc.kill('SIGKILL')
        }
      }, 3000)

      // Also resolve after max timeout in case exit event doesn't fire
      setTimeout(() => {
        log.info('Shutdown timeout reached')
        this.process = null
        resolve()
      }, 5000)
    })
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

  private startPolling(): void {
    if (this.pollInterval) return

    this.pollInterval = setInterval(async () => {
      if (!this.ready || this.activeDownloads.size === 0) return

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(`http://127.0.0.1:${this.port}/api/download/progress`, {
          signal: controller.signal,
          headers: { 'X-API-Token': this.apiToken }
        })

        clearTimeout(timeout)

        if (response.ok) {
          const progressList = (await response.json()) as DownloadProgress[]

          for (const progress of progressList) {
            if (progress.status === 'complete') {
              this.emit('complete', progress)
              this.activeDownloads.delete(progress.downloadId)
              // Clear from server
              this.clearDownload(progress.downloadId).catch(() => {})
            } else if (progress.status === 'error') {
              this.emit('error', progress)
              this.activeDownloads.delete(progress.downloadId)
              this.clearDownload(progress.downloadId).catch(() => {})
            } else if (progress.status === 'cancelled') {
              this.activeDownloads.delete(progress.downloadId)
              this.clearDownload(progress.downloadId).catch(() => {})
            } else {
              this.emit('progress', progress)
            }
          }

          // Stop polling when no downloads remain
          if (this.activeDownloads.size === 0) {
            this.stopPolling()
          }
        }
      } catch (error) {
        log.error('Error polling progress:', error)
      }
    }, POLL_INTERVAL)

    log.info('Started progress polling')
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
      log.info('Stopped progress polling')
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return

    this.heartbeatInterval = setInterval(async () => {
      if (!this.ready) return
      // Skip heartbeat if polling is active (polls serve as implicit heartbeat)
      if (this.activeDownloads.size > 0) return

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(`http://127.0.0.1:${this.port}/api/health`, {
          signal: controller.signal
        })

        clearTimeout(timeout)

        if (!response.ok) {
          throw new Error(`Health check returned ${response.status}`)
        }
      } catch (error) {
        log.error('Heartbeat failed:', error)
        this.ready = false
        this.stopHeartbeat()
        this.emit('status', {
          ready: false,
          error: 'Backend became unresponsive. Attempting restart...'
        })
        // Kill the unresponsive process before restarting
        if (this.process && !this.process.killed) {
          log.warn('Killing unresponsive Python process before restart')
          this.process.kill('SIGKILL')
          this.process = null
        }
        // Trigger restart
        if (this.shouldRestart && this.retryCount < this.maxRetries) {
          this.retryCount++
          setTimeout(() => this.start(), 2000)
        }
      }
    }, HEARTBEAT_INTERVAL)

    log.info('Started heartbeat monitoring')
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private async clearDownload(downloadId: string): Promise<void> {
    try {
      await fetch(`http://127.0.0.1:${this.port}/api/download/clear/${downloadId}`, {
        method: 'DELETE',
        headers: { 'X-API-Token': this.apiToken }
      })
    } catch {
      // Ignore errors
    }
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

  private async request<T>(
    endpoint: string,
    options?: RequestInit & { timeoutMs?: number }
  ): Promise<T> {
    if (!this.ready) {
      throw new Error('Python server is not ready')
    }

    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const url = `http://127.0.0.1:${this.port}${endpoint}`
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Token': this.apiToken,
          ...options?.headers
        }
      })

      let data: Record<string, unknown>
      try {
        data = await response.json()
      } catch {
        throw new Error(`Backend returned an invalid response (HTTP ${response.status})`)
      }

      if (!response.ok) {
        throw new Error(
          (data.error as string) ||
            (data.message as string) ||
            `Request failed with status ${response.status}`
        )
      }

      return data as T
    } catch (err) {
      // Handle abort (timeout)
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(
          `Request to ${endpoint} timed out after ${timeoutMs / 1000}s. The backend may be overloaded.`
        )
      }
      // Handle connection refused (backend crashed)
      if (err instanceof TypeError && String(err.message).includes('fetch')) {
        this.ready = false
        this.stopHeartbeat()
        this.emit('status', {
          ready: false,
          error: 'Lost connection to backend. It may have crashed.'
        })
        throw new Error('Lost connection to backend. It may have crashed.')
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  async getVideoInfo(url: string): Promise<VideoInfo> {
    return this.request<VideoInfo>('/api/video/info', {
      method: 'POST',
      body: JSON.stringify({ url }),
      timeoutMs: VIDEO_INFO_TIMEOUT
    })
  }

  async startDownload(options: DownloadOptions): Promise<{ downloadId: string }> {
    const result = await this.request<{ downloadId: string }>('/api/download/start', {
      method: 'POST',
      body: JSON.stringify(options)
    })

    // Track this download and start polling
    this.activeDownloads.add(result.downloadId)
    this.startPolling()

    return result
  }

  async cancelDownload(downloadId: string): Promise<void> {
    await this.request<{ status: string }>('/api/download/cancel', {
      method: 'POST',
      body: JSON.stringify({ downloadId })
    })
    this.activeDownloads.delete(downloadId)
  }
}
