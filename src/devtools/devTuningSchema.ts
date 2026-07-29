import type { DevTuningField } from './devTuningTypes'

export const DEV_TUNING_FIELDS: DevTuningField[] = [
  field('player.WALK_SPEED', 'player', 'Vitesse marche', 'Deplacement normal du joueur.', 0, 20, 0.1),
  field('player.RUN_SPEED', 'player', 'Vitesse course', 'Vitesse avec Maj.', 0, 30, 0.1),
  field('player.CROUCH_SPEED', 'player', 'Vitesse accroupi', 'Deplacement quand le joueur est accroupi.', 0, 12, 0.1),
  field('player.TURN_SPEED', 'player', 'Rotation joueur', 'Vitesse de rotation vers la direction de marche.', 0, 30, 0.1),
  field('player.JUMP_SPEED', 'player', 'Force saut', 'Vitesse verticale initiale du saut.', 0, 20, 0.1),
  field('player.GRAVITY', 'player', 'Gravite saut', 'Acceleration verticale appliquee pendant le saut.', 0, 50, 0.1),
  field('player.BODY_HEIGHT', 'player', 'Hauteur corps', 'Centre du corps au-dessus du sol.', 0.2, 3, 0.01),
  field('player.BODY_RADIUS', 'player', 'Rayon collision', 'Rayon du cylindre de collision joueur.', 0.1, 1.5, 0.01),
  field('player.COMBO_WINDOW', 'player', 'Fenetre combo', 'Delai pour enchainer les coups.', 0, 2, 0.01),
  field('player.WEAPON_ATTACK_DURATION', 'player', 'Duree attaque arme', 'Duree de l attaque avec arme equipee.', 0.1, 3, 0.01),
  field('player.HURT_DURATION', 'player', 'Duree degats', 'Temps ou le joueur reste sonne.', 0, 4, 0.01),
  field('player.INTERACT_DURATION', 'player', 'Duree interaction', 'Duree du geste d interaction.', 0, 2, 0.01),
  field('player.COMBO_DURATIONS.0', 'player', 'Poing 1', 'Duree du premier coup.', 0.1, 2, 0.01),
  field('player.COMBO_DURATIONS.1', 'player', 'Poing 2', 'Duree du second coup.', 0.1, 2, 0.01),
  field('player.COMBO_DURATIONS.2', 'player', 'Poing 3', 'Duree du troisieme coup.', 0.1, 2.5, 0.01),

  field('camera.SENSITIVITY', 'camera', 'Sensibilite souris', 'Radians de rotation par pixel souris.', 0.0005, 0.01, 0.0001),
  field('camera.PITCH_MIN', 'camera', 'Pitch min', 'Angle vertical minimal de la camera.', -1.2, 0.5, 0.01),
  field('camera.PITCH_MAX', 'camera', 'Pitch max', 'Angle vertical maximal de la camera.', 0.2, 1.8, 0.01),
  field('camera.INVERT_Y', 'camera', 'Inversion Y', '0 = normal, 1 = inverse.', 0, 1, 1),

  field('inventory.MAX_CARRY_WEIGHT', 'inventory', 'Poids max inventaire', 'Charge maximale avant blocage/penalite.', 1, 80, 0.5),

  ...vehicleFields('car', 'Voiture', 1),
  ...vehicleFields('scooter', 'Scooter', 0.5),
]

function vehicleFields(kind: 'car' | 'scooter', label: string, forceStep: number): DevTuningField[] {
  const prefix = `vehicles.${kind}.`
  return [
    field(`${prefix}MASS`, kind, `${label} masse`, 'Masse totale conducteur compris.', 20, 3000, 1),
    field(`${prefix}MAX_STEER_ANGLE`, kind, `${label} braquage max`, 'Angle maximal des roues avant.', 0, 1.3, 0.01),
    field(`${prefix}STEER_RESPONSE`, kind, `${label} reponse direction`, 'Vitesse du braquage vers l intention.', 0, 20, 0.1),
    field(`${prefix}MAX_LATERAL_G`, kind, `${label} adherence G`, 'Limite de grip en virage.', 0.1, 2, 0.01),
    field(`${prefix}GRIP`, kind, `${label} grip`, 'Vitesse a laquelle la derive laterale disparait.', 0, 25, 0.1),
    field(`${prefix}BRAKE_FORCE`, kind, `${label} frein`, 'Force de freinage.', 0, 25000, forceStep),
    field(`${prefix}REVERSE_FORCE`, kind, `${label} marche arriere`, 'Poussee en marche arriere.', 0, 10000, forceStep),
    field(`${prefix}REVERSE_SPEED`, kind, `${label} vitesse arriere`, 'Vitesse maximale en marche arriere.', 0, 20, 0.1),
    field(`${prefix}DRAG`, kind, `${label} trainee air`, 'Resistance aerodynamique, fixe beaucoup la vitesse max.', 0, 2, 0.001),
    field(`${prefix}ROLL_RESIST`, kind, `${label} roulement`, 'Resistance au roulement.', 0, 0.1, 0.001),
    field(`${prefix}ENGINE_BRAKE`, kind, `${label} frein moteur`, 'Force de ralentissement pied leve.', 0, 3000, forceStep),
    field(`${prefix}MAX_SPEED`, kind, `${label} vitesse garde-fou`, 'Vitesse maximale de securite en m/s.', 1, 100, 0.1),
    field(`${prefix}SCRAPE_FRICTION`, kind, `${label} friction mur`, 'Perte de vitesse quand le vehicule rase un obstacle.', 0, 6, 0.01),
    field(`${prefix}IMPACT_RESTITUTION`, kind, `${label} rebond impact`, 'Part de vitesse renvoyee apres collision.', 0, 1, 0.01),
    field(`${prefix}IMPACT_SPIN`, kind, `${label} spin impact`, 'Rotation ajoutee sur choc decentre.', 0, 0.5, 0.001),
    field(`${prefix}SPIN_DAMP`, kind, `${label} amorti spin`, 'Vitesse de disparition du spin apres impact.', 0, 12, 0.1),
    field(`${prefix}MOUNT_RANGE`, kind, `${label} portee monter`, 'Distance pour monter dans le vehicule.', 0.5, 8, 0.1),
    field(`${prefix}ENGINE.PEAK_TORQUE`, kind, `${label} couple`, 'Couple moteur maximal.', 0, 600, 0.1),
    field(`${prefix}ENGINE.PEAK_RPM`, kind, `${label} rpm couple`, 'Regime du couple maximal.', 500, 10000, 10),
    field(`${prefix}ENGINE.MAX_RPM`, kind, `${label} rpm max`, 'Zone rouge moteur.', 1000, 12000, 10),
    field(`${prefix}ENGINE.EFFICIENCY`, kind, `${label} rendement`, 'Rendement global transmission.', 0.1, 1.2, 0.01),
    field(`${prefix}ENGINE.FINAL_DRIVE`, kind, `${label} pont final`, 'Multiplication finale de transmission.', 0.1, 10, 0.01),
    field(`${prefix}ENGINE.SHIFT_TIME`, kind, `${label} temps rapport`, 'Trou de couple pendant le passage de rapport.', 0, 1, 0.01),
    field(`${prefix}ENGINE.CVT_TARGET_RPM`, kind, `${label} CVT rpm cible`, 'Regime tenu par le variateur.', 0, 10000, 10),
    field(`${prefix}ENGINE.CVT_RATIO_MIN`, kind, `${label} CVT ratio min`, 'Rapport long du variateur.', 0, 40, 0.01),
    field(`${prefix}ENGINE.CVT_RATIO_MAX`, kind, `${label} CVT ratio max`, 'Rapport court du variateur.', 0, 50, 0.01),
  ]
}

function field(
  id: DevTuningField['id'],
  section: DevTuningField['section'],
  label: string,
  help: string,
  min: number,
  max: number,
  step: number,
): DevTuningField {
  return { id, section, label, help, kind: 'number', min, max, step }
}
