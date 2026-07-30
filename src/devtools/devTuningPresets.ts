import { CAR } from '../entities/vehicles/carConfig'
import { SCOOTER } from '../entities/vehicles/scooterConfig'
import type { DevTuningPreset, DevTuningPresetSet, VehicleKind } from './devTuningTypes'

/**
 * Prereglages : un nom qu on comprend, plusieurs valeurs techniques posees d un coup.
 *
 * Les valeurs sont calculees a partir des reglages d origine du vehicule
 * (`carConfig.ts` / `scooterConfig.ts`) : « arcade » veut dire la meme chose pour
 * une voiture de 1250 kg et pour un scooter de 190 kg, sans recopier des nombres
 * a la main dans deux endroits.
 */
export function getVehiclePresetSets(kind: VehicleKind): DevTuningPresetSet[] {
  const base = kind === 'car' ? CAR : SCOOTER

  return [
    {
      id: 'drivingStyle',
      group: 'general',
      label: 'Style de conduite',
      help: 'Deplace d un coup l adherence, l aide au virage et le controle en glisse.',
      presets: [
        preset('realistic', 'Realiste', 'Aucune aide arcade : ca sous-vire, ca surprend, il faut anticiper.', {
          GRIP: base.GRIP * 0.9,
          MAX_LATERAL_G: base.MAX_LATERAL_G * 0.95,
          STEER_ASSIST_G: 0,
          STEER_RESPONSE: base.STEER_RESPONSE * 0.85,
          DRIFT_STEER_AUTHORITY: 0.2,
          AIR_LEVEL_ASSIST: base.AIR_LEVEL_ASSIST * 0.4,
        }),
        preset('balanced', 'Equilibre', 'Le reglage d origine du projet : credible mais jouable au clavier.', {
          GRIP: base.GRIP,
          MAX_LATERAL_G: base.MAX_LATERAL_G,
          STEER_ASSIST_G: base.STEER_ASSIST_G,
          STEER_RESPONSE: base.STEER_RESPONSE,
          DRIFT_STEER_AUTHORITY: base.DRIFT_STEER_AUTHORITY,
          AIR_LEVEL_ASSIST: base.AIR_LEVEL_ASSIST,
        }),
        preset('arcade', 'Arcade', 'Ca colle a la route et ca tourne : on se concentre sur la trajectoire.', {
          GRIP: base.GRIP * 1.2,
          MAX_LATERAL_G: base.MAX_LATERAL_G * 1.25,
          STEER_ASSIST_G: base.STEER_ASSIST_G * 1.6 + 0.15,
          STEER_RESPONSE: base.STEER_RESPONSE * 1.3,
          DRIFT_STEER_AUTHORITY: 0.55,
          AIR_LEVEL_ASSIST: base.AIR_LEVEL_ASSIST * 1.4,
        }),
        preset('superArcade', 'Tres arcade', 'Cartoon assume : le vehicule va ou on regarde, presque impossible a planter.', {
          GRIP: base.GRIP * 1.5,
          MAX_LATERAL_G: Math.min(base.MAX_LATERAL_G * 1.6, 1.9),
          STEER_ASSIST_G: 1.1,
          STEER_RESPONSE: base.STEER_RESPONSE * 1.7,
          DRIFT_STEER_AUTHORITY: 0.75,
          AIR_LEVEL_ASSIST: base.AIR_LEVEL_ASSIST * 2,
        }),
      ],
    },
    {
      id: 'gripLevel',
      group: 'grip',
      label: 'Adherence',
      help: 'Reglage groupe des pneus, sur route et hors route.',
      presets: [
        preset('low', 'Faible', 'Pneus uses ou route mouillee : ca glisse vite.', {
          GRIP: base.GRIP * 0.65,
          MAX_LATERAL_G: base.MAX_LATERAL_G * 0.7,
          SURFACE_GRIP_ROAD: 0.85,
          SURFACE_GRIP_OFFROAD: base.SURFACE_GRIP_OFFROAD * 0.7,
        }),
        preset('normal', 'Normale', 'Adherence d origine du vehicule.', {
          GRIP: base.GRIP,
          MAX_LATERAL_G: base.MAX_LATERAL_G,
          SURFACE_GRIP_ROAD: base.SURFACE_GRIP_ROAD,
          SURFACE_GRIP_OFFROAD: base.SURFACE_GRIP_OFFROAD,
        }),
        preset('high', 'Elevee', 'Pneus de piste : le vehicule est sur des rails sur bitume.', {
          GRIP: base.GRIP * 1.35,
          MAX_LATERAL_G: Math.min(base.MAX_LATERAL_G * 1.4, 1.9),
          SURFACE_GRIP_ROAD: 1.15,
          SURFACE_GRIP_OFFROAD: base.SURFACE_GRIP_OFFROAD,
        }),
        preset('offroad', 'Tout-terrain', 'Un peu moins bon sur bitume, beaucoup mieux dans les champs.', {
          GRIP: base.GRIP * 1.05,
          MAX_LATERAL_G: base.MAX_LATERAL_G * 0.95,
          SURFACE_GRIP_ROAD: 0.95,
          SURFACE_GRIP_OFFROAD: 0.95,
        }),
      ],
    },
    {
      id: 'suspensionFeel',
      group: 'suspension',
      label: 'Comportement de la suspension',
      help: 'Ce que le vehicule absorbe avant de sauter, et comment il retombe.',
      presets: [
        preset('soft', 'Souple', 'Avale les trottoirs, mais tangue et rebondit.', {
          SUSPENSION_TRAVEL: base.SUSPENSION_TRAVEL * 1.6,
          LANDING_BOUNCE: base.LANDING_BOUNCE * 1.6,
        }),
        preset('standard', 'Standard', 'Reglage d origine.', {
          SUSPENSION_TRAVEL: base.SUSPENSION_TRAVEL,
          LANDING_BOUNCE: base.LANDING_BOUNCE,
        }),
        preset('sport', 'Sportive', 'Plus ferme : moins de mouvement de caisse, plus de bosses ressenties.', {
          SUSPENSION_TRAVEL: base.SUSPENSION_TRAVEL * 0.7,
          LANDING_BOUNCE: base.LANDING_BOUNCE * 0.7,
        }),
        preset('stiff', 'Rigide', 'Presque pas de debattement : chaque bosse envoie le vehicule en l air.', {
          SUSPENSION_TRAVEL: base.SUSPENSION_TRAVEL * 0.4,
          LANDING_BOUNCE: base.LANDING_BOUNCE * 0.35,
        }),
      ],
    },
    {
      id: 'driftFeel',
      group: 'drift',
      label: 'Drift',
      help: 'A quel point l arriere decroche au frein a main, et si on peut le rattraper.',
      presets: [
        preset('off', 'Desactive', 'Le frein a main freine, point. Aucune glisse.', {
          HANDBRAKE_REAR_GRIP: 1,
          HANDBRAKE_FORCE: base.HANDBRAKE_FORCE * 0.8,
          DRIFT_STEER_AUTHORITY: 1,
        }),
        preset('light', 'Leger', 'L arriere bouge un peu, surtout a haute vitesse.', {
          HANDBRAKE_REAR_GRIP: 0.55,
          HANDBRAKE_FORCE: base.HANDBRAKE_FORCE * 0.9,
          DRIFT_STEER_AUTHORITY: 0.5,
        }),
        preset('arcade', 'Arcade', 'Reglage d origine : la glisse est franche mais rattrapable.', {
          HANDBRAKE_REAR_GRIP: base.HANDBRAKE_REAR_GRIP,
          HANDBRAKE_FORCE: base.HANDBRAKE_FORCE,
          DRIFT_STEER_AUTHORITY: base.DRIFT_STEER_AUTHORITY,
        }),
        preset('heavy', 'Prononce', 'Ca part en travers tout de suite et ca glisse longtemps.', {
          HANDBRAKE_REAR_GRIP: 0.12,
          HANDBRAKE_FORCE: base.HANDBRAKE_FORCE * 0.75,
          DRIFT_STEER_AUTHORITY: 0.28,
        }),
      ],
    },
    {
      id: 'airControl',
      group: 'air',
      label: 'Controle aerien',
      help: 'Ce qu on peut faire pendant un saut.',
      presets: [
        preset('low', 'Faible', 'On subit sa trajectoire : les tremplins se preparent avant de decoller.', {
          AIR_PITCH_CONTROL: base.AIR_PITCH_CONTROL * 0.5,
          AIR_ROLL_CONTROL: base.AIR_ROLL_CONTROL * 0.5,
          AIR_MAX_RATE: base.AIR_MAX_RATE * 0.6,
          AIR_LEVEL_ASSIST: base.AIR_LEVEL_ASSIST * 0.5,
        }),
        preset('normal', 'Normal', 'Reglage d origine : de quoi se remettre a plat avant de toucher le sol.', {
          AIR_PITCH_CONTROL: base.AIR_PITCH_CONTROL,
          AIR_ROLL_CONTROL: base.AIR_ROLL_CONTROL,
          AIR_MAX_RATE: base.AIR_MAX_RATE,
          AIR_LEVEL_ASSIST: base.AIR_LEVEL_ASSIST,
        }),
        preset('high', 'Fort', 'Saltos et tonneaux a volonte, style jeu de cascades.', {
          AIR_PITCH_CONTROL: base.AIR_PITCH_CONTROL * 2,
          AIR_ROLL_CONTROL: base.AIR_ROLL_CONTROL * 2,
          AIR_MAX_RATE: base.AIR_MAX_RATE * 1.8,
          AIR_LEVEL_ASSIST: base.AIR_LEVEL_ASSIST * 1.3,
        }),
      ],
    },
  ]
}

/** Prereglages d une section non vehicule (aucun pour l instant hors vehicules). */
export function getPresetSets(section: string): DevTuningPresetSet[] {
  if (section === 'car' || section === 'scooter') return getVehiclePresetSets(section)
  return []
}

function preset(id: string, label: string, description: string, values: Record<string, number>): DevTuningPreset {
  const rounded: Record<string, number> = {}
  for (const [key, value] of Object.entries(values)) rounded[key] = Number(value.toFixed(4))
  return { id, label, description, values: rounded }
}
