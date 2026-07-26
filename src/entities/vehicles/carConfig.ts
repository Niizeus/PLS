/** Reglages de la voiture prototype, orientes conduite arcade souple. */
export const CAR = {
  /** Acceleration progressive, moins nerveuse que le scooter. */
  ACCEL: 15,
  /** Freinage volontairement plus fort que l'acceleration. */
  BRAKE: 24,
  /** Vitesse maxi en avant, assez rapide pour traverser Beauvais. */
  MAX_SPEED: 32,
  /** Marche arriere lente et controlable. */
  REVERSE_SPEED: 7,
  /** Frein moteur doux quand on relache les touches. */
  FRICTION: 4.2,
  /** Braquage maxi, plus large et plus lourd qu'un scooter. */
  STEER: 1.75,
  /** Lissage de direction pour eviter la rigidite. */
  STEER_RESPONSE: 5.5,
  /** La voiture peut manoeuvrer doucement meme presque a l'arret. */
  MIN_STEER_FACTOR: 0.5,
  /**
   * Caisse de collision, calee sur le visuel (chassis 3,9 m x 1,8 m dans Car.tsx),
   * avec quelques centimetres de jeu pour ne pas accrocher au moindre pixel.
   */
  COLLISION_HALF_LENGTH: 1.9,
  COLLISION_HALF_WIDTH: 0.86,
  /** Choc de plein fouet : on perd 85 % de la vitesse. */
  IMPACT_LOSS: 0.85,
  /** Frottement de carrosserie quand on rase un mur (part perdue par seconde). */
  SCRAPE_DRAG: 0.9,
  /** Hauteur du joueur en position assise dans la voiture. */
  SEAT_HEIGHT: 1.05,
  /** Distance a laquelle on peut monter dans la voiture. */
  MOUNT_RANGE: 3.5,
} as const

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
