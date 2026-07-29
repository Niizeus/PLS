import { useEffect, useMemo, useRef } from 'react'
import { useFBX, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { usePlayerStore, type AttackMove, type PlayerAction } from '../../gameplay/stats/playerStore'
import { useScooterStore } from '../vehicles/scooterStore'
import { useCarStore } from '../vehicles/carStore'
import { getPlayerTuning, useDevTuningStore } from '../../devtools/devTuningStore'

/**
 * 🧍 Le personnage Pierrot, animé.
 *
 * ⚠️ Le GLB/FBX "de base" fournis ne sont PAS riggés (mesh statiques). En revanche
 * chaque FBX d'animation (Mixamo) contient le personnage COMPLET riggé + skinné.
 * On utilise donc `idle.fbx` comme personnage, et on lui applique les CLIPS des
 * autres FBX (même squelette `mixamorig` → compatibles).
 *
 * ⚙️ Si le perso est mal dimensionné/orienté, ajuste SCALE et FACING ci-dessous.
 */

const BASE = '/models/pierrot/'

// Nom d'anim → fichier FBX (dont on ne garde que le clip).
const ANIMS: Record<string, string> = {
  idle: 'idle.fbx',
  walk: 'walk.fbx',
  sadWalk: 'Sad Walk.fbx',
  run: 'run.fbx',
  jump: 'jump.fbx',
  drive: 'drive.fbx',
  sit: 'sit.fbx',
  sneak: 'sneak.fbx',
  dance: 'dance.fbx',
  drunk1: 'drunk1.fbx',
  drunk2: 'drunk2.fbx',
  drunk3: 'drunk3.fbx',
  punch1: 'Punching.fbx',
  punch2: 'Punching(1).fbx',
  punch3: 'Punching(2).fbx',
  defense: 'DefenceGarde.fbx',
  hurt: 'Hurt.fbx',
}

// Quelle animation jouer selon l'état du jeu (les autres clips restent dispo).
// Cas particulier : `attack` n'est PAS ici, car le clip dépend du coup en cours
// (voir ATTACK_TO_ANIM juste en dessous).
const ACTION_TO_ANIM: Record<PlayerAction, string> = {
  idle: 'idle',
  walk: 'walk',
  sadWalk: 'sadWalk',
  run: 'run',
  attack: 'punch1', // valeur de secours ; le vrai clip vient de ATTACK_TO_ANIM
  defense: 'defense',
  interact: 'idle',
  jump: 'jump',
  crouch: 'sneak', // accroupi = anim "sneak" (marche accroupie)
  hurt: 'hurt',
}

/**
 * Quel clip pour quel coup.
 *
 * 🗡️ AJOUTER L'ANIMATION D'ARME (quand tu auras le FBX) — 3 étapes :
 *   1. Mets le fichier dans `public/models/pierrot/` (ex: `WeaponAttack.fbx`).
 *   2. Ajoute-le dans ANIMS ci-dessus : `weapon: 'WeaponAttack.fbx',`
 *      puis charge-le comme les autres (`const fbxWeapon = useFBX(BASE + ANIMS.weapon)`)
 *      et ajoute `clip(fbxWeapon, 'weapon')` dans la liste des clips.
 *   3. Remplace `weapon: 'punch1'` par `weapon: 'weapon'` ici.
 * En attendant, une attaque à l'arme rejoue le 1er coup de poing.
 */
const ATTACK_TO_ANIM: Record<AttackMove, string> = {
  punch1: 'punch1',
  punch2: 'punch2',
  punch3: 'punch3',
  weapon: 'punch1', // ⏳ pas encore d'animation d'arme
}

/**
 * Durée forcée (secondes) de chaque coup. On CALE l'animation sur le minuteur du
 * gameplay (playerConfig) : l'anim se termine pile quand le coup se termine,
 * quelle que soit la durée d'origine du FBX. Régle le feeling dans playerConfig.
 */
const TARGET_HEIGHT = 1.75 // taille voulue du perso en mètres (échelle auto-calculée)
const FACING = 0 // rotation Y du modèle ; mets Math.PI si le perso marche à reculons

export default function PlayerModel() {
  useDevTuningStore((s) => s.overrides)
  const playerTuning = getPlayerTuning()
  // Personnage de base (mesh skinné + squelette). Les autres FBX : juste les clips.
  const character = useFBX(BASE + ANIMS.idle)
  const fbxWalk = useFBX(BASE + ANIMS.walk)
  const fbxSadWalk = useFBX(BASE + ANIMS.sadWalk)
  const fbxRun = useFBX(BASE + ANIMS.run)
  const fbxJump = useFBX(BASE + ANIMS.jump)
  const fbxDrive = useFBX(BASE + ANIMS.drive)
  const fbxSit = useFBX(BASE + ANIMS.sit)
  const fbxSneak = useFBX(BASE + ANIMS.sneak)
  const fbxDance = useFBX(BASE + ANIMS.dance)
  const fbxDrunk1 = useFBX(BASE + ANIMS.drunk1)
  const fbxDrunk2 = useFBX(BASE + ANIMS.drunk2)
  const fbxDrunk3 = useFBX(BASE + ANIMS.drunk3)
  const fbxPunch1 = useFBX(BASE + ANIMS.punch1)
  const fbxPunch2 = useFBX(BASE + ANIMS.punch2)
  const fbxPunch3 = useFBX(BASE + ANIMS.punch3)
  const fbxDefense = useFBX(BASE + ANIMS.defense)
  const fbxHurt = useFBX(BASE + ANIMS.hurt)

  // Prépare les clips : renommés + sans "root motion" (on gère le déplacement nous-mêmes).
  const clips = useMemo(() => {
    const clip = (fbx: THREE.Group, name: string) => {
      const c = fbx.animations[0].clone()
      c.name = name
      c.tracks = c.tracks.filter(
        (t) => !(t.name.toLowerCase().includes('hips') && t.name.endsWith('.position')),
      )
      return c
    }
    return [
      clip(character, 'idle'),
      clip(fbxWalk, 'walk'),
      clip(fbxSadWalk, 'sadWalk'),
      clip(fbxRun, 'run'),
      clip(fbxJump, 'jump'),
      clip(fbxDrive, 'drive'),
      clip(fbxSit, 'sit'),
      clip(fbxSneak, 'sneak'),
      clip(fbxDance, 'dance'),
      clip(fbxDrunk1, 'drunk1'),
      clip(fbxDrunk2, 'drunk2'),
      clip(fbxDrunk3, 'drunk3'),
      clip(fbxPunch1, 'punch1'),
      clip(fbxPunch2, 'punch2'),
      clip(fbxPunch3, 'punch3'),
      clip(fbxDefense, 'defense'),
      clip(fbxHurt, 'hurt'),
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character])

  const group = useRef<THREE.Group>(null)
  const { actions } = useAnimations(clips, group)

  // Le mesh du perso projette une ombre, et on DÉSACTIVE le frustum culling :
  // les SkinnedMesh animés ont souvent une boîte englobante mal calculée → sinon
  // three les masque à tort (perso invisible).
  useEffect(() => {
    character.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.frustumCulled = false
      }
    })
  }, [character])

  // Échelle AUTO : on mesure le modèle et on le met à TARGET_HEIGHT, pieds au sol.
  // (Évite de deviner si le FBX est en cm ou en mètres.)
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(character)
    const h = Math.max(0.001, box.max.y - box.min.y)
    const scale = TARGET_HEIGHT / h
    console.info('[Pierrot] taille brute:', box.getSize(new THREE.Vector3()).toArray().map((v) => v.toFixed(2)), '→ échelle', scale.toFixed(3))
    // Pieds (box.min.y) posés à -BODY_HEIGHT (le sol, sous le centre du groupe joueur).
    const y = -playerTuning.BODY_HEIGHT - box.min.y * scale
    return { scale, y }
  }, [character, playerTuning.BODY_HEIGHT])

  // Anime selon l'etat du jeu (ou "drive" quand on conduit un vehicule).
  const action = usePlayerStore((s) => s.action)
  const attackMove = usePlayerStore((s) => s.attackMove)
  const attackToken = usePlayerStore((s) => s.attackToken)
  const hurtToken = usePlayerStore((s) => s.hurtToken)
  const ridingScooter = useScooterStore((s) => s.riding)
  const ridingCar = useCarStore((s) => s.riding)
  const riding = ridingScooter || ridingCar
  // Clé de l'anim en cours. Pour les coups on y colle le "token" du store :
  // deux coups identiques d'affilée ont des clés différentes → l'anim se relance.
  const current = useRef('')
  const currentName = useRef('')
  useEffect(() => {
    // 1. Quel clip jouer ?
    let name: string
    let oneShotDuration = 0
    if (riding) {
      name = 'drive'
    } else if (action === 'attack') {
      const move = attackMove ?? 'punch1'
      name = ATTACK_TO_ANIM[move]
      oneShotDuration = getAttackDuration(move, playerTuning)
    } else if (action === 'hurt') {
      name = 'hurt'
      oneShotDuration = playerTuning.HURT_DURATION
    } else {
      name = ACTION_TO_ANIM[action] ?? 'idle'
    }

    // 2. Clé unique : les coups/dégâts doivent pouvoir se rejouer à l'identique.
    const key =
      oneShotDuration === 0
        ? name
        : action === 'attack'
          ? `${name}#${attackToken}`
          : `${name}#${hurtToken}`
    if (key === current.current) return
    const next = actions[name]
    if (!next) return

    // 3. Transition : coupe rapide pour les coups (nerveux), douce sinon.
    const fade = oneShotDuration > 0 ? 0.08 : 0.2
    actions[currentName.current]?.fadeOut(fade)
    next.reset()
    if (oneShotDuration > 0) {
      // Joue UNE fois, se fige sur la dernière image, et dure exactement le temps
      // prévu par le gameplay (setDuration ajuste la vitesse de lecture).
      next.setLoop(THREE.LoopOnce, 1)
      next.clampWhenFinished = true
      next.setDuration(oneShotDuration)
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity)
      next.clampWhenFinished = false
      next.timeScale = 1
    }
    next.fadeIn(fade).play()
    current.current = key
    currentName.current = name
  }, [action, attackMove, attackToken, hurtToken, riding, actions, playerTuning])

  return (
    <group ref={group} visible={!ridingCar} rotation={[0, FACING, 0]} position={[0, fit.y, 0]} scale={fit.scale}>
      <primitive object={character} />
    </group>
  )
}

function getAttackDuration(move: AttackMove, playerTuning: ReturnType<typeof getPlayerTuning>): number {
  if (move === 'weapon') return playerTuning.WEAPON_ATTACK_DURATION
  const index = Number(move.slice(-1)) - 1
  return playerTuning.COMBO_DURATIONS[index] ?? playerTuning.COMBO_DURATIONS[0]
}
