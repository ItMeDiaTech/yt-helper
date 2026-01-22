import { useDownloadStore } from '../stores/download'

function TimeRangeSelector() {
  const { startTime, endTime, setStartTime, setEndTime, videoInfo } = useDownloadStore()

  const validateTimeFormat = (value: string): boolean => {
    if (!value) return true
    const pattern = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/
    return pattern.test(value)
  }

  const timeToSeconds = (time: string): number => {
    if (!time) return 0
    const parts = time.split(':').map(Number)
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }

  const formatPlaceholder = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const duration = videoInfo?.duration || 0
  const startSeconds = timeToSeconds(startTime)
  const endSeconds = timeToSeconds(endTime)

  const startError =
    startTime && (!validateTimeFormat(startTime) || startSeconds >= duration)
      ? 'Invalid start time'
      : null

  const endError =
    endTime &&
    (!validateTimeFormat(endTime) || endSeconds > duration || (startTime && endSeconds <= startSeconds))
      ? 'Invalid end time'
      : null

  return (
    <div className="bg-dark-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm text-dark-400">Time Range (optional)</label>
        {duration > 0 && (
          <span className="text-xs text-dark-500">
            Video duration: {formatPlaceholder(duration)}
          </span>
        )}
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-xs text-dark-500 mb-1">Start Time (HH:MM:SS)</label>
          <input
            type="text"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            placeholder="00:00:00"
            className={`w-full ${startError ? 'border-red-500' : ''}`}
          />
          {startError && <p className="text-red-500 text-xs mt-1">{startError}</p>}
        </div>

        <div className="flex-1">
          <label className="block text-xs text-dark-500 mb-1">End Time (HH:MM:SS)</label>
          <input
            type="text"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            placeholder="00:00:00"
            className={`w-full ${endError ? 'border-red-500' : ''}`}
          />
          {endError && <p className="text-red-500 text-xs mt-1">{endError}</p>}
        </div>
      </div>

      <p className="text-xs text-dark-500">
        Leave empty to download the full video. Enter times in HH:MM:SS format (e.g., 00:00:36 to
        00:01:20).
      </p>
    </div>
  )
}

export default TimeRangeSelector
