'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize2, SkipBack, SkipForward, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFileUrl } from '@/hooks/use-file-url'
interface VideoViewerProps {
  files: {
    id: string
    fileName: string
    fileUrl: string
    metadata?: unknown
  }
  zoom: number
  canEdit: boolean
}

export function VideoViewer({
  files: file,
  zoom,
  canEdit
}: VideoViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Get signed URL for private file access
  const { signedUrl, error } = useFileUrl(file.id)

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    const updateTime = () => setCurrentTime(video.currentTime)
    const updateDuration = () => setDuration(video.duration)

    video.addEventListener('timeupdate', updateTime)
    video.addEventListener('loadedmetadata', updateDuration)
    video.addEventListener('play', () => setIsPlaying(true))
    video.addEventListener('pause', () => setIsPlaying(false))

    return () => {
      video.removeEventListener('timeupdate', updateTime)
      video.removeEventListener('loadedmetadata', updateDuration)
    }
  }, [])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) {
      return
    }

    if (isPlaying) {
      video.pause()
    } else {
      video.play()
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) {
      return
    }

    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const seekTo = (time: number) => {
    const video = videoRef.current
    if (!video) {
      return
    }

    video.currentTime = time
    setCurrentTime(time)
  }

  const handleVideoClick = () => {
    if (!canEdit) {
      return
    }

    // TODO: Implement video annotation creation
    console.log('Video annotation click at:', currentTime)
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getTimestampAnnotations = (): Array<{
    id: string
    coordinates?: { timestamp?: number }
    target?: { timestamp?: number }
  }> => {
    // TODO: Implement video annotation system
    return []
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-500 mb-2">Failed to load video</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!signedUrl) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-2" />
          <p className="text-gray-500 text-sm">Loading video...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black flex items-center justify-center"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={signedUrl}
        className="max-w-full max-h-full cursor-pointer"
        onClick={handleVideoClick}
        style={{
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'center'
        }}
      />

      {/* Video Timeline Annotations */}
      <div className="absolute bottom-16 left-4 right-4">
        <div className="relative h-1 bg-gray-600 rounded">
          {/* Progress bar */}
          <div
            className="absolute h-full bg-blue-500 rounded"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />

          {/* Timeline annotations */}
          {getTimestampAnnotations().map((annotation) => {
            let timestamp = 0
            if (annotation.coordinates && typeof annotation.coordinates === 'object' && annotation.coordinates !== null) {
              const coords = annotation.coordinates as { timestamp?: number }
              timestamp = coords.timestamp || 0
            } else if (annotation.target && typeof annotation.target === 'object' && annotation.target !== null) {
              const target = annotation.target as { timestamp?: number }
              timestamp = target.timestamp || 0
            }

            const position = duration > 0 ? (timestamp / duration) * 100 : 0

            return (
              <div
                key={annotation.id}
                className="absolute w-3 h-3 bg-red-500 rounded-full border border-white transform -translate-x-1.5 -translate-y-1 cursor-pointer"
                style={{ left: `${position}%` }}
                onClick={() => seekTo(timestamp)}
                title={`Annotation at ${formatTime(timestamp)}`}
              />
            )
          })}
        </div>
      </div>

      {/* Video Controls */}
      {showControls && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={togglePlay}
                className="text-white hover:bg-white/20"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMute}
                className="text-white hover:bg-white/20"
              >
                {isMuted ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </Button>

              <span className="text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => seekTo(Math.max(0, currentTime - 10))}
                className="text-white hover:bg-white/20"
              >
                <SkipBack className="h-4 w-4" />
                10s
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => seekTo(Math.min(duration, currentTime + 10))}
                className="text-white hover:bg-white/20"
              >
                <SkipForward className="h-4 w-4" />
                10s
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-2">
            <input
              type="range"
              min={0}
              max={duration}
              value={currentTime}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Loading State - handled by video element */}
    </div>
  )
}
