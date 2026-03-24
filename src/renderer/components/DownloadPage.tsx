import { useEffect } from 'react'
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
  const convertToH264 = useDownloadStore((s) => s.convertToH264)
  const setConvertToH264 = useDownloadStore((s) => s.setConvertToH264)
  // Only subscribe to presence/absence of download, not every progress tick
  const isDownloading = useDownloadStore((s) => s.currentDownload !== null)

  const downloadError = useDownloadStore((s) => s.downloadError)
  const setDownloadError = useDownloadStore((s) => s.setDownloadError)
  const downloadSuccess = useDownloadStore((s) => s.downloadSuccess)
  const setDownloadSuccess = useDownloadStore((s) => s.setDownloadSuccess)

  const outputDirectory = useSettingsStore((s) => s.outputDirectory)
  const defaultConvertToH264 = useSettingsStore((s) => s.defaultConvertToH264)

  useEffect(() => {
    setConvertToH264(defaultConvertToH264)
  }, [defaultConvertToH264, setConvertToH264])

  const handleDownload = async () => {
    if (!videoInfo) return

    setDownloadError(null)
    setDownloadSuccess(null)

    try {
      await window.electron.startDownload({
        url,
        outputDir: outputDirectory,
        mode,
        videoFormat: mode === 'video' ? videoFormat : undefined,
        audioFormat: mode === 'audio' ? audioFormat : undefined,
        quality: mode === 'video' ? quality : undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        convertToH264: mode === 'video' ? convertToH264 : undefined
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Download failed to start'
      setDownloadError(message)
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
          {mode === 'video' && (
            <div className="bg-dark-800 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={convertToH264}
                  onChange={(e) => setConvertToH264(e.target.checked)}
                  className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <span className="text-sm text-dark-200">Convert to H264/AAC</span>
                  <p className="text-xs text-dark-500 mt-0.5">
                    Ensures maximum compatibility. May re-encode if native H264 is unavailable.
                  </p>
                </div>
              </label>
            </div>
          )}
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

          {downloadError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">{downloadError}</p>
            </div>
          )}

          {downloadSuccess && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <p className="text-green-400 text-sm">Saved to {downloadSuccess}</p>
            </div>
          )}

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
