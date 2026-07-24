import { useEffect, useMemo, useRef } from 'react'
import { useFBX, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { usePlayerStore, type PlayerAction } from '../../gameplay/stats/playerStore'
import { useScooterStore } from '../vehicles/scooterStore'
import { PLAYER } from './playerConfig'

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
  run: 'run.fbx',
  jump: 'jump.fbx',
  drive: 'drive.fbx',
  sit: 'sit.fbx',
  sneak: 'sneak.fbx',
  dance: 'dance.fbx',
  drunk1: 'drunk1.fbx',
  drunk2: 'drunk2.fbx',
  drunk3: 'drunk3.fbx',
}

// Quelle animation jouer selon l'état du jeu (les autres clips restent dispo).
const ACTION_TO_ANIM: Record<PlayerAction, string> = {
  idle: 'idle',
  walk: 'walk',
  run: 'run',
  attack: 'jump', // pas d'anim d'attaque fournie → jump en attendant
  defense: 'sneak',
  interact: 'idle',
}

const TARGET_HEIGHT = 1.75 // taille voulue du perso en mètres (échelle auto-calculée)
const FACING = 0 // rotation Y du modèle ; mets Math.PI si le perso marche à reculons

export default function PlayerModel() {
  // Personnage de base (mesh skinné + squelette). Les autres FBX : juste les clips.
  const character = useFBX(BASE + ANIMS.idle)
  const fbxWalk = useFBX(BASE + ANIMS.walk)
  const fbxRun = useFBX(BASE + ANIMS.run)
  const fbxJump = useFBX(BASE + ANIMS.jump)
  const fbxDrive = useFBX(BASE + ANIMS.drive)
  const fbxSit = useFBX(BASE + ANIMS.sit)
  const fbxSneak = useFBX(BASE + ANIMS.sneak)
  const fbxDance = useFBX(BASE + ANIMS.dance)
  const fbxDrunk1 = useFBX(BASE + ANIMS.drunk1)
  const fbxDrunk2 = useFBX(BASE + ANIMS.drunk2)
  const fbxDrunk3 = useFBX(BASE + ANIMS.drunk3)

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
      clip(fbxRun, 'run'),
      clip(fbxJump, 'jump'),
      clip(fbxDrive, 'drive'),
      clip(fbxSit, 'sit'),
      clip(fbxSneak, 'sneak'),
      clip(fbxDance, 'dance'),
      clip(fbxDrunk1, 'drunk1'),
      clip(fbxDrunk2, 'drunk2'),
      clip(fbxDrunk3, 'drunk3'),
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
    const y = -PLAYER.BODY_HEIGHT - box.min.y * scale
    return { scale, y }
  }, [character])

  // Anime selon l'état du jeu (ou "drive" quand on conduit le scooter).
  const action = usePlayerStore((s) => s.action)
  const riding = useScooterStore((s) => s.riding)
  const current = useRef('')
  useEffect(() => {
    const name = riding ? 'drive' : ACTION_TO_ANIM[action] ?? 'idle'
    if (name === current.current) return
    const next = actions[name]
    if (!next) return
    actions[current.current]?.fadeOut(0.2)
    next.reset().fadeIn(0.2).play()
    current.current = name
  }, [action, riding, actions])

  return (
    <group ref={group} rotation={[0, FACING, 0]} position={[0, fit.y, 0]} scale={fit.scale}>
      <primitive object={character} />
    </group>
  )
}
