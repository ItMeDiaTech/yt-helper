import { useDownloadStore } from '../stores/download'

function DownloadProgress() {
  const currentDownload = useDownloadStore((state) => state.currentDownload)

  if (!currentDownload) return null

  const handleCancel = async () => {
    try {
      await window.electron.cancelDownload(currentDownload.downloadId)
    } catch (error) {
      console.error('Failed to cancel download:', error)
    }
  }

  const statusLabels: Record<string, string> = {
    pending: 'Preparing...',
    downloading: 'Downloading...',
    processing: 'Processing...',
    complete: 'Complete',
    error: 'Error',
    cancelled: 'Cancelled'
  }

  return (
    <div className="bg-dark-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-dark-400">
          {statusLabels[currentDownload.status] || currentDownload.status}
        </span>
        {(currentDownload.status === 'downloading' || currentDownload.status === 'processing') && (
          <button
            onClick={handleCancel}
            className="text-sm text-red-500 hover:text-red-400 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="relative h-2 bg-dark-700 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-primary-600 transition-all duration-300"
          style={{ width: `${currentDownload.progress}%` }}
        />
      </div>

      <div className="flex justify-between text-sm text-dark-400">
        <span>{currentDownload.progress.toFixed(1)}%</span>
        <span>
          {currentDownload.speed && `${currentDownload.speed}`}
          {currentDownload.speed && currentDownload.eta && ' • '}
          {currentDownload.eta && `ETA: ${currentDownload.eta}`}
        </span>
      </div>

      {currentDownload.filename && (
        <p className="text-xs text-dark-500 truncate" title={currentDownload.filename}>
          {currentDownload.filename}
        </p>
      )}

      {currentDownload.error && (
        <p className="text-sm text-red-500">{currentDownload.error}</p>
      )}
    </div>
  )
}

export default DownloadProgress
