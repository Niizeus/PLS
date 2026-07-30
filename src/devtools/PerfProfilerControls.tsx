import { useEffect, useState, type CSSProperties } from 'react'
import {
  isPerformanceCaptureActive,
  startPerformanceCapture,
  stopPerformanceCapture,
  usePerfProfilerStatus,
} from './perfProfiler'

export default function PerfProfilerControls() {
  const status = usePerfProfilerStatus()
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.code !== 'F9' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return
      event.preventDefault()
      if (isPerformanceCaptureActive()) void stopPerformanceCapture()
      else startPerformanceCapture()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!status.isRecording) return undefined
    const id = window.setInterval(() => forceTick((value) => value + 1), 250)
    return () => window.clearInterval(id)
  }, [status.isRecording])

  if (!import.meta.env.DEV) return null
  if (!status.isRecording && !status.lastReportFile && !status.lastError) return null

  const elapsedSeconds = status.startedAt ? (performance.now() - status.startedAt) / 1000 : 0

  return (
    <div style={wrapStyle}>
      <div style={titleStyle}>{status.isRecording ? 'REC PERF F9' : 'PERF TERMINE'}</div>
      {status.isRecording ? (
        <>
          <div>{elapsedSeconds.toFixed(1)} s</div>
          <div>
            frames {status.frameCount} - lentes {status.slowFrameCount}
          </div>
        </>
      ) : (
        <>
          {status.lastReportFile && <div>{status.lastReportFile}</div>}
          {status.lastError && <div style={errorStyle}>{status.lastError}</div>}
        </>
      )}
    </div>
  )
}

const wrapStyle: CSSProperties = {
  position: 'fixed',
  right: 18,
  bottom: 18,
  zIndex: 1200,
  pointerEvents: 'none',
  display: 'grid',
  gap: 3,
  minWidth: 180,
  padding: '9px 11px',
  borderRadius: 7,
  border: '1px solid rgba(250,204,21,0.55)',
  background: 'rgba(17,24,39,0.92)',
  color: '#fef3c7',
  font: '700 12px system-ui, sans-serif',
  boxShadow: '0 12px 34px rgba(0,0,0,0.32)',
}

const titleStyle: CSSProperties = {
  color: '#facc15',
  fontSize: 11,
  letterSpacing: 0,
}

const errorStyle: CSSProperties = {
  color: '#fecaca',
}
