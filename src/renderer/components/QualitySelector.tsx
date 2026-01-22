import { useDownloadStore } from '../stores/download'
import { QUALITY_OPTIONS } from '../../shared/types'

function QualitySelector() {
  const { quality, setQuality, videoInfo } = useDownloadStore()

  const availableQualities = videoInfo?.availableQualities || QUALITY_OPTIONS

  return (
    <div className="bg-dark-800 rounded-lg p-4">
      <div className="flex items-center gap-4">
        <label className="text-sm text-dark-400 w-24">Quality:</label>
        <select value={quality} onChange={(e) => setQuality(e.target.value)} className="flex-1">
          {availableQualities.map((q) => (
            <option key={q} value={q}>
              {q === 'best' ? 'Best Available' : q}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default QualitySelector
