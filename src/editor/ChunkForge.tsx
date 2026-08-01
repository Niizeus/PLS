import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PanelToggle, type EditorPanelsApi } from './EditorPanels'
import { saveData } from './editorSave'
import {
  couleurConfiance,
  loadChunk,
  SEUIL_VALIDER,
  type ChunkFile,
  type Famille,
  type Passport,
} from './chunkForgeData'
import {
  batimentA,
  dessiner,
  normaliseRect,
  versMonde,
  type Rect,
  type Vue,
} from './chunkForgeDraw'
import './ChunkForge.css'

/**
 * 🏗️ ChunkForge — le module « générer un quartier » de l'éditeur.
 *
 * Il ne calcule rien : le classement se fait hors-jeu (`npm run chunk:classify`,
 * voir `docs/08-CHUNKFORGE.md`). Le rôle de ce module est ce que seul un humain
 * peut faire : REGARDER, puis TRANCHER là où la machine hésite.
 *
 * Trois gestes, dans cet ordre :
 *   1. choisir une zone sur le plan (ou travailler sur tout le chunk) ;
 *   2. parcourir la file, triée par IMPACT VISUEL et non par confiance — on relit
 *      ce qui se verra dans le jeu, pas ce dont la machine doute le plus ;
 *   3. corriger au clavier, puis enregistrer.
 *
 * Les corrections partent dans `data/chunk-overrides.json`, que les scripts ne
 * réécrivent jamais : on peut relancer collecte et classement sans rien perdre.
 */

const ZOOM_MIN = 0.08
const ZOOM_MAX = 4
const TOUCHES = '123456789abcdefg'.split('')

/**
 * Endpoint du plugin Vite `vite/chunkOverridesPlugin.ts`.
 *
 * ⚠️ Écrit en dur, comme les autres endpoints de l'éditeur : importer la constante
 * depuis le plugin embarquerait `node:path` et `vite` dans le bundle du navigateur.
 * Si l'URL change là-bas, elle change ici.
 */
const CHUNK_OVERRIDES_ENDPOINT = '/__pls/chunk-overrides'

interface ChunkForgeProps {
  moduleTabs?: ReactNode
  panels: EditorPanelsApi
  active: boolean
}

type Etat =
  | { phase: 'chargement' }
  | { phase: 'erreur'; message: string }
  | { phase: 'pret'; chunk: ChunkFile; familles: Famille[] }

export default function ChunkForge({ moduleTabs, panels, active }: ChunkForgeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })

  const [vue, setVue] = useState<Vue>({ cx: 0, cz: 0, echelle: 0.9 })
  const [selection, setSelection] = useState<Rect | null>(null)
  const [enCours, setEnCours] = useState<Rect | null>(null)
  const [surligne, setSurligne] = useState<string | null>(null)
  const [filtreAValider, setFiltreAValider] = useState(false)
  const [actifId, setActifId] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, { archetype: string; at?: string }>>({})
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Le module reste monté quand on change d'onglet (voir EditorHub) : on ne charge
  // donc qu'une fois, à la première activation, et jamais au démarrage de l'éditeur.
  useEffect(() => {
    if (!active || etat.phase !== 'chargement') return
    let annule = false
    loadChunk()
      .then(({ chunk, familles }) => {
        if (annule) return
        setEtat({ phase: 'pret', chunk, familles })
        const b = chunk.box
        setVue({ cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2, echelle: 0.9 })
        const deja: Record<string, { archetype: string }> = {}
        for (const p of chunk.passports) {
          if (p.reviewed) deja[p.id] = { archetype: p.archetype }
        }
        setOverrides(deja)
      })
      .catch((e: Error) =>
        setEtat({
          phase: 'erreur',
          message:
            `${e.message}\n\nLe chunk classe est absent. Lance d'abord, dans un terminal :\n` +
            `  npm run chunk:collect\n  npm run chunk:classify`,
        }),
      )
    return () => {
      annule = true
    }
  }, [active, etat.phase])

  const passports = etat.phase === 'pret' ? etat.chunk.passports : []
  const familles = etat.phase === 'pret' ? etat.familles : []

  /** La file de travail : ce qui reste à trancher, du plus visible au moins visible. */
  const file = useMemo(() => {
    return passports
      .filter((p) => {
        if (p.suspect) return false // géométrie à réparer, rien à décider
        if (overrides[p.id]) return false // déjà tranché
        if (p.confidence >= SEUIL_VALIDER) return false
        if (selection && !dansRect(selection, p)) return false
        return true
      })
      .sort((a, b) => b.impact - a.impact)
  }, [passports, overrides, selection])

  const actif = useMemo(
    () => passports.find((p) => p.id === actifId) ?? file[0] ?? null,
    [passports, actifId, file],
  )

  /** Comptes par famille, dans la zone choisie. Overrides pris en compte. */
  const stats = useMemo(() => {
    const map = new Map<string, number>()
    let dansZone = 0
    for (const p of passports) {
      if (selection && !dansRect(selection, p)) continue
      dansZone++
      const k = overrides[p.id]?.archetype ?? p.archetype
      map.set(k, (map.get(k) ?? 0) + 1)
    }
    return { map, dansZone }
  }, [passports, selection, overrides])

  // ── Dessin ────────────────────────────────────────────────────────────────
  const redessiner = useCallback(() => {
    const canvas = canvasRef.current
    const main = mainRef.current
    if (!canvas || !main || etat.phase !== 'pret') return
    const w = main.clientWidth
    const h = main.clientHeight
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    dessiner(ctx, {
      passports,
      familles,
      vue,
      selection,
      enCours,
      surligne,
      actifId: actif?.id ?? null,
      filtreAValider,
      overrides,
    })
  }, [etat.phase, passports, familles, vue, selection, enCours, surligne, actif, filtreAValider, overrides])

  useEffect(() => {
    if (!active) return // module en veille : inutile de peindre
    redessiner()
  }, [active, redessiner])

  useEffect(() => {
    if (!active) return
    const onResize = () => redessiner()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [active, redessiner])

  // ── Souris : déplacer, zoomer, sélectionner, inspecter ────────────────────
  const drag = useRef<
    | { mode: 'pan'; x: number; y: number; cx: number; cz: number }
    | { mode: 'zone'; depart: { x: number; z: number } }
    | null
  >(null)

  /**
   * ⚠️ Le rectangle en cours est aussi gardé en ref, pas seulement en état.
   * `onPointerUp` lit une closure figée au dernier rendu : si le relâchement suit
   * le déplacement de trop près, l'état n'a pas encore été recalculé et la zone
   * serait perdue. La ref, elle, est toujours à jour. (Même piège que la file de
   * revue : un geste ne doit jamais dépendre du rythme de rendu de React.)
   */
  const enCoursRef = useRef<Rect | null>(null)

  const pointToMonde = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return [0, 0] as [number, number]
      const r = canvas.getBoundingClientRect()
      return versMonde(vue, canvas.width, canvas.height, e.clientX - r.left, e.clientY - r.top)
    },
    [vue],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    if (etat.phase !== 'pret') return
    const [x, z] = pointToMonde(e)
    // Maj = tracer une zone de travail. Sinon, clic = inspecter, glisser = déplacer.
    if (e.shiftKey) {
      drag.current = { mode: 'zone', depart: { x, z } }
    } else {
      drag.current = { mode: 'pan', x: e.clientX, y: e.clientY, cx: vue.cx, cz: vue.cz }
      const cible = batimentA(passports, x, z, 25 / vue.echelle)
      if (cible) setActifId(cible.id)
    }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (d.mode === 'pan') {
      setVue((v) => ({
        ...v,
        cx: d.cx - (e.clientX - d.x) / v.echelle,
        cz: d.cz - (e.clientY - d.y) / v.echelle,
      }))
    } else {
      const [x, z] = pointToMonde(e)
      const rect = normaliseRect(d.depart, { x, z })
      enCoursRef.current = rect
      setEnCours(rect)
    }
  }

  const onPointerUp = () => {
    const d = drag.current
    const rect = enCoursRef.current
    if (d?.mode === 'zone' && rect) {
      // Un rectangle minuscule est un clic raté, pas une zone : on l'ignore plutôt
      // que de vider la file de travail sans que l'utilisateur comprenne pourquoi.
      const assezGrand = rect.maxX - rect.minX > 15 && rect.maxZ - rect.minZ > 15
      setSelection(assezGrand ? rect : null)
    }
    drag.current = null
    enCoursRef.current = null
    setEnCours(null)
  }

  const onWheel = (e: React.WheelEvent) => {
    if (etat.phase !== 'pret') return
    const canvas = canvasRef.current
    if (!canvas) return
    const r = canvas.getBoundingClientRect()
    const px = e.clientX - r.left
    const pz = e.clientY - r.top
    const [ax, az] = versMonde(vue, canvas.width, canvas.height, px, pz)
    const facteur = e.deltaY < 0 ? 1.15 : 1 / 1.15
    const echelle = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, vue.echelle * facteur))
    // On zoome VERS le curseur : le point sous la souris ne doit pas bouger.
    setVue({
      echelle,
      cx: ax - (px - canvas.width / 2) / echelle,
      cz: az - (pz - canvas.height / 2) / echelle,
    })
  }

  // ── Trancher ──────────────────────────────────────────────────────────────
  /**
   * ⚠️ La file et le bâtiment courant sont doublés par des refs, tenues à jour à
   * chaque rendu. Sans elles, deux touches frappées dans la même image de rendu
   * agiraient toutes les deux sur le MÊME bâtiment : la seconde écraserait la
   * première au lieu de passer au suivant, et une frappe serait perdue en silence.
   * React n'a pas encore recalculé `file` ni `actif` à ce moment-là. Ça arrive dès
   * qu'on garde une touche enfoncée (répétition clavier).
   */
  const fileRef = useRef<Passport[]>([])
  const actifIdRef = useRef<string | null>(null)
  const traites = useRef<Set<string>>(new Set())
  fileRef.current = file
  actifIdRef.current = actif?.id ?? null

  const trancher = useCallback((key: string) => {
    const id = actifIdRef.current
    if (!id) return
    setOverrides((o) => ({ ...o, [id]: { archetype: key, at: new Date().toISOString() } }))
    setDirty(true)
    traites.current.add(id)

    // On enchaîne sur le suivant : la file est un flux, pas une liste à cliquer.
    // On saute ceux déjà tranchés dans cette rafale, que `file` contient encore.
    const suivant = fileRef.current.find((p) => p.id !== id && !traites.current.has(p.id))
    actifIdRef.current = suivant?.id ?? null
    setActifId(actifIdRef.current)
  }, [])

  useEffect(() => {
    if (!active || etat.phase !== 'pret') return
    const onKey = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement
      if (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') {
        setSelection(null)
        return
      }
      if (e.key === 'Enter') {
        // Entrée = « la proposition est bonne » : on la fige telle quelle.
        const courant = passports.find((p) => p.id === actifIdRef.current)
        if (courant) trancher(overrides[courant.id]?.archetype ?? courant.archetype)
        return
      }
      const k = TOUCHES.indexOf(e.key.toLowerCase())
      if (k >= 0 && familles[k]) trancher(familles[k].key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, etat.phase, familles, trancher, passports, overrides])

  // ── Enregistrer ───────────────────────────────────────────────────────────
  const enregistrer = async () => {
    const outcome = await saveData({
      endpoint: CHUNK_OVERRIDES_ENDPOINT,
      payload: overrides,
      successMessage: `${Object.keys(overrides).length} corrections enregistrees`,
    })
    setMessage(outcome.message)
    if (outcome.status === 'ok') setDirty(false)
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  const aValider = passports.filter((p) => p.confidence < SEUIL_VALIDER && !p.suspect && !overrides[p.id]).length
  const suspects = passports.filter((p) => p.suspect).length

  return (
    <div className={`editor-shell ${active ? '' : 'editor-hidden'}`} style={panels.shellStyle}>
      <header className="editor-topbar">
        <div>
          <div className="editor-title">ChunkForge</div>
          <div className="editor-subtitle">
            {etat.phase === 'pret'
              ? `${etat.chunk.chunk} — ${etat.chunk.passports.length} batiments`
              : 'Generation de quartiers'}
          </div>
        </div>
        {moduleTabs}
        <div className="editor-actions">
          <button type="button" onClick={() => setSelection(null)} disabled={!selection} title="Revenir au chunk entier (Echap)">
            Toute la zone
          </button>
          <button
            type="button"
            className={filtreAValider ? 'active' : ''}
            onClick={() => setFiltreAValider((v) => !v)}
            title="N'afficher que ce qui reste a trancher"
          >
            A valider seulement
          </button>
          <button
            type="button"
            className={`primary ${dirty ? 'dirty' : ''}`}
            onClick={enregistrer}
            disabled={!dirty}
            title={dirty ? 'Corrections non enregistrees' : 'Tout est sur le disque'}
          >
            Enregistrer
          </button>
        </div>
      </header>

      <aside className={`editor-left ${panels.layout.leftCollapsed ? 'collapsed' : ''}`}>
        <section>
          <h2>Zone de travail</h2>
          <p className="editor-note">
            <b>Maj + glisser</b> pour delimiter une zone. <b>Molette</b> pour zoomer,
            <b> glisser</b> pour deplacer, <b>clic</b> sur un batiment pour l&apos;inspecter.
          </p>
          <dl className="cf-stats">
            <dt>Batiments</dt>
            <dd>{stats.dansZone.toLocaleString('fr-FR')}</dd>
            <dt>A trancher</dt>
            <dd style={{ color: file.length ? '#e07b7b' : '#6bbf6b' }}>{file.length}</dd>
            <dt>Corriges</dt>
            <dd>{Object.keys(overrides).length}</dd>
          </dl>
          {suspects > 0 && (
            <p className="editor-note">
              ⚠️ {suspects} emprises aberrantes (hachurees) : ce sont des decoupes OSM a reparer,
              pas des batiments a classer. Elles sont hors de la file.
            </p>
          )}
        </section>

        <section>
          <h2>Familles</h2>
          <p className="editor-note">Clic pour isoler une famille sur le plan.</p>
          <ul className="cf-legende">
            {familles
              .map((f) => ({ f, n: stats.map.get(f.key) ?? 0 }))
              .sort((a, b) => b.n - a.n)
              .map(({ f, n }) => (
                <li key={f.key}>
                  <button
                    type="button"
                    className={surligne === f.key ? 'active' : ''}
                    onClick={() => setSurligne((s) => (s === f.key ? null : f.key))}
                  >
                    <span className="cf-puce" style={{ background: f.color }} />
                    <span className="cf-nom">{f.label}</span>
                    <span className="cf-n">{n}</span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      </aside>

      <main ref={mainRef} className="editor-map-panel">
        {panels.renderHandle('left')}
        {panels.renderHandle('right')}
        <PanelToggle side="left" collapsed={panels.layout.leftCollapsed} onToggle={() => panels.toggle('left')} />
        <PanelToggle side="right" collapsed={panels.layout.rightCollapsed} onToggle={() => panels.toggle('right')} />

        {etat.phase === 'chargement' && <p className="cf-plein">Chargement du chunk…</p>}
        {etat.phase === 'erreur' && <pre className="cf-plein cf-erreur">{etat.message}</pre>}
        <canvas
          ref={canvasRef}
          className="cf-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        />
        {message && (
          <div className="editor-map-status" onClick={() => setMessage(null)}>
            {message}
          </div>
        )}
      </main>

      <aside className={`editor-right ${panels.layout.rightCollapsed ? 'collapsed' : ''}`}>
        {actif ? (
          <Inspecteur
            p={actif}
            familles={familles}
            override={overrides[actif.id]?.archetype ?? null}
            restant={file.length}
            onTrancher={trancher}
          />
        ) : (
          <section>
            <h2>Revue</h2>
            <p className="editor-note">
              {aValider === 0
                ? '🎉 Plus rien a trancher dans cette zone.'
                : 'Clique un batiment sur le plan, ou delimite une zone.'}
            </p>
          </section>
        )}
      </aside>
    </div>
  )
}

function dansRect(r: Rect, p: Passport) {
  return p.cx >= r.minX && p.cx <= r.maxX && p.cz >= r.minZ && p.cz <= r.maxZ
}

/**
 * Le volet de droite : tout ce qu'il faut pour trancher UN bâtiment.
 *
 * L'ordre compte : d'abord ce qu'on voit (adresse, rue), puis la proposition et
 * POURQUOI elle a été faite, puis seulement les chiffres. Un relecteur juge sur les
 * indices, pas sur un tableau de mesures.
 */
function Inspecteur({
  p,
  familles,
  override,
  restant,
  onTrancher,
}: {
  p: Passport
  familles: Famille[]
  override: string | null
  restant: number
  onTrancher: (key: string) => void
}) {
  const courant = override ?? p.archetype
  const drapeaux = [
    p.exclusive ? 'regle exclusive' : null,
    p.capped ? 'plafonne (ni usage ni date)' : null,
    p.devine ? 'suggere sans preuve' : null,
    p.consensus === 'adopte' ? `aligne sur ${p.consensusVoisins} voisins` : null,
    p.consensus === 'confirme' ? 'confirme par le voisinage' : null,
  ].filter(Boolean)

  return (
    <>
      <section>
        <h2>Revue {restant > 0 && <span className="cf-restant">{restant} restants</span>}</h2>
        {p.osm.addr && <p className="cf-addr">{p.osm.addr}</p>}
        {p.ctx.roadName && <p className="editor-note">sur {p.ctx.roadName}</p>}
        <p className="cf-pred">
          {override ? '✋ corrige : ' : 'Propose : '}
          <b>{familles.find((f) => f.key === courant)?.label ?? courant}</b>{' '}
          {!override && (
            <span style={{ color: couleurConfiance(p.confidence) }}>
              {Math.round(p.confidence * 100)} %
            </span>
          )}
        </p>
        {p.runnerUp && !override && (
          <p className="editor-note">
            2<sup>e</sup> candidat : {familles.find((f) => f.key === p.runnerUp?.[0])?.label ?? p.runnerUp[0]}
          </p>
        )}
        {drapeaux.length > 0 && <p className="cf-flags">{drapeaux.join(' · ')}</p>}
        <p className="cf-ev">{p.evidence?.map((e) => e.text).join('  ·  ') || '(aucun indice fort)'}</p>
      </section>

      <section>
        <h2>Mesures</h2>
        <dl className="cf-stats">
          <dt>Aire</dt>
          <dd>{p.geom.area} m²</dd>
          <dt>Hauteur</dt>
          <dd>{p.h ?? '?'} m</dd>
          <dt>Etages</dt>
          <dd>{p.ign.etages ?? '?'}</dd>
          <dt>Logements</dt>
          <dd>{p.ign.logements ?? '?'}</dd>
          <dt>Annee</dt>
          <dd>{p.ign.annee ?? '?'}</dd>
          <dt>Usage IGN</dt>
          <dd>{p.ign.usage1 ?? '?'}</dd>
          <dt>Mitoyennete</dt>
          <dd>{Math.round(p.ctx.sharedRatio * 100)} %</dd>
          {p.osm.pois && p.osm.pois.length > 0 && (
            <>
              <dt>Commerces</dt>
              <dd>{p.osm.pois.map((x) => x.v).join(', ')}</dd>
            </>
          )}
        </dl>
      </section>

      <section>
        <h2>Qu&apos;est-ce que c&apos;est ?</h2>
        <div className="cf-familles">
          {familles.map((f, k) => (
            <button
              key={f.key}
              type="button"
              className={courant === f.key ? 'sel' : ''}
              onClick={() => onTrancher(f.key)}
            >
              <kbd>{(TOUCHES[k] ?? '').toUpperCase()}</kbd>
              <span>
                <b>{f.label}</b>
                <i>{f.critere}</i>
              </span>
            </button>
          ))}
        </div>
      </section>
    </>
  )
}
