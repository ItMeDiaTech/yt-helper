import { useDownloadStore } from '../stores/download'
import { useSettingsStore } from '../stores/settings'
import UrlInput from './UrlInput'
import VideoPreview from './VideoPreview'
import FormatSelector from './FormatSelector'
import QualitySelector from './QualitySelector'
import TimeRangeSelector from './TimeRangeSelector'
import DownloadProgress from './DownloadProgress'

function DownloadPage() {
  const url = useDownloadStore((s) => s.url)
  const videoInfo = useDownloadStore((s) => s.videoInfo)
  const isLoadingInfo = useDownloadStore((s) => s.isLoadingInfo)
  const mode = useDownloadStore((s) => s.mode)
  const videoFormat = useDownloadStore((s) => s.videoFormat)
  const audioFormat = useDownloadStore((s) => s.audioFormat)
  const quality = useDownloadStore((s) => s.quality)
  const startTime = useDownloadStore((s) => s.startTime)
  const endTime = useDownloadStore((s) => s.endTime)
  // Only subscribe to presence/absence of download, not every progress tick
  const isDownloading = useDownloadStore((s) => s.currentDownload !== null)

  const outputDirectory = useSettingsStore((s) => s.outputDirectory)

  const handleDownload = async () => {
    if (!videoInfo) return

    try {
      await window.electron.startDownload({
        url,
        outputDir: outputDirectory,
        mode,
        videoFormat: mode === 'video' ? videoFormat : undefined,
        audioFormat: mode === 'audio' ? audioFormat : undefined,
        quality: mode === 'video' ? quality : undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined
      })
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const handleSelectDirectory = async () => {
    await window.electron.selectOutputDirectory()
    useSettingsStore.getState().loadSettings()
  }

  const canDownload = videoInfo && !isDownloading && !isLoadingInfo

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Download Video</h2>

      <UrlInput />

      {videoInfo && <VideoPreview />}

      {videoInfo && (
        <div className="space-y-4 mt-6">
          <FormatSelector />
          {mode === 'video' && <QualitySelector />}
          <TimeRangeSelector />

          <div className="bg-dark-800 rounded-lg p-4">
            <label className="block text-sm text-dark-400 mb-2">Output Directory</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={outputDirectory}
                readOnly
                className="flex-1 text-sm"
              />
              <button
                onClick={handleSelectDirectory}
                className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
              >
                Browse
              </button>
            </div>
          </div>

          {isDownloading && <DownloadProgress />}

          <button
            onClick={handleDownload}
            disabled={!canDownload}
            className={`w-full py-3 rounded-lg font-semibold transition-colors ${
              canDownload
                ? 'bg-primary-600 hover:bg-primary-700 text-white'
                : 'bg-dark-700 text-dark-500 cursor-not-allowed'
            }`}
          >
            {isDownloading ? 'Downloading...' : 'Download'}
          </button>
        </div>
      )}
    </div>
  )
}

export default DownloadPage
