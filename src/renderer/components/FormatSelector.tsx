import { useDownloadStore } from '../stores/download'
import { VIDEO_FORMATS, AUDIO_FORMATS } from '../../shared/types'

function FormatSelector() {
  const { mode, setMode, videoFormat, setVideoFormat, audioFormat, setAudioFormat } =
    useDownloadStore()

  return (
    <div className="bg-dark-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-4">
        <label className="text-sm text-dark-400">Mode:</label>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('video')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              mode === 'video'
                ? 'bg-primary-600 text-white'
                : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
            }`}
          >
            Video
          </button>
          <button
            onClick={() => setMode('audio')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              mode === 'audio'
                ? 'bg-primary-600 text-white'
                : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
            }`}
          >
            Audio Only
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="text-sm text-dark-400 w-24">
          {mode === 'video' ? 'Video Format:' : 'Audio Format:'}
        </label>
        {mode === 'video' ? (
          <select
            value={videoFormat}
            onChange={(e) => setVideoFormat(e.target.value)}
            className="flex-1"
          >
            {VIDEO_FORMATS.map((format) => (
              <option key={format} value={format}>
                {format.toUpperCase()}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={audioFormat}
            onChange={(e) => setAudioFormat(e.target.value)}
            className="flex-1"
          >
            {AUDIO_FORMATS.map((format) => (
              <option key={format} value={format}>
                {format.toUpperCase()}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}

export default FormatSelector
