import type { DevSectionId, DevTuningGroup, VehicleKind } from './devTuningTypes'

/**
 * Categories affichees dans le panneau `F2`.
 *
 * Regle : une categorie = une question que se pose un humain (« ca freine
 * comment ? »), pas un paquet de variables qui se ressemblent.
 */
export const DEV_TUNING_GROUPS: DevTuningGroup[] = [
  // --- Joueur -------------------------------------------------------------
  group('player', 'movement', '🚶', 'Deplacement', 'Vitesses de marche, course, accroupi.'),
  group('player', 'jump', '🦘', 'Saut et gravite', 'Hauteur de saut et poids ressenti du perso.'),
  group('player', 'combat', '👊', 'Combat', 'Rythme des coups et temps d etourdissement.'),
  group('player', 'body', '🧍', 'Corps et collision', 'Taille du cylindre qui frotte les murs.'),

  // --- Camera / inventaire / ciel -----------------------------------------
  group('camera', 'aim', '🎥', 'Visee et sensibilite', 'Reponse de la souris et limites verticales.'),
  group('inventory', 'carry', '🎒', 'Portage', 'Charge maximale avant penalite.'),
  group('sky', 'paint', '🎨', 'Ciel peint', 'Formes et matiere du ciel procedural.'),
  group('sky', 'light', '💡', 'Lumiere et ambiance', 'Comment le ciel teinte lumieres, fog et nuages.'),

  // --- Vehicules ----------------------------------------------------------
  ...vehicleGroups('car'),
  ...vehicleGroups('scooter'),
]

/**
 * Les deux vehicules partagent les memes categories : on regle une voiture et un
 * scooter avec la meme grille de lecture.
 */
function vehicleGroups(kind: VehicleKind): DevTuningGroup[] {
  const isScooter = kind === 'scooter'
  const notWiredYet = isScooter
    ? 'Le scooter roule encore sur l ancien modele de conduite : ces valeurs sont pretes mais pas encore lues par le jeu.'
    : undefined

  return [
    group(kind, 'general', '⚖️', 'Comportement general', 'Masse, gabarit, distance pour monter.', 'mass'),
    group(kind, 'engine', '🔧', 'Moteur et acceleration', 'Ce qui pousse le vehicule.', 'engine'),
    group(kind, 'topspeed', '💨', 'Vitesse maximale', 'Ce qui empeche d aller plus vite.', 'aero'),
    group(kind, 'brakes', '🛑', 'Freinage', 'Freins, marche arriere, limiteur.', 'brakes'),
    group(kind, 'steering', '🎯', 'Direction', 'Braquage et reponse du volant.', 'steering'),
    group(kind, 'grip', '🛞', 'Adherence', 'Ce qui colle les pneus a la route.', 'wheels'),
    group(kind, 'drift', '🌀', 'Drift et frein a main', 'Ce qui fait decrocher l arriere.', 'drift', notWiredYet),
    group(kind, 'suspension', '🪜', 'Suspension et roues', 'Absorption des bosses et geometrie des essieux.', 'suspension'),
    group(kind, 'air', '🪂', 'Controle aerien', 'Sauts, rotations en l air, atterrissage.', 'air', notWiredYet),
    group(kind, 'impact', '💥', 'Chocs et carrosserie', 'Ce qui se passe quand ca tape.', 'body'),
  ]
}

/** Categories de l'onglet vehicule pas encore reglables : le schema les affiche en grise. */
export const VEHICLE_ZONES_COMING_SOON: { zone: 'lights' | 'audio'; label: string; note: string }[] = [
  { zone: 'lights', label: 'Eclairage', note: 'Phares et feux : aucun reglage expose pour l instant.' },
  { zone: 'audio', label: 'Sons', note: 'Moteur et klaxon : aucun reglage expose pour l instant.' },
]

export function getGroups(section: DevSectionId): DevTuningGroup[] {
  return DEV_TUNING_GROUPS.filter((entry) => entry.section === section)
}

function group(
  section: DevSectionId,
  id: string,
  icon: string,
  label: string,
  summary: string,
  zone?: DevTuningGroup['zone'],
  warning?: string,
): DevTuningGroup {
  return { id, section, icon, label, summary, zone, warning }
}
