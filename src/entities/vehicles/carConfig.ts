import type { VehicleDriveConfig } from './vehicleDriving'

/**
 * 🚗 La voiture prototype.
 *
 * Les chiffres ci-dessous sont de VRAIES grandeurs physiques (kg, N·m, m), pas
 * des nombres magiques : c'est ce qui rend le comportement previsible quand on
 * les ajuste. Le rayon de roue, l'empattement et la caisse de collision sont
 * cales sur le FBX `public/models/Vehicule/Voiture/Chevrolet.fbx`.
 *
 * ⚠️ **La vitesse maxi n'est pas reglee directement.** Elle sort de l'equilibre
 * entre la poussee du dernier rapport et la resistance de l'air. Avec les
 * valeurs ci-dessous, l'equilibre tombe a ~58 m/s, soit **210 km/h**, et il faut
 * une vingtaine de secondes pour passer de 180 a 210 — exactement le ressenti
 * d'une vraie voiture. `MAX_SPEED` n'est qu'un garde-fou (descente, bug).
 * Pour rendre la voiture plus rapide, baisse `DRAG` ; pour qu'elle reprenne
 * mieux, monte `PEAK_TORQUE` ou raccourcis les rapports.
 */
export const CAR: VehicleDriveConfig & { MOUNT_RANGE: number } = {
  /** Masse en ordre de marche, conducteur compris. */
  MASS: 1250,
  /** Rayon moyen des roues FBX : avant ~0,31 m, arriere ~0,34 m. */
  WHEEL_RADIUS: 0.33,
  /** Empattement mesure sur le FBX Chevrolet. */
  WHEELBASE: 2.87,
  /** Braquage maxi des roues avant : ~34°, arcade mais plausible. */
  MAX_STEER_ANGLE: 0.6,
  /** Clamp visuel separe : les roues restent lisibles meme si la physique braque plus fort. */
  VISUAL_STEER_MAX: 0.24,
  STEER_RESPONSE: 5.5,
  /** Une voiture de route tient environ 0,95 g en virage. Au-dela, elle sous-vire. */
  MAX_LATERAL_G: 0.95,
  /** Aide arcade progressive au-dela de ~45 km/h : moins realiste, beaucoup plus jouable. */
  STEER_ASSIST_G: 0.55,
  /** Adherence laterale : haut = colle a la route, bas = ca glisse en appui. */
  GRIP: 8.6,
  /** Freinage : ~1 g, ce que fait une voiture normale. */
  BRAKE_FORCE: 12000,
  REVERSE_FORCE: 4200,
  REVERSE_SPEED: 8,
  /**
   * Trainee : 0,5 × 1,225 × Cx × S, avec Cx ≈ 0,32 et S ≈ 2,2 m².
   * C'EST CE CHIFFRE QUI FIXE LES 210 KM/H.
   */
  DRAG: 0.431,
  ROLL_RESIST: 0.013,
  ENGINE_BRAKE: 900,
  /** Garde-fou : 210 km/h. En pratique la trainee plafonne avant. */
  MAX_SPEED: 58.33,

  ENGINE: {
    /** ~250 N·m : une compacte sportive. */
    PEAK_TORQUE: 249,
    PEAK_RPM: 4200,
    IDLE_RPM: 800,
    MAX_RPM: 6500,
    EFFICIENCY: 0.92,
    /**
     * Boite 6 rapports. Vitesses atteintes a la zone rouge :
     * 1re 45, 2e 74, 3e 108, 4e 143, 5e 179 km/h — la 6e est limitee par l'air.
     */
    GEARS: [4.4, 2.7, 1.85, 1.4, 1.12, 0.97],
    FINAL_DRIVE: 4.2,
    SHIFT_UP_RPM: 6200,
    SHIFT_DOWN_RPM: 1900,
    /** Le trou de couple qui fait SENTIR le passage de rapport. */
    SHIFT_TIME: 0.22,
    // Inutilises (boite a rapports, pas de variateur).
    CVT_TARGET_RPM: 0,
    CVT_RATIO_MIN: 0,
    CVT_RATIO_MAX: 0,
  },

  /** Frottement de tolerie, PAR SECONDE : raser une facade coute peu. */
  SCRAPE_FRICTION: 0.8,
  /** Petit rebond amorti quand on rentre dedans. */
  IMPACT_RESTITUTION: 0.25,
  /** Un choc pris sur une aile devie la caisse. */
  IMPACT_SPIN: 0.08,
  SPIN_DAMP: 3.5,
  /** Plus la course est grande, plus la voiture absorbe avant de decoller. */
  SUSPENSION_TRAVEL: 0.42,
  TAKEOFF_MIN_SPEED: 12,
  TAKEOFF_MIN_VELOCITY: 0.7,
  TAKEOFF_MIN_PITCH: 0.08,
  AIR_GRAVITY: 10.8,
  AIR_PITCH_CONTROL: 1.4,
  AIR_ROLL_CONTROL: 2.4,
  AIR_ROTATION_DAMP: 0.12,
  TAKEOFF_ROTATION_IMPULSE: 2.8,
  LANDING_BOUNCE: 0.18,

  /** Hauteur du joueur en position assise dans la voiture. */
  SEAT_HEIGHT: 1.05,
  /** Caisse de collision, calee sur le FBX (~4,92 m x 1,91 m), un peu rentree des pare-chocs. */
  COLLISION_HALF_LENGTH: 2.28,
  COLLISION_HALF_WIDTH: 0.9,
  /** Distance a laquelle on peut monter dans la voiture. */
  MOUNT_RANGE: 3.8,
}

/** Palette BD de la voiture prototype. */
export const CAR_COLORS = {
  body: '#2f7fd1',
  bodyDark: '#1f5f9f',
  glass: '#86c7df',
  trim: '#f0d35a',
  bumper: '#d8dde8',
  wheel: '#202129',
  tireHub: '#c9ced8',
} as const
