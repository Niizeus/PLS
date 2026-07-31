import type { CSSProperties } from 'react'
import { useVehicleTelemetryStore } from '../entities/vehicles/vehicleTelemetryStore'
import { useCarStore } from '../entities/vehicles/carStore'
import { getRadioStation } from '../audio/radioCatalog'
import { useRadioStore } from '../audio/radioStore'
import { HUD, hardShadow, outline, panel } from './hudStyle'

/**
 * 🚗 Tableau de bord, en BAS À GAUCHE.
 *
 * ── Pourquoi un disque, et pourquoi à gauche ────────────────────────────────
 * L'ancienne version était un rectangle de 238 px collé en bas à DROITE, avec un
 * demi-cadran écrasé dans 104 px de haut : l'aiguille, la vitesse, le rapport et
 * le limiteur se marchaient dessus. Et comme le téléphone vit lui aussi en bas à
 * droite, il devait se décaler de 250 px dès qu'on montait en voiture.
 *
 * Le compteur est donc devenu **un seul disque**, posé dans le coin bas gauche
 * (libéré par la pastille « F1 Touches », supprimée) :
 *  • anneau EXTÉRIEUR = compte-tours, avec l'aiguille qui glisse dessus ;
 *  • anneau INTÉRIEUR = essence ;
 *  • au centre, la seule chose qu'on lit en conduisant : la vitesse.
 *
 * Résultat : deux fois moins d'encombrement, et le téléphone reste à sa place.
 */

/** Centre et rayons du cadran, en unités du viewBox (132 × 132). */
const CX = 66
const CY = 66
const R_RPM = 52
const R_FUEL = 38
/** Le cadran couvre 270° : il s'ouvre en bas, entre -135° et +135°. */
const ANGLE_MIN = -135
const ANGLE_MAX = 135
/** Nombre de graduations sur le cadran (le pas depend du vehicule). */
const DIAL_TICKS = 8

/** Un point du cadran : 0° = en haut, les degrés tournent dans le sens horaire. */
function polar(angleDeg: number, radius: number) {
  const a = (angleDeg * Math.PI) / 180
  return { x: CX + Math.sin(a) * radius, y: CY - Math.cos(a) * radius }
}

/** L'arc de 270° d'un des deux anneaux, prêt à être rempli au `strokeDasharray`. */
function ringPath(radius: number) {
  const start = polar(ANGLE_MIN, radius)
  const end = polar(ANGLE_MAX, radius)
  // large-arc = 1 : l'arc fait plus d'un demi-tour.
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 1 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

const RPM_PATH = ringPath(R_RPM)
const FUEL_PATH = ringPath(R_FUEL)

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
  const needle = ANGLE_MIN + (clampedSpeed / dialMaxKmh) * (ANGLE_MAX - ANGLE_MIN)
  const speedText = Math.round(speedKmh).toString()
  const fuel = Math.round(fuelPercent)
  const fuelColor = fuel < 18 ? '#e63946' : fuel < 35 ? '#f4820a' : '#5aa832'
  const station = stationId ? getRadioStation(stationId) : null
  // Le scooter a un variateur : il n'y a pas de rapport a afficher.
  const gearText = gear > 0 ? String(gear) : 'CVT'
  // Limiteur et phares n'existent que sur la voiture pour l'instant.
  const isCar = kind === 'car'
  const limiterKmh = Math.round(limiterSpeed * 3.6)
  const showBadges = isCar && (limiterActive || headlightsOn)

  return (
    <div style={wrapStyle}>
      {/* 🚦 Témoins, au-dessus du cadran. Ils poussent vers le HAUT : le disque
          ne bouge pas d'un pixel quand on allume les phares. */}
      {showBadges && (
        <div style={badgeRowStyle}>
          {limiterActive && <span style={{ ...badgeStyle, color: '#2f7d32' }}>LIM {limiterKmh}</span>}
          {headlightsOn && (
            <span style={badgeStyle} title="Phares allumés">
              💡 PHARES
            </span>
          )}
        </div>
      )}

      <div style={diskStyle}>
        <svg viewBox="0 0 132 132" style={svgStyle} aria-hidden>
          {/* Le rail du cadran, tracé à l'encre comme le reste du HUD. */}
          <path d={RPM_PATH} fill="none" stroke={HUD.ink} strokeWidth="9" strokeLinecap="round" />
          <path d={RPM_PATH} fill="none" stroke={HUD.paperShade} strokeWidth="5" strokeLinecap="round" />
          {/* Compte-tours : l'arc se remplit avec le regime, et vire au rouge
              en approchant de la zone rouge. C'est lui qui rend les passages de
              rapport lisibles — l'aiguille de vitesse, elle, ne retombe pas. */}
          <path
            d={RPM_PATH}
            fill="none"
            stroke={rpmRatio > 0.92 ? '#e63946' : '#f4820a'}
            strokeWidth="5"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={`${rpmRatio} 1`}
          />

          {/* Anneau intérieur : l'essence. Elle se lit d'un coup d'œil à la
              longueur de l'arc, et le chiffre exact reste sous la vitesse. */}
          <path d={FUEL_PATH} fill="none" stroke={HUD.paperShade} strokeWidth="4" strokeLinecap="round" />
          <path
            d={FUEL_PATH}
            fill="none"
            stroke={fuelColor}
            strokeWidth="4"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={`${fuel / 100} 1`}
          />

          {Array.from({ length: DIAL_TICKS + 1 }, (_, i) => (i * dialMaxKmh) / DIAL_TICKS).map((mark) => {
            const angle = ANGLE_MIN + (mark / dialMaxKmh) * (ANGLE_MAX - ANGLE_MIN)
            const from = polar(angle, 43)
            const to = polar(angle, 47)
            return (
              <line
                key={mark}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={HUD.ink}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )
          })}

          {/* L'aiguille GLISSE sur le rail au lieu de partir du centre : le
              centre est occupé par le chiffre, et c'est lui qu'on lit vraiment.
              Trait d'encre épais surmonté d'un rouge franc, comme les contours
              de la 3D — lisible sur n'importe quel fond. */}
          <g style={{ transform: `rotate(${needle}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
            <line x1={CX} y1={CY - 44} x2={CX} y2={CY - 60} stroke={HUD.ink} strokeWidth="8" strokeLinecap="round" />
            <line x1={CX} y1={CY - 45} x2={CX} y2={CY - 59} stroke="#e63946" strokeWidth="4" strokeLinecap="round" />
          </g>

          <text x={CX} y="48" textAnchor="middle" style={gearTextStyle}>
            {gearText}
          </text>
          <text x={CX} y="82" textAnchor="middle" style={speedTextStyle}>
            {speedText}
          </text>
          <text x={CX} y="94" textAnchor="middle" style={unitTextStyle}>
            km/h
          </text>
          <text x={CX} y="110" textAnchor="middle" style={{ ...fuelTextStyle, fill: fuelColor }}>
            {fuel}%
          </text>
        </svg>
      </div>

      {/* La touche R est rappelée ICI, au moment où elle sert — pas noyée dans
          une liste de raccourcis qu'on ne lit plus au bout de dix minutes.
          Poste éteint : on le dit clairement. « OFF » sans rien d'autre laissait
          croire à une radio en panne. */}
      <div style={radioPillStyle}>
        <span style={radioKeyStyle}>R</span>
        <span style={radioTextStyle}>{station ? station.shortName : 'RADIO ÉTEINTE'}</span>
      </div>
      {station && <div style={radioContentStyle}>{contentLabel ?? 'Silence'}</div>}
    </div>
  )
}

/** Le compteur occupe le coin bas gauche, libéré par la pastille « F1 Touches ». */
const wrapStyle: CSSProperties = {
  position: 'fixed',
  left: HUD.edge,
  bottom: HUD.edge,
  width: 138,
  display: 'grid',
  justifyItems: 'center',
  gap: 6,
  pointerEvents: 'none',
}

/** Le disque : même papier crème et même contour d'encre que les panneaux. */
const diskStyle: CSSProperties = {
  width: 132,
  height: 132,
  borderRadius: '50%',
  background: HUD.paper,
  border: outline,
  boxShadow: hardShadow,
}

const svgStyle: CSSProperties = { width: 132, height: 132, display: 'block' }

/** Rapport engagé, en haut du cadran (« CVT » pour le scooter). */
const gearTextStyle: CSSProperties = {
  font: `900 13px ${HUD.mono}`,
  fill: HUD.ink,
  letterSpacing: 1,
}
const speedTextStyle: CSSProperties = { font: `900 30px ${HUD.mono}`, fill: HUD.ink }
const unitTextStyle: CSSProperties = { font: `800 10px ${HUD.font}`, fill: HUD.textDim, letterSpacing: 0.8 }
const fuelTextStyle: CSSProperties = { font: `900 11px ${HUD.mono}` }

/** Témoins (limiteur, phares) : de petites pastilles au-dessus du cadran. */
const badgeRowStyle: CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }
const badgeStyle: CSSProperties = {
  ...panel,
  padding: '2px 8px',
  borderRadius: 999,
  boxShadow: 'none',
  font: `800 10px ${HUD.mono}`,
  letterSpacing: 0.6,
  whiteSpace: 'nowrap',
}

/** La radio tient sur une seule ligne, avec sa touche collée devant. */
const radioPillStyle: CSSProperties = {
  ...panel,
  width: '100%',
  boxSizing: 'border-box',
  padding: '3px 8px',
  borderRadius: 999,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const radioKeyStyle: CSSProperties = {
  flex: 'none',
  padding: '0 5px',
  borderRadius: 5,
  background: HUD.ink,
  color: HUD.paper,
  font: `800 10px ${HUD.mono}`,
}

const radioTextStyle: CSSProperties = {
  font: `900 11px ${HUD.font}`,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

/** Le titre en cours, posé sous la pastille : dispensable, donc discret. */
const radioContentStyle: CSSProperties = {
  maxWidth: '100%',
  font: `800 10px ${HUD.font}`,
  color: HUD.textDim,
  textAlign: 'center',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}
