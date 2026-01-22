import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import log from 'electron-log'
import Store from 'electron-store'
import { PythonBridge } from './python-bridge'
import { setupAutoUpdater, checkForUpdates } from './updater'
import { IPC_CHANNELS, DownloadOptions } from '../shared/types'

// Configure logging
log.transports.file.level = 'info'
log.transports.console.level = 'debug'

const store = new Store({
  defaults: {
    outputDirectory: app.getPath('downloads'),
    defaultVideoFormat: 'mp4',
    defaultAudioFormat: 'mp3',
    defaultQuality: 'best'
  }
})

let mainWindow: BrowserWindow | null = null
let pythonBridge: PythonBridge | null = null
let isQuitting = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    title: 'YouTube Helper',
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    // Send initial backend status when window is ready
    sendBackendStatus()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function sendBackendStatus(): void {
  const ready = pythonBridge?.isReady() ?? false
  mainWindow?.webContents.send('backend:status', { ready })
}

function setupIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GET_VIDEO_INFO, async (_, url: string) => {
    if (!pythonBridge?.isReady()) {
      throw new Error('Backend is starting up. Please wait...')
    }
    return pythonBridge.getVideoInfo(url)
  })

  ipcMain.handle(IPC_CHANNELS.START_DOWNLOAD, async (_, options: DownloadOptions) => {
    if (!pythonBridge?.isReady()) {
      throw new Error('Backend is starting up. Please wait...')
    }
    return pythonBridge.startDownload(options)
  })

  ipcMain.handle(IPC_CHANNELS.CANCEL_DOWNLOAD, async (_, downloadId: string) => {
    if (!pythonBridge?.isReady()) {
      throw new Error('Backend is not available')
    }
    return pythonBridge.cancelDownload(downloadId)
  })

  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => {
    return store.store
  })

  ipcMain.handle(IPC_CHANNELS.SET_SETTINGS, (_, key: string, value: unknown) => {
    store.set(key, value)
    return true
  })

  ipcMain.handle(IPC_CHANNELS.SELECT_OUTPUT_DIR, async () => {
    if (!mainWindow) return null

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      defaultPath: store.get('outputDirectory') as string
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const dir = result.filePaths[0]
      store.set('outputDirectory', dir)
      return dir
    }
    return null
  })

  ipcMain.handle(IPC_CHANNELS.GET_APP_VERSION, () => {
    return app.getVersion()
  })

  ipcMain.handle(IPC_CHANNELS.PYTHON_STATUS, () => {
    return pythonBridge?.isReady() ?? false
  })
}

async function startPythonBackend(): Promise<void> {
  pythonBridge = new PythonBridge()

  // Forward download events to renderer
  pythonBridge.on('progress', (progress) => {
    mainWindow?.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, progress)
  })

  pythonBridge.on('complete', (result) => {
    mainWindow?.webContents.send(IPC_CHANNELS.DOWNLOAD_COMPLETE, result)
  })

  pythonBridge.on('error', (error) => {
    mainWindow?.webContents.send(IPC_CHANNELS.DOWNLOAD_ERROR, error)
  })

  // Forward status changes to renderer
  pythonBridge.on('status', (status) => {
    log.info('Backend status changed:', status)
    mainWindow?.webContents.send('backend:status', status)
  })

  try {
    log.info('Starting Python backend...')
    await pythonBridge.start()
    log.info('Python backend started successfully')
  } catch (error) {
    log.error('Failed to start Python backend:', error)
    // Notify renderer of failure
    mainWindow?.webContents.send('backend:status', {
      ready: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

app.whenReady().then(async () => {
  log.info('Application starting...')

  electronApp.setAppUserModelId('com.diatech.ythelper')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Setup IPC handlers before creating window
  setupIpcHandlers()

  // Create window first so user sees the app loading
  createWindow()

  // Setup auto-updater (only in production)
  if (!is.dev && mainWindow) {
    setupAutoUpdater(mainWindow)
    // Check for updates after a short delay
    setTimeout(() => {
      checkForUpdates().catch((error) => {
        log.error('Failed to check for updates:', error)
      })
    }, 3000)
  }

  // Start Python backend in background
  startPythonBackend()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
  log.info('Application quitting, stopping Python backend...')
  pythonBridge?.stop()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    pythonBridge?.stop()
    app.quit()
  }
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled rejection at:', promise, 'reason:', reason)
})
