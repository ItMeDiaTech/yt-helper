import { useState } from 'react'
import { useDownloadStore } from '../stores/download'

function UrlInput() {
  const { url, setUrl, setVideoInfo, setLoadingInfo, setInfoError, isLoadingInfo, infoError } =
    useDownloadStore()
  const [inputValue, setInputValue] = useState(url)

  const isValidUrl = (url: string): boolean => {
    const patterns = [
      /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/
    ]
    return patterns.some((pattern) => pattern.test(url))
  }

  const handleSubmit = async () => {
    if (!inputValue.trim() || !isValidUrl(inputValue)) {
      setInfoError('Please enter a valid YouTube URL')
      return
    }

    setUrl(inputValue)
    setLoadingInfo(true)
    setInfoError(null)
    setVideoInfo(null)

    try {
      const info = await window.electron.getVideoInfo(inputValue)
      setVideoInfo(info)
    } catch (error) {
      setInfoError(error instanceof Error ? error.message : 'Failed to fetch video info')
    } finally {
      setLoadingInfo(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setInputValue(text)
      if (isValidUrl(text)) {
        setUrl(text)
        handleSubmit()
      }
    } catch {
      // Clipboard access denied
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste YouTube URL here..."
          className="flex-1 text-base"
          disabled={isLoadingInfo}
        />
        <button
          onClick={handlePaste}
          className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
          disabled={isLoadingInfo}
        >
          Paste
        </button>
        <button
          onClick={handleSubmit}
          disabled={isLoadingInfo || !inputValue.trim()}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            isLoadingInfo || !inputValue.trim()
              ? 'bg-dark-700 text-dark-500 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700 text-white'
          }`}
        >
          {isLoadingInfo ? 'Loading...' : 'Fetch'}
        </button>
      </div>
      {infoError && <p className="text-red-500 text-sm">{infoError}</p>}
    </div>
  )
}

export default UrlInput
