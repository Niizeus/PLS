import * as THREE from 'three'

/**
 * 🛞 ÉTAT DE CONTACT DES QUATRE ROUES, écrit par la physique, lu par les effets.
 *
 * ## Pourquoi ce n'est PAS un store Zustand
 *
 * Ces données changent à chaque pas de physique (60 fois par seconde) et sont
 * lues par un `useFrame`. Les faire passer par un store réactif déclencherait
 * 60 rendus React par seconde pour rien. On expose donc un simple objet mutable
 * partagé : la physique écrit dedans, `TireEffects` le lit. Aucun rendu React,
 * aucune allocation par image.
 *
 * ⚠️ Corollaire : ne JAMAIS garder une référence sur un `TireContact` au-delà de
 * l'image courante — l'objet est réutilisé, son contenu sera écrasé.
 */

/** Nature du sol sous une roue : ça change les effets ET l'adhérence. */
export type TireSurface = 'road' | 'offroad'

export interface TireContact {
  /** Vrai si la roue touche quelque chose cette image. */
  grounded: boolean
  /** Roue avant (true) ou arrière (false). */
  front: boolean
  /** Point de contact dans le repère MONDE. */
  point: THREE.Vector3
  /** Normale du sol au contact (sert à poser les traces bien à plat). */
  normal: THREE.Vector3
  /**
   * Vitesse LATÉRALE du point de contact (m/s), mesurée sur le corps Rapier.
   * C'est le vrai glissement de la gomme en travers : c'est lui qui fait le drift.
   */
  slipSide: number
  /**
   * Vitesse LONGITUDINALE du point de contact (m/s).
   *
   * ⚠️ Ce n'est PAS un taux de glissement au sens strict : on ne simule pas la
   * vitesse de rotation de chaque roue, donc on ne peut pas comparer gomme et
   * sol. Le patinage longitudinal est déduit autrement (roues arrière bloquées
   * par le frein à main) — voir `slipAmount`.
   */
  slipForward: number
  /** Glissement total normalisé 0-1, prêt à piloter l'intensité d'un effet. */
  slipAmount: number
  surface: TireSurface
}

const createContact = (front: boolean): TireContact => ({
  grounded: false,
  front,
  point: new THREE.Vector3(),
  normal: new THREE.Vector3(0, 1, 0),
  slipSide: 0,
  slipForward: 0,
  slipAmount: 0,
  surface: 'road',
})

/** Ordre fixe : 0 = AVG, 1 = AVD, 2 = ARG, 3 = ARD. */
export const CAR_TIRE_CONTACTS: TireContact[] = [
  createContact(true),
  createContact(true),
  createContact(false),
  createContact(false),
]

/** Vrai quand la voiture est pilotée : les effets ne tournent que dans ce cas. */
export const tireEffectsState = {
  active: false,
  /** Vitesse longitudinale du véhicule (m/s), pour doser fumée et traces. */
  speed: 0,
  /** Frein à main tiré : la fumée part plus vite, même à glissement égal. */
  handbrake: false,
}

/** Remet tout à zéro (descente du véhicule, respawn). */
export function resetTireContacts() {
  tireEffectsState.active = false
  tireEffectsState.speed = 0
  tireEffectsState.handbrake = false
  for (const contact of CAR_TIRE_CONTACTS) {
    contact.grounded = false
    contact.slipSide = 0
    contact.slipForward = 0
    contact.slipAmount = 0
  }
}
