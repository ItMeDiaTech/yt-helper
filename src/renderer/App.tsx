import { useEffect, useState } from 'react'
import { useSettingsStore } from './stores/settings'
import { useDownloadStore } from './stores/download'
import Sidebar from './components/Sidebar'
import DownloadPage from './components/DownloadPage'
import HistoryPage from './components/HistoryPage'
import SettingsPage from './components/SettingsPage'

type Page = 'download' | 'history' | 'settings'

interface BackendStatus {
  ready: boolean
  error?: string
}

const POLL_INTERVAL = 2000

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('download')
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({ ready: false })
  const loadSettings = useSettingsStore((state) => state.loadSettings)
  const setCurrentDownload = useDownloadStore((state) => state.setCurrentDownload)
  const setDownloadError = useDownloadStore((state) => state.setDownloadError)
  const setDownloadSuccess = useDownloadStore((state) => state.setDownloadSuccess)
  const addToHistory = useDownloadStore((state) => state.addToHistory)

  useEffect(() => {
    // Load settings and hydrate download store with user's saved defaults
    loadSettings().then(() => {
      const settings = useSettingsStore.getState()
      const downloadState = useDownloadStore.getState()
      downloadState.setVideoFormat(settings.defaultVideoFormat)
      downloadState.setAudioFormat(settings.defaultAudioFormat)
      downloadState.setQuality(settings.defaultQuality)
    })

    // Listen for backend status changes
    const unsubBackend = window.electron.onBackendStatus((status) => {
      setBackendStatus(status)
    })

    const unsubProgress = window.electron.onDownloadProgress((progress) => {
      setCurrentDownload(progress)
    })

    const unsubComplete = window.electron.onDownloadComplete((result) => {
      setCurrentDownload(null)
      setDownloadSuccess(result.filename || null)
      addToHistory(result)
    })

    const unsubError = window.electron.onDownloadError((error) => {
      setCurrentDownload(null)
      setDownloadError(error.error || 'Download failed')
      addToHistory(error)
    })

    return () => {
      unsubBackend()
      unsubProgress()
      unsubComplete()
      unsubError()
    }
  }, [loadSettings, setCurrentDownload, setDownloadError, setDownloadSuccess, addToHistory])

  // Poll backend status until ready — catches missed IPC events
  useEffect(() => {
    if (backendStatus.ready || backendStatus.error) return

    let cancelled = false

    const poll = async () => {
      try {
        const ready = await window.electron.getPythonStatus()
        if (!cancelled && ready) {
          setBackendStatus({ ready: true })
        }
      } catch {
        // IPC call failed, will retry on next interval
      }
    }

    // Check immediately
    poll()
    const interval = setInterval(poll, POLL_INTERVAL)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [backendStatus.ready, backendStatus.error])

  return (
    <div className="flex h-screen bg-dark-900">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} backendReady={backendStatus.ready} />
      <main className="flex-1 overflow-y-auto p-6">
        {!backendStatus.ready ? (
          <LoadingScreen error={backendStatus.error} />
        ) : (
          <>
            {currentPage === 'download' && <DownloadPage />}
            {currentPage === 'history' && <HistoryPage />}
            {currentPage === 'settings' && <SettingsPage />}
          </>
        )}
      </main>
    </div>
  )
}

function LoadingScreen({ error }: { error?: string }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (error) return
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(interval)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-full">
      {error ? (
        <>
          <div className="text-red-500 text-xl mb-4">Backend Error</div>
          <p className="text-dark-400 text-center max-w-md mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </>
      ) : (
        <>
          <div className="relative w-16 h-16 mb-6">
            <div className="absolute inset-0 border-4 border-dark-700 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-primary-500 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold mb-2">Starting Backend</h2>
          <p className="text-dark-400">
            {elapsed < 10
              ? 'Initializing Python server...'
              : elapsed < 30
                ? 'Still starting up, this may take a moment...'
                : 'Taking longer than expected...'}
          </p>
        </>
      )}
    </div>
  )
}

export default App
