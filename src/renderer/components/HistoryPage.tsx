import { useDownloadStore } from '../stores/download'

function HistoryPage() {
  const { downloadHistory, clearHistory } = useDownloadStore()

  const statusColors: Record<string, string> = {
    complete: 'text-green-500',
    error: 'text-red-500',
    cancelled: 'text-yellow-500'
  }

  const statusIcons: Record<string, string> = {
    complete: '✓',
    error: '✗',
    cancelled: '⊘'
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Download History</h2>
        {downloadHistory.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-sm text-dark-400 hover:text-white transition-colors"
          >
            Clear History
          </button>
        )}
      </div>

      {downloadHistory.length === 0 ? (
        <div className="text-center py-12 text-dark-500">
          <p>No downloads yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {downloadHistory.map((item, index) => (
            <div
              key={`${item.downloadId}-${index}`}
              className="bg-dark-800 rounded-lg p-4 flex items-center gap-4"
            >
              <span className={`text-xl ${statusColors[item.status] || 'text-dark-400'}`}>
                {statusIcons[item.status] || '?'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" title={item.filename}>
                  {item.filename || 'Unknown file'}
                </p>
                {item.error && <p className="text-xs text-red-500 mt-1">{item.error}</p>}
              </div>
              <span
                className={`text-sm capitalize ${statusColors[item.status] || 'text-dark-400'}`}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default HistoryPage
