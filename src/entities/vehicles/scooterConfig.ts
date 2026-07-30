import type { VehicleDriveConfig } from './vehicleDriving'

/**
 * 🛵 Le scooter.
 *
 * Pas de boite de vitesses : un scooter a un **variateur** (CVT). Le moteur
 * monte vite a son regime de travail et y reste, pendant que le rapport glisse
 * en continu. C'est pour ca qu'un scooter hurle a regime constant en
 * accelerant, et que la poussee s'ecroule doucement en approchant du maxi.
 *
 * ⚠️ Comme pour la voiture, **la vitesse maxi n'est pas reglee directement** :
 * elle sort de l'equilibre entre la poussee et la trainee. Un scooter et son
 * pilote sont tres peu aerodynamiques (Cx·S ≈ 0,95), d'ou une trainee elevee
 * qui plafonne naturellement autour de **75 km/h**. `MAX_SPEED` est le
 * garde-fou correspondant.
 */
export const SCOOTER: VehicleDriveConfig & { MOUNT_RANGE: number } = {
  /** Scooter (~110 kg) + pilote. */
  MASS: 190,
  /** Rayon de roue (m) — cale sur le visuel de Scooter.tsx. */
  WHEEL_RADIUS: 0.24,
  /** Empattement : les roues sont a z = -0,52 et +0,50 dans Scooter.tsx. */
  WHEELBASE: 1.02,
  /** Un deux-roues braque beaucoup plus qu'une voiture. */
  MAX_STEER_ANGLE: 0.72,
  /** Expose au F2 par coherence avec les vehicules, peu utilise par le scooter actuel. */
  VISUAL_STEER_MAX: 0.42,
  STEER_RESPONSE: 9,
  /** Un scooter tient moins en virage qu'une voiture. */
  MAX_LATERAL_G: 0.75,
  /** Petit bonus arcade : le deux-roues doit rester nerveux sans devenir impossible. */
  STEER_ASSIST_G: 0.25,
  /** Leger et etroit : il derape peu, il bascule. */
  GRIP: 11,
  BRAKE_FORCE: 1500,
  REVERSE_FORCE: 260,
  /** On pousse le scooter a la main : tres lent. */
  REVERSE_SPEED: 2.5,
  /** 0,5 × 1,225 × 0,95 (Cx·S d'un scooter + pilote). FIXE LES 75 KM/H. */
  DRAG: 0.582,
  ROLL_RESIST: 0.02,
  ENGINE_BRAKE: 120,
  /** Garde-fou : 75 km/h. */
  MAX_SPEED: 20.83,

  ENGINE: {
    /** Un 125 cm³ fait une dizaine de N·m. */
    PEAK_TORQUE: 10,
    PEAK_RPM: 6500,
    IDLE_RPM: 1600,
    MAX_RPM: 8500,
    EFFICIENCY: 0.88,
    /** `null` = variateur : pas de rapport a passer. */
    GEARS: null,
    FINAL_DRIVE: 1,
    SHIFT_UP_RPM: 0,
    SHIFT_DOWN_RPM: 0,
    SHIFT_TIME: 0,
    /** Regime que le variateur tient sous les gaz. */
    CVT_TARGET_RPM: 7200,
    /** Rapport le plus long (haute vitesse) : c'est lui qui borne le maxi. */
    CVT_RATIO_MIN: 9.05,
    /** Rapport le plus court : la poussee au demarrage. */
    CVT_RATIO_MAX: 22,
  },

  /** Frottement, PAR SECONDE : un deux-roues accroche plus qu'une carrosserie. */
  SCRAPE_FRICTION: 1.6,
  /** Un deux-roues ne rebondit quasiment pas : il s'arrete. */
  IMPACT_RESTITUTION: 0.15,
  IMPACT_SPIN: 0.14,
  SPIN_DAMP: 4.5,
  SUSPENSION_TRAVEL: 0.28,
  TAKEOFF_MIN_SPEED: 8,
  TAKEOFF_MIN_VELOCITY: 0.55,
  TAKEOFF_MIN_PITCH: 0.07,
  AIR_GRAVITY: 11.5,
  AIR_PITCH_CONTROL: 2.2,
  AIR_ROLL_CONTROL: 3.8,
  AIR_ROTATION_DAMP: 0.18,
  TAKEOFF_ROTATION_IMPULSE: 4.2,
  LANDING_BOUNCE: 0.12,

  /** Hauteur du perso quand il est assis dessus. */
  SEAT_HEIGHT: 1.15,
  /** Caisse de collision, calee sur le visuel (~1,56 m x 0,6 m). */
  COLLISION_HALF_LENGTH: 0.78,
  COLLISION_HALF_WIDTH: 0.3,
  /** Distance a laquelle on peut monter sur le scooter (metres). */
  MOUNT_RANGE: 3,

  /**
   * Reglages de conduite avancee (limiteur, frein a main, controle aerien).
   * ⚠️ Le scooter roule encore sur l'ancien modele `vehicleDriving.ts` et n'en
   * utilise AUCUN pour l'instant : ils sont la parce que `VehicleDriveConfig`
   * est commun aux deux vehicules. Ils serviront le jour ou le scooter passera
   * lui aussi sur le chassis Rapier — d'ou des valeurs deja plausibles.
   */
  LIMITER_MIN_SPEED: 5,
  LIMITER_FADE_SPEED: 2,
  HANDBRAKE_FORCE: 900,
  HANDBRAKE_REAR_GRIP: 0.35,
  DRIFT_STEER_AUTHORITY: 0.5,
  SURFACE_GRIP_ROAD: 1,
  SURFACE_GRIP_OFFROAD: 0.6,
  AIR_PITCH_TORQUE: 2.6,
  AIR_ROLL_TORQUE: 2.2,
  AIR_MAX_RATE: 2.2,
  AIR_LEVEL_ASSIST: 1.8,
  FLIP_RECOVERY_HOLD: 0.8,
}

/** Couleurs du scooter (cartoon). */
export const SCOOTER_COLORS = {
  body: '#e8524a',
  seat: '#2c2c3a',
  metal: '#c8ccd4',
  wheel: '#1e1e24',
} as const
