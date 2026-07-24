/**
 * Carte des touches du jeu.
 *
 * ⚠️ Astuce clavier importante : on utilise `event.code` (la POSITION physique
 * de la touche) et PAS `event.key` (la lettre imprimée). Résultat : sur un
 * clavier AZERTY, les touches Z Q S D sont physiquement aux positions
 * W A S D d'un clavier QWERTY. Donc `KeyW` = la touche "Z" en AZERTY, etc.
 * → Nos joueurs français ont bien du ZQSD sans qu'on ait à détecter la langue.
 */

export const KEY = {
  FORWARD: 'KeyW', // Z sur AZERTY
  BACKWARD: 'KeyS', // S
  LEFT: 'KeyA', // Q sur AZERTY
  RIGHT: 'KeyD', // D
  RUN: 'ShiftLeft', // Maj = courir
  INTERACT: 'KeyE', // E = action / interagir
  JUMP: 'Space', // Espace = sauter
  CROUCH: 'ControlLeft', // Ctrl = s'accroupir
} as const

// Boutons de la souris (event.button) : 0 = gauche, 2 = droit.
export const MOUSE = {
  ATTACK: 0, // clic gauche = attaque
  DEFENSE: 2, // clic droit = défense
} as const
