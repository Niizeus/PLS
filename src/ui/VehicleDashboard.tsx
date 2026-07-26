import type { CSSProperties } from 'react'
import { useVehicleTelemetryStore } from '../entities/vehicles/vehicleTelemetryStore'
import { getRadioStation } from '../audio/radioCatalog'
import { useRadioStore } from '../audio/radioStore'

const MAX_DIAL_KMH = 140
const NEEDLE_MIN = -118
const NEEDLE_MAX = 118

export default function VehicleDashboard() {
  const riding = useVehicleTelemetryStore((s) => s.riding)
  const kind = useVehicleTelemetryStore((s) => s.kind)
  const speedKmh = useVehicleTelemetryStore((s) => s.speedKmh)
  const fuelPercent = useVehicleTelemetryStore((s) => s.fuelPercent)
  const stationId = useRadioStore((s) => s.currentStationId)
  const contentLabel = useRadioStore((s) => s.currentContentLabel)

  if (!riding) return null

  const clampedSpeed = Math.min(MAX_DIAL_KMH, speedKmh)
  const needle = NEEDLE_MIN + (clampedSpeed / MAX_DIAL_KMH) * (NEEDLE_MAX - NEEDLE_MIN)
  const speedText = Math.round(speedKmh).toString().padStart(3, '0')
  const fuel = Math.round(fuelPercent)
  const station = stationId ? getRadioStation(stationId) : null

  return (
    <div style={panelStyle}>
      <div style={dialStyle}>
        <svg viewBox="0 0 140 100" style={svgStyle} aria-hidden>
          <path d="M 20 80 A 52 52 0 0 1 120 80" fill="none" stroke="rgba(226,232,240,0.22)" strokeWidth="8" />
          <path d="M 20 80 A 52 52 0 0 1 120 80" fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
          {[0, 20, 40, 60, 80, 100, 120, 140].map((mark) => {
            const a = ((NEEDLE_MIN + (mark / MAX_DIAL_KMH) * (NEEDLE_MAX - NEEDLE_MIN)) - 90) * (Math.PI / 180)
            const x1 = 70 + Math.cos(a) * 42
            const y1 = 80 + Math.sin(a) * 42
            const x2 = 70 + Math.cos(a) * 51
            const y2 = 80 + Math.sin(a) * 51
            return <line key={mark} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#dbeafe" strokeWidth="2" />
          })}
          <g style={{ transform: `rotate(${needle}deg)`, transformOrigin: '70px 80px' }}>
            <line x1="70" y1="80" x2="70" y2="31" stroke="#f97316" strokeWidth="4" strokeLinecap="round" />
          </g>
          <circle cx="70" cy="80" r="7" fill="#f8fafc" />
        </svg>
        <div style={digitalStyle}>{speedText}</div>
        <div style={unitStyle}>km/h</div>
      </div>

      <div style={sideStyle}>
        <div style={vehicleStyle}>{kind === 'car' ? 'VOITURE' : 'SCOOTER'}</div>
        <div style={fuelLabelStyle}>ESSENCE</div>
        <div style={fuelTrackStyle}>
          <div style={{ ...fuelFillStyle, width: `${fuel}%`, background: fuel < 18 ? '#ef4444' : fuel < 35 ? '#f59e0b' : '#22c55e' }} />
        </div>
        <div style={fuelTextStyle}>{fuel}%</div>
        <div style={radioLabelStyle}>RADIO</div>
        <div style={radioTextStyle}>{station ? station.shortName : 'OFF'}</div>
        <div style={radioContentStyle}>{contentLabel ?? 'Silence'}</div>
      </div>
    </div>
  )
}

const panelStyle: CSSProperties = {
  position: 'fixed',
  right: 20,
  bottom: 82,
  width: 238,
  minHeight: 150,
  display: 'grid',
  gridTemplateColumns: '136px 1fr',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid rgba(148, 163, 184, 0.32)',
  background: 'rgba(10, 15, 28, 0.78)',
  color: '#e5edf8',
  boxShadow: '0 12px 32px rgba(0,0,0,0.34)',
}

const dialStyle: CSSProperties = { position: 'relative', height: 104 }
const svgStyle: CSSProperties = { width: 136, height: 98, display: 'block' }

const digitalStyle: CSSProperties = {
  position: 'absolute',
  left: 41,
  bottom: 8,
  minWidth: 54,
  textAlign: 'center',
  font: '900 22px ui-monospace, monospace',
  color: '#f8fafc',
}

const unitStyle: CSSProperties = {
  position: 'absolute',
  left: 50,
  bottom: -4,
  font: '800 10px system-ui, sans-serif',
  color: '#94a3b8',
  letterSpacing: 0.8,
}

const sideStyle: CSSProperties = { display: 'grid', gap: 7, alignContent: 'center' }
const vehicleStyle: CSSProperties = { font: '900 12px system-ui, sans-serif', color: '#bfdbfe', letterSpacing: 0.8 }
const fuelLabelStyle: CSSProperties = { font: '800 10px system-ui, sans-serif', color: '#cbd5e1', letterSpacing: 0.8 }
const fuelTrackStyle: CSSProperties = { height: 12, borderRadius: 4, background: 'rgba(30,41,59,0.92)', overflow: 'hidden', border: '1px solid rgba(148,163,184,0.28)' }
const fuelFillStyle: CSSProperties = { height: '100%', transition: 'width 160ms linear' }
const fuelTextStyle: CSSProperties = { font: '900 16px ui-monospace, monospace', color: '#f8fafc' }
const radioLabelStyle: CSSProperties = { marginTop: 2, font: '800 10px system-ui, sans-serif', color: '#cbd5e1', letterSpacing: 0.8 }
const radioTextStyle: CSSProperties = { font: '900 12px system-ui, sans-serif', color: '#fde68a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const radioContentStyle: CSSProperties = { font: '800 10px system-ui, sans-serif', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
