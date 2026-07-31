import type { CSSProperties } from 'react'
import { useVehicleTelemetryStore } from '../entities/vehicles/vehicleTelemetryStore'
import { useCarStore } from '../entities/vehicles/carStore'
import { getRadioStation } from '../audio/radioCatalog'
import { useRadioStore } from '../audio/radioStore'
import { HUD, kbd, outlineThin, panel, sectionLabel } from './hudStyle'

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
          {/* Le rail du cadran, tracé à l'encre comme le reste du HUD. */}
          <path d="M 20 80 A 52 52 0 0 1 120 80" fill="none" stroke={HUD.ink} strokeWidth="9" strokeLinecap="round" />
          <path d="M 20 80 A 52 52 0 0 1 120 80" fill="none" stroke={HUD.paperShade} strokeWidth="5" strokeLinecap="round" />
          {/* Compte-tours : l'arc se remplit avec le regime, et vire au rouge
              en approchant de la zone rouge. C'est lui qui rend les passages de
              rapport lisibles — l'aiguille de vitesse, elle, ne retombe pas. */}
          <path
            d="M 20 80 A 52 52 0 0 1 120 80"
            fill="none"
            stroke={rpmRatio > 0.92 ? '#e63946' : '#f4820a'}
            strokeWidth="5"
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
            return <line key={mark} x1={x1} y1={y1} x2={x2} y2={y2} stroke={HUD.ink} strokeWidth="3" strokeLinecap="round" />
          })}
          {/* L'aiguille : un trait d'encre épais surmonté d'un rouge franc —
              même construction que les contours de la 3D (noir dessous, aplat
              dessus), pour qu'elle reste lisible sur n'importe quel fond. */}
          <g style={{ transform: `rotate(${needle}deg)`, transformOrigin: '70px 80px' }}>
            <line x1="70" y1="80" x2="70" y2="29" stroke={HUD.ink} strokeWidth="7" strokeLinecap="round" />
            <line x1="70" y1="80" x2="70" y2="31" stroke="#e63946" strokeWidth="3.5" strokeLinecap="round" />
          </g>
          <circle cx="70" cy="80" r="8" fill={HUD.paper} stroke={HUD.ink} strokeWidth="3" />
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
          <div style={{ ...fuelFillStyle, width: `${fuel}%`, background: fuel < 18 ? '#e63946' : fuel < 35 ? '#f4820a' : '#5aa832' }} />
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

/** Le tableau de bord suit le même papier crème que le reste du HUD. */
const panelStyle: CSSProperties = {
  ...panel,
  position: 'fixed',
  right: HUD.edge,
  bottom: 82,
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
  font: `900 22px ${HUD.mono}`,
  color: HUD.ink,
}

const unitStyle: CSSProperties = {
  position: 'absolute',
  left: 50,
  bottom: -4,
  font: `800 10px ${HUD.font}`,
  color: HUD.textDim,
  letterSpacing: 0.8,
}

/** Rapport engagé, en haut du cadran (« CVT » pour le scooter). */
const gearStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 18,
  textAlign: 'center',
  font: `900 15px ${HUD.mono}`,
  color: HUD.ink,
  letterSpacing: 1,
}

/** Témoin de limiteur, calé sous le compteur numérique. */
const limiterStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: -18,
  textAlign: 'center',
  font: `800 10px ${HUD.mono}`,
  color: '#2f7d32',
  letterSpacing: 1,
}

const sideStyle: CSSProperties = { display: 'grid', gap: 6, alignContent: 'center' }
const vehicleHeaderStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 }
const lightsStyle: CSSProperties = { font: '11px system-ui, sans-serif', lineHeight: 1 }
const vehicleStyle: CSSProperties = { font: `900 12px ${HUD.font}`, letterSpacing: 0.8 }
const fuelLabelStyle: CSSProperties = { ...sectionLabel }
/** La jauge d'essence : même rail d'encre que les jauges vitales du téléphone. */
const fuelTrackStyle: CSSProperties = {
  height: 13,
  borderRadius: 999,
  background: HUD.paperShade,
  overflow: 'hidden',
  border: outlineThin,
}
const fuelFillStyle: CSSProperties = { height: '100%', transition: 'width 160ms linear' }
const fuelTextStyle: CSSProperties = { font: `900 16px ${HUD.mono}`, color: HUD.ink }
const radioLabelStyle: CSSProperties = { ...sectionLabel }
const radioTextStyle: CSSProperties = {
  font: `900 12px ${HUD.font}`,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}
const radioContentStyle: CSSProperties = {
  font: `800 10px ${HUD.font}`,
  color: HUD.textDim,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}
