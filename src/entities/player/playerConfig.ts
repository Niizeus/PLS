/** Réglages du joueur, regroupés pour être faciles à ajuster (feeling du perso). */
export const PLAYER = {
  /** Vitesse de marche (unités/seconde). */
  WALK_SPEED: 4.5,
  /** Vitesse en courant (Maj). */
  RUN_SPEED: 8.5,
  /** Vitesse de rotation du perso vers sa direction (plus haut = plus vif). */
  TURN_SPEED: 12,
  /** Durée d'une attaque, en secondes. */
  ATTACK_DURATION: 0.35,
  /** Durée du geste d'interaction (E), en secondes. */
  INTERACT_DURATION: 0.4,
  /** Hauteur du centre du corps au-dessus du sol. */
  BODY_HEIGHT: 1.0,
} as const

/** Palette du personnage Chibrux (placeholder). */
export const CHIBRUX_COLORS = {
  skin: '#f0b088',
  jacket: '#3b6ea5',
  pants: '#2c2c3a',
  hair: '#3a2a1a',
} as const
