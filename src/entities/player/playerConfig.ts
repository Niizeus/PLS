/** Réglages du joueur, regroupés pour être faciles à ajuster (feeling du perso). */
export const PLAYER = {
  /** Vitesse de marche (unités/seconde). */
  WALK_SPEED: 4.5,
  /** Vitesse en courant (Maj). */
  RUN_SPEED: 8.5,
  /** Vitesse de rotation du perso vers sa direction (plus haut = plus vif). */
  TURN_SPEED: 12,
  /**
   * Combat à MAINS NUES : durée (en secondes) de chacun des 3 coups de
   * l'enchaînement. Une durée = une animation de poing (Punching 1/2/3).
   * Plus court = plus nerveux ; le 3e coup est volontairement plus lourd.
   * (Durées d'origine des FBX Mixamo : 0.70 / 0.80 / 0.90 s — on accélère un peu
   * pour que l'enchaînement claque. Ne descends pas trop bas : ça devient saccadé.)
   */
  COMBO_DURATIONS: [0.55, 0.6, 0.8],
  /**
   * Fenêtre d'enchaînement (secondes) : temps APRÈS la fin d'un coup pendant
   * lequel un nouveau clic enchaîne sur le coup suivant. Passé ce délai,
   * l'enchaînement repart au coup n°1.
   */
  COMBO_WINDOW: 0.5,
  /** Durée (secondes) d'une attaque quand une ARME est équipée. */
  WEAPON_ATTACK_DURATION: 0.6,
  /**
   * Durée (secondes) de l'animation "hurt" quand on encaisse des dégâts.
   * Pendant ce temps le joueur est sonné : il ne bouge pas, ne frappe pas, ne saute pas.
   * (Le FBX d'origine dure 1.77 s — trop long en jeu, on le joue plus vite.)
   */
  HURT_DURATION: 1.0,
  /** Durée du geste d'interaction (E), en secondes. */
  INTERACT_DURATION: 0.4,
  /** Hauteur du centre du corps au-dessus du sol. */
  BODY_HEIGHT: 1.0,
  /** Vitesse en marchant accroupi (plus lent). */
  CROUCH_SPEED: 2.2,
  /** Vitesse verticale initiale d'un saut. */
  JUMP_SPEED: 6,
  /** Gravité appliquée pendant un saut (u/s²). */
  GRAVITY: 16,
} as const

/** Palette du personnage Chibrux (placeholder). */
export const CHIBRUX_COLORS = {
  skin: '#f0b088',
  jacket: '#3b6ea5',
  pants: '#2c2c3a',
  hair: '#3a2a1a',
} as const
