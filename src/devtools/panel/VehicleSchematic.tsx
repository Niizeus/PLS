import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { DevTuningGroup, VehicleZone } from '../devTuningTypes'

/**
 * Plan simplifie du vehicule, vu de dessus.
 *
 * Ce schema n est PAS decoratif : chaque zone correspond a une categorie de
 * reglages, et cliquer dessus ouvre la categorie. Il sert a repondre a la
 * question « je veux changer quoi, et ca se passe ou sur la voiture ? ».
 */
export default function VehicleSchematic({
  groups,
  activeGroupId,
  onPick,
}: {
  groups: DevTuningGroup[]
  activeGroupId: string | null
  onPick: (groupId: string) => void
}) {
  const [hovered, setHovered] = useState<VehicleZone | null>(null)

  const byZone = new Map<VehicleZone, DevTuningGroup>()
  for (const group of groups) if (group.zone) byZone.set(group.zone, group)

  const activeZone = groups.find((group) => group.id === activeGroupId)?.zone ?? null
  const hoveredGroup = hovered ? byZone.get(hovered) : undefined

  /** Couleurs et interactions d une zone cliquable. */
  const zone = (id: VehicleZone) => {
    const group = byZone.get(id)
    const isActive = activeZone === id
    const isHovered = hovered === id
    return {
      fill: isActive ? 'rgba(234,179,8,0.55)' : isHovered ? 'rgba(234,179,8,0.32)' : 'rgba(148,163,184,0.16)',
      stroke: isActive || isHovered ? '#facc15' : 'rgba(148,163,184,0.45)',
      strokeWidth: 1.5,
      cursor: group ? 'pointer' : 'not-allowed',
      onMouseEnter: () => setHovered(id),
      onMouseLeave: () => setHovered((current) => (current === id ? null : current)),
      onClick: () => group && onPick(group.id),
    }
  }

  return (
    <div style={wrapperStyle}>
      <svg viewBox="0 0 300 430" style={{ width: '100%', maxWidth: 260, display: 'block', margin: '0 auto' }}>
        {/* Carrosserie, purement graphique : elle donne le repere de lecture. */}
        <rect x={70} y={34} width={160} height={352} rx={34} fill="rgba(30,41,59,0.9)" stroke="rgba(148,163,184,0.5)" />
        <rect x={92} y={150} width={116} height={104} rx={16} fill="rgba(15,23,42,0.9)" stroke="rgba(148,163,184,0.3)" />

        {/* Aerodynamisme : le flux d air le long de la caisse. */}
        <rect x={20} y={70} width={26} height={280} rx={13} {...zone('aero')} />
        <rect x={254} y={70} width={26} height={280} rx={13} {...zone('aero')} />

        {/* Controle aerien : au-dessus du vehicule. */}
        <rect x={80} y={4} width={140} height={22} rx={11} {...zone('air')} />

        {/* Chocs : les deux pare-chocs. */}
        <rect x={74} y={30} width={152} height={14} rx={7} {...zone('body')} />
        <rect x={74} y={376} width={152} height={14} rx={7} {...zone('body')} />

        {/* Moteur : a l avant. */}
        <rect x={88} y={52} width={124} height={78} rx={12} {...zone('engine')} />

        {/* Eclairage : les phares. */}
        <rect x={84} y={36} width={30} height={12} rx={6} {...zone('lights')} />
        <rect x={186} y={36} width={30} height={12} rx={6} {...zone('lights')} />

        {/* Suspension : les deux essieux. */}
        <rect x={78} y={132} width={144} height={9} rx={4} {...zone('suspension')} />
        <rect x={78} y={288} width={144} height={9} rx={4} {...zone('suspension')} />

        {/* Adherence : les pneus. */}
        <rect x={46} y={108} width={30} height={58} rx={8} {...zone('wheels')} />
        <rect x={224} y={108} width={30} height={58} rx={8} {...zone('wheels')} />
        <rect x={46} y={264} width={30} height={58} rx={8} {...zone('wheels')} />
        <rect x={224} y={264} width={30} height={58} rx={8} {...zone('wheels')} />

        {/* Freinage : les disques, dans les roues. */}
        <circle cx={61} cy={137} r={9} {...zone('brakes')} />
        <circle cx={239} cy={137} r={9} {...zone('brakes')} />
        <circle cx={61} cy={293} r={9} {...zone('brakes')} />
        <circle cx={239} cy={293} r={9} {...zone('brakes')} />

        {/* Direction : le train avant. */}
        <rect x={96} y={106} width={108} height={20} rx={10} {...zone('steering')} />

        {/* Drift : l arriere qui part en travers. */}
        <rect x={84} y={330} width={132} height={22} rx={11} {...zone('drift')} />

        {/* Audio : le klaxon, au centre du volant. */}
        <circle cx={150} cy={182} r={14} {...zone('audio')} />

        {/* Poids : le centre du vehicule. */}
        <circle cx={150} cy={228} r={22} {...zone('mass')} />

        <g fill="#cbd5e1" fontSize={9} fontFamily="system-ui, sans-serif" textAnchor="middle" pointerEvents="none">
          <text x={150} y={19}>Vol</text>
          <text x={150} y={96}>Moteur</text>
          <text x={150} y={121}>Direction</text>
          <text x={150} y={186}>Son</text>
          <text x={150} y={232}>Poids</text>
          <text x={150} y={346}>Drift</text>
          <text x={33} y={215} transform="rotate(-90 33 215)">Aero</text>
          <text x={267} y={215} transform="rotate(90 267 215)">Aero</text>
          <text x={61} y={92}>Pneus</text>
          <text x={239} y={92}>Pneus</text>
          <text x={61} y={340}>Freins</text>
          <text x={150} y={402}>Chocs</text>
          <text x={150} y={140} fill="#94a3b8">Suspension</text>
        </g>
      </svg>

      <div style={captionStyle}>
        {hoveredGroup ? (
          <>
            <b>
              {hoveredGroup.icon} {hoveredGroup.label}
            </b>{' '}
            — {hoveredGroup.summary}
          </>
        ) : hovered ? (
          <span style={{ color: '#94a3b8' }}>Aucun reglage expose pour cette partie du vehicule.</span>
        ) : (
          <span style={{ color: '#94a3b8' }}>Clique une partie du vehicule pour ouvrir ses reglages.</span>
        )}
      </div>
    </div>
  )
}

const wrapperStyle: CSSProperties = {
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: 8,
  background: 'rgba(2,6,23,0.45)',
  padding: 12,
  marginBottom: 12,
}

const captionStyle: CSSProperties = {
  marginTop: 8,
  minHeight: 32,
  fontSize: 12,
  lineHeight: 1.35,
  color: '#e5e7eb',
  textAlign: 'center',
}
