import { useDownloadStore } from '../stores/download'

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M views`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K views`
  }
  return `${count} views`
}

function VideoPreview() {
  const videoInfo = useDownloadStore((state) => state.videoInfo)

  if (!videoInfo) return null

  return (
    <div className="bg-dark-800 rounded-lg overflow-hidden mt-4">
      <div className="flex gap-4 p-4">
        <div className="relative flex-shrink-0">
          <img
            src={videoInfo.thumbnail}
            alt={videoInfo.title}
            className="w-40 h-24 object-cover rounded"
          />
          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
            {formatDuration(videoInfo.duration)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate" title={videoInfo.title}>
            {videoInfo.title}
          </h3>
          <p className="text-dark-400 text-sm mt-1">{videoInfo.channel}</p>
          <p className="text-dark-500 text-sm mt-1">{formatViewCount(videoInfo.viewCount)}</p>
        </div>
      </div>
    </div>
  )
}

export default VideoPreview
