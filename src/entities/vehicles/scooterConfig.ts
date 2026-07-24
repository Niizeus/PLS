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
  /** Vitesse de braquage à pleine vitesse (rad/s). Diminue avec la vitesse. */
  STEER: 2.2,
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
