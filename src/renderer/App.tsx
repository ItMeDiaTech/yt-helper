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

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('download')
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({ ready: false })
  const loadSettings = useSettingsStore((state) => state.loadSettings)
  const setCurrentDownload = useDownloadStore((state) => state.setCurrentDownload)
  const addToHistory = useDownloadStore((state) => state.addToHistory)

  useEffect(() => {
    loadSettings()

    // Check initial backend status
    window.electron.getPythonStatus().then((ready) => {
      setBackendStatus({ ready })
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
      addToHistory(result)
    })

    const unsubError = window.electron.onDownloadError((error) => {
      setCurrentDownload(null)
      addToHistory(error)
    })

    return () => {
      unsubBackend()
      unsubProgress()
      unsubComplete()
      unsubError()
    }
  }, [loadSettings, setCurrentDownload, addToHistory])

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
  return (
    <div className="flex flex-col items-center justify-center h-full">
      {error ? (
        <>
          <div className="text-red-500 text-xl mb-4">Backend Error</div>
          <p className="text-dark-400 text-center max-w-md mb-6">{error}</p>
          <p className="text-dark-500 text-sm">
            Please ensure Python and required dependencies are installed.
          </p>
        </>
      ) : (
        <>
          <div className="relative w-16 h-16 mb-6">
            <div className="absolute inset-0 border-4 border-dark-700 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-primary-500 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold mb-2">Starting Backend</h2>
          <p className="text-dark-400">Initializing Python server...</p>
        </>
      )}
    </div>
  )
}

export default App
