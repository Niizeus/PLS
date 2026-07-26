/** Réglages du scooter, regroupés pour ajuster facilement le feeling de conduite. */
export const SCOOTER = {
  /** Accélération quand on avance (Z), en unités/s². */
  ACCEL: 20,
  /** Décélération au frein / marche arrière (S). */
  BRAKE: 26,
  /** Vitesse maxi en avant (bien plus rapide qu'à pied). */
  MAX_SPEED: 26,
  /** Vitesse maxi en marche arrière. */
  REVERSE_SPEED: 6,
  /** Frein moteur : ralentissement naturel quand on ne touche à rien. */
  FRICTION: 6,
  /** Vitesse de braquage a pleine vitesse (rad/s). Diminue avec la vitesse. */
  STEER: 2.2,
  /** Vitesse a laquelle le guidon rejoint l'intention du joueur. */
  STEER_RESPONSE: 10,
  /** Part de braquage conservee a basse vitesse. */
  MIN_STEER_FACTOR: 0.35,
  /** Caisse de collision, calee sur le visuel du scooter (~1,5 m x 0,6 m). */
  COLLISION_HALF_LENGTH: 0.78,
  COLLISION_HALF_WIDTH: 0.3,
  /** Choc de plein fouet : un deux-roues s'arrete net. */
  IMPACT_LOSS: 0.92,
  /** Frottement quand on rase un mur (part perdue par seconde). */
  SCRAPE_DRAG: 1.2,
  /** Hauteur du perso quand il est assis dessus. */
  SEAT_HEIGHT: 1.15,
  /** Distance à laquelle on peut monter sur le scooter (mètres). */
  MOUNT_RANGE: 3,
} as const

/** Couleurs du scooter (cartoon). */
export const SCOOTER_COLORS = {
  body: '#e8524a',
  seat: '#2c2c3a',
  metal: '#c8ccd4',
  wheel: '#1e1e24',
} as const
