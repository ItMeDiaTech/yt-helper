import { useEffect, useState } from 'react'
import { useSettingsStore } from '../stores/settings'
import { VIDEO_FORMATS, AUDIO_FORMATS, QUALITY_OPTIONS } from '../../shared/types'

interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  progress?: number
  error?: string
}

function SettingsPage() {
  const {
    outputDirectory,
    defaultVideoFormat,
    defaultAudioFormat,
    defaultQuality,
    setDefaultVideoFormat,
    setDefaultAudioFormat,
    setDefaultQuality
  } = useSettingsStore()

  const [appVersion, setAppVersion] = useState<string>('')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' })

  useEffect(() => {
    // Get current version
    window.electron.getAppVersion().then(setAppVersion)

    // Listen for update status
    const unsubscribe = window.electron.onUpdateStatus((status) => {
      setUpdateStatus({
        status: status.status,
        version: status.info?.version,
        progress: status.progress?.percent,
        error: status.error
      })
    })

    return unsubscribe
  }, [])

  const handleSelectDirectory = async () => {
    await window.electron.selectOutputDirectory()
    useSettingsStore.getState().loadSettings()
  }

  const handleCheckForUpdates = async () => {
    setUpdateStatus({ status: 'checking' })
    try {
      await window.electron.checkForUpdates()
    } catch (error) {
      setUpdateStatus({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to check for updates'
      })
    }
  }

  const handleInstallUpdate = () => {
    window.electron.installUpdate()
  }

  const getUpdateStatusText = () => {
    switch (updateStatus.status) {
      case 'checking':
        return 'Checking for updates...'
      case 'available':
        return `Update available: v${updateStatus.version}`
      case 'not-available':
        return 'You have the latest version'
      case 'downloading':
        return `Downloading update... ${updateStatus.progress?.toFixed(0) || 0}%`
      case 'downloaded':
        return `Update ready: v${updateStatus.version}`
      case 'error':
        return `Error: ${updateStatus.error}`
      default:
        return ''
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="space-y-6">
        {/* About Section */}
        <div className="bg-dark-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">About</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-300">YouTube Helper</p>
              <p className="text-sm text-dark-500">Version {appVersion || '...'}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {updateStatus.status === 'downloaded' ? (
                <button
                  onClick={handleInstallUpdate}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Restart to Update
                </button>
              ) : (
                <button
                  onClick={handleCheckForUpdates}
                  disabled={updateStatus.status === 'checking' || updateStatus.status === 'downloading'}
                  className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateStatus.status === 'checking' ? 'Checking...' : 'Check for Updates'}
                </button>
              )}
              {updateStatus.status !== 'idle' && (
                <p className={`text-sm ${updateStatus.status === 'error' ? 'text-red-500' : 'text-dark-400'}`}>
                  {getUpdateStatusText()}
                </p>
              )}
            </div>
          </div>
          {updateStatus.status === 'downloading' && (
            <div className="mt-3">
              <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-600 transition-all duration-300"
                  style={{ width: `${updateStatus.progress || 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Output Directory */}
        <div className="bg-dark-800 rounded-lg p-4">
          <label className="block text-sm text-dark-400 mb-2">Default Output Directory</label>
          <div className="flex gap-2">
            <input type="text" value={outputDirectory} readOnly className="flex-1 text-sm" />
            <button
              onClick={handleSelectDirectory}
              className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
            >
              Browse
            </button>
          </div>
        </div>

        {/* Default Formats */}
        <div className="bg-dark-800 rounded-lg p-4">
          <label className="block text-sm text-dark-400 mb-2">Default Video Format</label>
          <select
            value={defaultVideoFormat}
            onChange={(e) => setDefaultVideoFormat(e.target.value)}
            className="w-full"
          >
            {VIDEO_FORMATS.map((format) => (
              <option key={format} value={format}>
                {format.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-dark-800 rounded-lg p-4">
          <label className="block text-sm text-dark-400 mb-2">Default Audio Format</label>
          <select
            value={defaultAudioFormat}
            onChange={(e) => setDefaultAudioFormat(e.target.value)}
            className="w-full"
          >
            {AUDIO_FORMATS.map((format) => (
              <option key={format} value={format}>
                {format.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-dark-800 rounded-lg p-4">
          <label className="block text-sm text-dark-400 mb-2">Default Quality</label>
          <select
            value={defaultQuality}
            onChange={(e) => setDefaultQuality(e.target.value)}
            className="w-full"
          >
            {QUALITY_OPTIONS.map((q) => (
              <option key={q} value={q}>
                {q === 'best' ? 'Best Available' : q}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
