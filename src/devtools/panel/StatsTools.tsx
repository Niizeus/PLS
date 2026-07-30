import { useCarStore } from '../../entities/vehicles/carStore'
import { useScooterStore } from '../../entities/vehicles/scooterStore'
import { useCharacterStatsStore, type CharacterStats } from '../../gameplay/stats/characterStatsStore'
import {
  actionRowStyle,
  buttonStyle,
  fieldGridStyle,
  fieldStyle,
  fieldTopStyle,
  helpStyle,
  numberInputStyle,
} from './devPanelStyles'

const STAT_FIELDS: { key: keyof CharacterStats; label: string; help: string; max: number }[] = [
  { key: 'health', label: 'Vie', help: 'Points de vie restants.', max: 100 },
  { key: 'hunger', label: 'Faim', help: '100 = repu, 0 = affame.', max: 100 },
  { key: 'thirst', label: 'Soif', help: '100 = desaltere, 0 = assoiffe.', max: 100 },
  { key: 'mental', label: 'Mental', help: 'Moral du perso, 0 = craquage.', max: 100 },
  { key: 'attack', label: 'Attaque', help: 'Degats infliges au corps a corps.', max: 99 },
  { key: 'defense', label: 'Defense', help: 'Degats encaisses en moins.', max: 99 },
  { key: 'agility', label: 'Agilite', help: 'Aisance de deplacement.', max: 99 },
  { key: 'chance', label: 'Chance', help: 'Influence les evenements aleatoires.', max: 99 },
  { key: 'speed', label: 'Rapidite', help: 'Statistique de vitesse du perso.', max: 99 },
  { key: 'chaos', label: 'Chaos', help: 'Niveau de bordel seme dans Beauvais.', max: 99 },
]

/** Onglet Stats : etat du perso, pour tester une situation sans la jouer. */
export default function StatsTools({ stats }: { stats: CharacterStats }) {
  const setStat = (key: keyof CharacterStats, next: number) => {
    const current = useCharacterStatsStore.getState()[key]
    useCharacterStatsStore.getState().applyEffects({ [key]: next - current })
  }

  return (
    <div style={fieldGridStyle}>
      <div style={actionRowStyle}>
        <button style={buttonStyle} onClick={refillVitals}>
          Remettre vie / faim / soif / mental a fond
        </button>
        <button style={buttonStyle} onClick={refillFuel}>
          Faire le plein des vehicules
        </button>
      </div>
      {STAT_FIELDS.map((field) => (
        <label key={field.key} style={fieldStyle}>
          <span style={fieldTopStyle}>
            <span>{field.label}</span>
            <input
              style={numberInputStyle}
              type="number"
              min={0}
              max={field.max}
              step={1}
              value={stats[field.key]}
              onChange={(event) => setStat(field.key, Number(event.target.value))}
            />
          </span>
          <input
            type="range"
            min={0}
            max={field.max}
            step={1}
            value={stats[field.key]}
            onChange={(event) => setStat(field.key, Number(event.target.value))}
          />
          <small style={helpStyle}>{field.help}</small>
        </label>
      ))}
    </div>
  )
}

function refillVitals() {
  const store = useCharacterStatsStore.getState()
  store.applyEffects({
    health: 100 - store.health,
    hunger: 100 - store.hunger,
    thirst: 100 - store.thirst,
    mental: 100 - store.mental,
  })
}

function refillFuel() {
  useCarStore.setState((state) => ({ fuelLiters: state.fuelCapacityLiters }))
  useScooterStore.setState((state) => ({ fuelLiters: state.fuelCapacityLiters }))
}
