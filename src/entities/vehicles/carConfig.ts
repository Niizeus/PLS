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
  /** Petit rebond amorti contre les murs. */
  COLLISION_BRAKE: 0.08,
  /** Rayon autour de chaque point de contact de l'empreinte voiture. */
  COLLISION_RADIUS: 0.28,
  /** Demi-longueur testee contre les murs, un peu sous le visuel pour garder du jeu. */
  COLLISION_HALF_LENGTH: 1.62,
  /** Demi-largeur testee contre les murs. */
  COLLISION_HALF_WIDTH: 0.68,
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
