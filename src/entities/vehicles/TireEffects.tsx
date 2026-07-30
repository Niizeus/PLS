import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FRAME } from '../../core/framePriority'
import { CAR_TIRE_CONTACTS, tireEffectsState, type TireContact } from './tireContactStore'

/**
 * 💨 FUMÉE, POUSSIÈRE ET TRACES DE PNEUS.
 *
 * ## Principe
 *
 * Tout part des VRAIES informations de contact publiées par les suspensions
 * Rapier (`tireContactStore`) : point de contact, normale du sol, glissement
 * latéral de la gomme, nature du sol. Rien n'est deviné depuis la vitesse ou
 * l'angle du volant.
 *
 * ## Deux tampons circulaires, zéro allocation
 *
 * Les particules et les traces vivent dans des **anneaux de taille fixe** : on
 * écrase la plus ancienne au lieu d'en créer une nouvelle. Conséquence : aucune
 * allocation dans la boucle de rendu, aucun travail pour le ramasse-miettes, et
 * un coût GPU constant (deux objets dessinés, quoi qu'il arrive). C'est la même
 * discipline que le reste du jeu — voir `docs/04-MONDE-BEAUVAIS.md`.
 *
 * Sur bitume la gomme fume (gris clair), hors bitume elle soulève de la
 * poussière (beige) : la couleur vient de `contact.surface`.
 */

/** Nombre de bouffées de fumée vivantes en même temps. */
const PUFF_COUNT = 96
/** Nombre de segments de trace conservés au sol. */
const MARK_COUNT = 220
/** En dessous de ce glissement (0-1), un pneu ne produit rien du tout. */
const SLIP_THRESHOLD = 0.16
/** Durée de vie d'une bouffée (s). */
const PUFF_LIFE = 1.05
/** Durée de vie d'une trace (s). */
const MARK_LIFE = 7
/** Cadence maxi d'émission par roue (bouffées/s) à glissement maximal. */
const PUFF_RATE = 34
/** Largeur d'une trace de pneu (m). */
const MARK_WIDTH = 0.24
/** On soulève légèrement les traces pour ne pas qu'elles clignotent dans le sol. */
const MARK_LIFT = 0.02

const SMOKE_COLOR = new THREE.Color('#d8dae0')
const DUST_COLOR = new THREE.Color('#c8ab7d')

interface Puff {
  life: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  size: number
  color: THREE.Color
}

interface Mark {
  life: number
}

export default function TireEffects() {
  const puffPoints = useRef<THREE.Points>(null)
  const markMesh = useRef<THREE.InstancedMesh>(null)

  const puffs = useMemo<Puff[]>(
    () =>
      Array.from({ length: PUFF_COUNT }, () => ({
        life: 0,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 1,
        color: new THREE.Color(),
      })),
    [],
  )
  const marks = useMemo<Mark[]>(() => Array.from({ length: MARK_COUNT }, () => ({ life: 0 })), [])

  const puffGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PUFF_COUNT * 3), 3))
    // Attribut nommé à nous plutôt que le `color` de three : on ne dépend pas
    // de `vertexColors` et de la façon dont three injecte ses attributs.
    geometry.setAttribute('puffColor', new THREE.BufferAttribute(new Float32Array(PUFF_COUNT * 3), 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(new Float32Array(PUFF_COUNT), 1))
    geometry.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(PUFF_COUNT), 1))
    return geometry
  }, [])

  const puffMaterial = useMemo(() => createPuffMaterial(), [])
  const markGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const markMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#1b1b20',
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [],
  )

  // ⚠️ Un InstancedMesh démarre avec des matrices IDENTITÉ : sans ce nettoyage,
  // les 220 traces s'afficheraient toutes empilées à l'origine du monde dès le
  // premier rendu. On les range hors de vue tant qu'aucune n'a servi.
  useEffect(() => {
    const instanced = markMesh.current
    if (!instanced) return
    for (let i = 0; i < MARK_COUNT; i++) instanced.setMatrixAt(i, hiddenMatrix)
    instanced.instanceMatrix.needsUpdate = true
  }, [])

  useEffect(() => {
    return () => {
      puffGeometry.dispose()
      puffMaterial.dispose()
      markGeometry.dispose()
      markMaterial.dispose()
    }
  }, [puffGeometry, puffMaterial, markGeometry, markMaterial])

  // Curseurs des anneaux et compteurs d'émission, hors état React.
  const cursors = useRef<EmitCursors>({
    puff: 0,
    mark: 0,
    emit: [0, 0, 0, 0],
    hasPrevious: [false, false, false, false],
  })
  const lastMarkPoints = useMemo(() => CAR_TIRE_CONTACTS.map(() => new THREE.Vector3()), [])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const points = puffPoints.current
    const instanced = markMesh.current
    if (!points || !instanced) return

    if (tireEffectsState.active) {
      for (let i = 0; i < CAR_TIRE_CONTACTS.length; i++) {
        emitForWheel(CAR_TIRE_CONTACTS[i], i, delta, puffs, marks, cursors.current, lastMarkPoints[i], instanced)
      }
    }

    updatePuffs(puffs, delta, points.geometry)
    updateMarks(marks, delta, instanced)
  }, FRAME.ATTACHED)

  return (
    <>
      <points ref={puffPoints} geometry={puffGeometry} material={puffMaterial} frustumCulled={false} renderOrder={12} />
      <instancedMesh
        ref={markMesh}
        args={[markGeometry, markMaterial, MARK_COUNT]}
        frustumCulled={false}
        renderOrder={2}
      />
    </>
  )
}

const emitPos = new THREE.Vector3()
const markMatrix = new THREE.Matrix4()
const markDir = new THREE.Vector3()
const markUp = new THREE.Vector3()
const markSide = new THREE.Vector3()
const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0)

interface EmitCursors {
  puff: number
  mark: number
  emit: number[]
  hasPrevious: boolean[]
}

function emitForWheel(
  contact: TireContact,
  index: number,
  delta: number,
  puffs: Puff[],
  marks: Mark[],
  cursors: EmitCursors,
  lastPoint: THREE.Vector3,
  instanced: THREE.InstancedMesh,
) {
  if (!contact.grounded || contact.slipAmount < SLIP_THRESHOLD) {
    cursors.emit[index] = 0
    cursors.hasPrevious[index] = false
    return
  }

  // Intensité 0-1 au-dessus du seuil : une gomme qui glisse à peine ne doit pas
  // produire autant qu'un frein à main à 90 km/h.
  const intensity = (contact.slipAmount - SLIP_THRESHOLD) / (1 - SLIP_THRESHOLD)

  // --- Fumée / poussière ---
  cursors.emit[index] += delta * PUFF_RATE * intensity
  while (cursors.emit[index] >= 1) {
    cursors.emit[index] -= 1
    const puff = puffs[cursors.puff]
    cursors.puff = (cursors.puff + 1) % PUFF_COUNT
    puff.life = PUFF_LIFE
    puff.x = contact.point.x + (Math.random() - 0.5) * 0.18
    puff.y = contact.point.y + 0.08
    puff.z = contact.point.z + (Math.random() - 0.5) * 0.18
    // La fumée part vers l'arrière du glissement, puis monte en s'étalant.
    puff.vx = -contact.slipSide * 0.12 + (Math.random() - 0.5) * 0.7
    puff.vy = 0.5 + Math.random() * 0.8 * intensity
    puff.vz = (Math.random() - 0.5) * 0.7
    puff.size = 0.35 + Math.random() * 0.5 + intensity * 0.5
    puff.color.copy(contact.surface === 'road' ? SMOKE_COLOR : DUST_COLOR)
  }

  // --- Traces au sol ---
  // Une trace n'est posée que sur bitume (sur la terre, il n'y a rien à marquer)
  // et seulement tous les ~15 cm : sinon on saturerait l'anneau en une seconde.
  if (contact.surface !== 'road') {
    cursors.hasPrevious[index] = false
    return
  }

  // Premier contact de la série : on note juste d'où on part, il n'y a pas
  // encore de segment à tendre.
  if (!cursors.hasPrevious[index]) {
    lastPoint.copy(contact.point)
    cursors.hasPrevious[index] = true
    return
  }

  const step = contact.point.distanceTo(lastPoint)
  if (step < 0.15) return
  // Saut de position (téléport, remise sur les roues) : on repart de zéro
  // plutôt que de tendre une trace de vingt mètres à travers la carte.
  if (step > 4) {
    lastPoint.copy(contact.point)
    return
  }

  const slot = cursors.mark
  cursors.mark = (cursors.mark + 1) % MARK_COUNT
  marks[slot].life = MARK_LIFE

  // Quad tendu entre la position précédente et l'actuelle : la trace reste
  // continue même à haute vitesse. On construit la base directement (largeur,
  // longueur, normale) — pas de quaternion intermédiaire à deviner.
  markUp.copy(contact.normal).normalize()
  markDir.copy(contact.point).sub(lastPoint).normalize()
  markSide.copy(markDir).cross(markUp).normalize()
  markMatrix.makeBasis(
    markSide.multiplyScalar(MARK_WIDTH),
    markDir.multiplyScalar(step),
    markUp,
  )
  emitPos.copy(contact.point).add(lastPoint).multiplyScalar(0.5).addScaledVector(contact.normal, MARK_LIFT)
  markMatrix.setPosition(emitPos)

  instanced.setMatrixAt(slot, markMatrix)
  instanced.instanceMatrix.needsUpdate = true
  lastPoint.copy(contact.point)
}

function updatePuffs(puffs: Puff[], delta: number, geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute
  const color = geometry.getAttribute('puffColor') as THREE.BufferAttribute
  const size = geometry.getAttribute('size') as THREE.BufferAttribute
  const alpha = geometry.getAttribute('alpha') as THREE.BufferAttribute

  for (let i = 0; i < puffs.length; i++) {
    const puff = puffs[i]
    if (puff.life <= 0) {
      alpha.setX(i, 0)
      continue
    }
    puff.life -= delta
    const age = 1 - Math.max(0, puff.life) / PUFF_LIFE
    // La bouffée ralentit et s'étale : c'est ce qui la fait lire comme de la fumée.
    puff.x += puff.vx * delta
    puff.y += puff.vy * delta
    puff.z += puff.vz * delta
    puff.vx *= 1 - delta * 2.2
    puff.vz *= 1 - delta * 2.2
    puff.vy *= 1 - delta * 1.1

    position.setXYZ(i, puff.x, puff.y, puff.z)
    color.setXYZ(i, puff.color.r, puff.color.g, puff.color.b)
    size.setX(i, puff.size * (1 + age * 2.4))
    alpha.setX(i, Math.max(0, 1 - age) * 0.5)
  }

  position.needsUpdate = true
  color.needsUpdate = true
  size.needsUpdate = true
  alpha.needsUpdate = true
}

function updateMarks(marks: Mark[], delta: number, instanced: THREE.InstancedMesh) {
  let dirty = false
  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i]
    if (mark.life <= 0) continue
    mark.life -= delta
    if (mark.life > 0) continue
    // Fin de vie : on la range hors de vue plutôt que de la supprimer.
    instanced.setMatrixAt(i, hiddenMatrix)
    dirty = true
  }
  if (dirty) instanced.instanceMatrix.needsUpdate = true
}

/**
 * Nuage rond et doux, dessiné dans le shader.
 *
 * Un `PointsMaterial` classique aurait demandé une texture (donc un fichier, un
 * chargement, un état d'attente). Un disque à bord estompé tient en trois lignes
 * de GLSL et coûte moins cher.
 */
function createPuffMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute float size;
      attribute float alpha;
      attribute vec3 puffColor;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = puffColor;
        vAlpha = alpha;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = size * 320.0 / max(1.0, -viewPosition.z);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        if (vAlpha <= 0.001) discard;
        float d = length(gl_PointCoord - vec2(0.5));
        float mask = smoothstep(0.5, 0.12, d);
        gl_FragColor = vec4(vColor, vAlpha * mask);
      }
    `,
  })
}
