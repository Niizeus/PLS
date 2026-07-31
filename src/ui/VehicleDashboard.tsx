import type { CSSProperties } from 'react'
import { useVehicleTelemetryStore } from '../entities/vehicles/vehicleTelemetryStore'
import { useCarStore } from '../entities/vehicles/carStore'
import { getRadioStation } from '../audio/radioCatalog'
import { useRadioStore } from '../audio/radioStore'
import { HUD, hardShadow, kbd, outline } from './hudStyle'

const NEEDLE_MIN = -118
const NEEDLE_MAX = 118
/** Nombre de graduations sur le cadran (le pas depend du vehicule). */
const DIAL_TICKS = 7

export default function VehicleDashboard() {
  const riding = useVehicleTelemetryStore((s) => s.riding)
  const kind = useVehicleTelemetryStore((s) => s.kind)
  const speedKmh = useVehicleTelemetryStore((s) => s.speedKmh)
  const dialMaxKmh = useVehicleTelemetryStore((s) => s.dialMaxKmh)
  const gear = useVehicleTelemetryStore((s) => s.gear)
  const rpmRatio = useVehicleTelemetryStore((s) => s.rpmRatio)
  const fuelPercent = useVehicleTelemetryStore((s) => s.fuelPercent)
  const stationId = useRadioStore((s) => s.currentStationId)
  const contentLabel = useRadioStore((s) => s.currentContentLabel)
  const limiterActive = useCarStore((s) => s.limiterActive)
  const limiterSpeed = useCarStore((s) => s.limiterSpeed)
  const headlightsOn = useCarStore((s) => s.headlightsOn)

  if (!riding) return null

  const clampedSpeed = Math.min(dialMaxKmh, speedKmh)
  const needle = NEEDLE_MIN + (clampedSpeed / dialMaxKmh) * (NEEDLE_MAX - NEEDLE_MIN)
  const speedText = Math.round(speedKmh).toString().padStart(3, '0')
  const fuel = Math.round(fuelPercent)
  const station = stationId ? getRadioStation(stationId) : null
  // Le scooter a un variateur : il n'y a pas de rapport a afficher.
  const gearText = gear > 0 ? String(gear) : 'CVT'
  // Limiteur et phares n'existent que sur la voiture pour l'instant.
  const isCar = kind === 'car'
  const limiterKmh = Math.round(limiterSpeed * 3.6)

  return (
    <div style={panelStyle}>
      <div style={dialStyle}>
        <svg viewBox="0 0 140 100" style={svgStyle} aria-hidden>
          <path d="M 20 80 A 52 52 0 0 1 120 80" fill="none" stroke="rgba(226,232,240,0.22)" strokeWidth="8" />
          <path d="M 20 80 A 52 52 0 0 1 120 80" fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
          {/* Compte-tours : l'arc se remplit avec le regime, et vire au rouge
              en approchant de la zone rouge. C'est lui qui rend les passages de
              rapport lisibles — l'aiguille de vitesse, elle, ne retombe pas. */}
          <path
            d="M 20 80 A 52 52 0 0 1 120 80"
            fill="none"
            stroke={rpmRatio > 0.92 ? '#ef4444' : '#f97316'}
            strokeWidth="4"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={`${rpmRatio} 1`}
          />
          {Array.from({ length: DIAL_TICKS + 1 }, (_, i) => (i * dialMaxKmh) / DIAL_TICKS).map((mark) => {
            const a = (NEEDLE_MIN + (mark / dialMaxKmh) * (NEEDLE_MAX - NEEDLE_MIN) - 90) * (Math.PI / 180)
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
        <div style={gearStyle}>{gearText}</div>
        {/* 🚦 Témoin du limiteur : discret, sous le cadran, et il affiche la
            vitesse mémorisée — sans ça on ne saurait pas sur quoi on a calé. */}
        {isCar && limiterActive && <div style={limiterStyle}>LIM {limiterKmh}</div>}
      </div>

      <div style={sideStyle}>
        <div style={vehicleHeaderStyle}>
          <span style={vehicleStyle}>{kind === 'car' ? 'VOITURE' : 'SCOOTER'}</span>
          {/* 💡 Témoin de phares : le vert-bleu des tableaux de bord réels. */}
          {isCar && headlightsOn && <span style={lightsStyle} title="Phares allumés">💡</span>}
        </div>
        <div style={fuelLabelStyle}>ESSENCE</div>
        <div style={fuelTrackStyle}>
          <div style={{ ...fuelFillStyle, width: `${fuel}%`, background: fuel < 18 ? '#ef4444' : fuel < 35 ? '#f59e0b' : '#22c55e' }} />
        </div>
        <div style={fuelTextStyle}>{fuel}%</div>
        {/* La touche est rappelée ICI, au moment où elle sert — pas noyée dans
            une liste de raccourcis qu'on ne lit plus au bout de dix minutes. */}
        <div style={radioHeaderStyle}>
          <span style={radioLabelStyle}>RADIO</span>
          <kbd style={{ ...kbd, padding: '0 5px', font: `600 10px ${HUD.mono}` }}>R</kbd>
        </div>
        {/* Poste éteint : on le dit clairement. « OFF » sans rien d'autre
            laissait croire à une radio en panne. */}
        <div style={radioTextStyle}>{station ? station.shortName : 'ÉTEINTE'}</div>
        <div style={radioContentStyle}>{station ? (contentLabel ?? 'Silence') : '—'}</div>
      </div>
    </div>
  )
}

/**
 * ⚠️ Seul panneau du HUD à rester SOMBRE, et c'est volontaire : ce n'est pas une
 * étiquette posée sur l'écran, c'est le **tableau de bord du véhicule** — un
 * objet rétroéclairé, avec des témoins lumineux. Il adopte quand même le contour
 * d'encre et l'ombre dure du reste du HUD pour rester de la même famille.
 */
const panelStyle: CSSProperties = {
  position: 'fixed',
  right: HUD.edge,
  bottom: 82,
  padding: '9px 12px',
  borderRadius: HUD.radius,
  background: '#171c28',
  border: outline,
  boxShadow: hardShadow,
  color: '#f1f5f9',
  font: `700 13px ${HUD.font}`,
  width: 238,
  minHeight: 150,
  display: 'grid',
  gridTemplateColumns: '136px 1fr',
  alignItems: 'center',
  gap: 10,
  pointerEvents: 'none',
}

const radioHeaderStyle: CSSProperties = {
  marginTop: 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
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

/** Rapport engagé, en haut du cadran (« CVT » pour le scooter). */
const gearStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 18,
  textAlign: 'center',
  font: '900 15px ui-monospace, monospace',
  color: '#fbbf24',
  letterSpacing: 1,
}

/** Témoin de limiteur, calé sous le compteur numérique. */
const limiterStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: -18,
  textAlign: 'center',
  font: '800 10px ui-monospace, monospace',
  color: '#34d399',
  letterSpacing: 1,
}

const sideStyle: CSSProperties = { display: 'grid', gap: 7, alignContent: 'center' }
const vehicleHeaderStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 }
const lightsStyle: CSSProperties = { font: '10px system-ui, sans-serif', lineHeight: 1 }
const vehicleStyle: CSSProperties = { font: '900 12px system-ui, sans-serif', color: '#bfdbfe', letterSpacing: 0.8 }
const fuelLabelStyle: CSSProperties = { font: '800 10px system-ui, sans-serif', color: '#cbd5e1', letterSpacing: 0.8 }
const fuelTrackStyle: CSSProperties = { height: 12, borderRadius: 4, background: 'rgba(30,41,59,0.92)', overflow: 'hidden', border: '1px solid rgba(148,163,184,0.28)' }
const fuelFillStyle: CSSProperties = { height: '100%', transition: 'width 160ms linear' }
const fuelTextStyle: CSSProperties = { font: '900 16px ui-monospace, monospace', color: '#f8fafc' }
const radioLabelStyle: CSSProperties = { font: '800 10px system-ui, sans-serif', color: '#cbd5e1', letterSpacing: 0.8 }
const radioTextStyle: CSSProperties = { font: '900 12px system-ui, sans-serif', color: '#fde68a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const radioContentStyle: CSSProperties = { font: '800 10px system-ui, sans-serif', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
