import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import Terrain from './Terrain'
import TerrainLidar from './beauvais/TerrainLidar'
import CentreVilleCleanGround from './beauvais/CentreVilleCleanGround'
import CentreVilleRelief from './beauvais/CentreVilleRelief'
import CentreVillePaving from './beauvais/CentreVillePaving'
import CentreVillePedestrianAxes from './beauvais/CentreVillePedestrianAxes'
import BeauvaisKeyAnchor from './beauvais/BeauvaisKeyAnchor'
import JuneGambettaGateways from './beauvais/JuneGambettaGateways'
import JuneGambettaJunction from './beauvais/JuneGambettaJunction'
import BreslesGesvresCorner from './beauvais/BreslesGesvresCorner'
import MitterrandCourDesLettres from './beauvais/MitterrandCourDesLettres'
import PlaceMarechauxPrecinct from './beauvais/PlaceMarechauxPrecinct'
import JeanMoulinUnderpass from './beauvais/JeanMoulinUnderpass'
import CathedralPrecinct from './beauvais/CathedralPrecinct'
import CathedralClockMarker from './beauvais/CathedralClockMarker'
import JeanneHachetteMemoryTrail from './beauvais/JeanneHachetteMemoryTrail'
import MudoPrecinct from './beauvais/MudoPrecinct'
import QuadrilaterePrecinct from './beauvais/QuadrilaterePrecinct'
import RomanWallsPrecinct from './beauvais/RomanWallsPrecinct'
import SaintBarthelemyRuins from './beauvais/SaintBarthelemyRuins'
import PrefectureSaintQuentinPrecinct from './beauvais/PrefectureSaintQuentinPrecinct'
import HistoricFacades from './beauvais/HistoricFacades'
import CentreVilleStreetIdentity from './beauvais/CentreVilleStreetIdentity'
import CentreVilleServices from './beauvais/CentreVilleServices'
import PlaceJeanneHachette from './beauvais/PlaceJeanneHachette'
import CarrouselJeanneHachette from './beauvais/CarrouselJeanneHachette'
import PlaceJeannePlayArea from './beauvais/PlaceJeannePlayArea'
import MairiePrecinct from './beauvais/MairiePrecinct'
import TheatrePrecinct from './beauvais/TheatrePrecinct'
import TourBoileauPrecinct from './beauvais/TourBoileauPrecinct'
import RueCarnotCommercial from './beauvais/RueCarnotCommercial'
import HallesMarket from './beauvais/HallesMarket'
import SaintEtiennePrecinct from './beauvais/SaintEtiennePrecinct'
import CentreVilleStreetFurniture from './beauvais/CentreVilleStreetFurniture'
import GreenAreas from './beauvais/GreenAreas'
import Water from './beauvais/Water'
import Roads from './beauvais/Roads'
import BeauvaisBridges from './beauvais/BeauvaisBridges'
import DassaultIntermarcheJunction from './beauvais/DassaultIntermarcheJunction'
import CentreVilleRoadMarkings from './beauvais/CentreVilleRoadMarkings'
import CentreVilleMobilityIdentity from './beauvais/CentreVilleMobilityIdentity'
import Walls from './beauvais/Walls'
import Beauvais from './beauvais/Beauvais'
import CentreVilleBuildingBases from './beauvais/CentreVilleBuildingBases'
import MonumentAccents from './beauvais/MonumentAccents'
import CentreVilleLandmarks from './beauvais/CentreVilleLandmarks'
import CentreVilleWayfinding from './beauvais/CentreVilleWayfinding'
import Trees from './beauvais/Trees'
import Lamps from './beauvais/Lamps'
import { SPAWN } from './beauvais/cityData'
import { usePlayerStore } from '../gameplay/stats/playerStore'
import { getGlobalMap, loadLidarTerrain } from './beauvais/lidarTerrain'

function ProximityLayer({
  x,
  z,
  radius,
  children,
}: {
  x: number
  z: number
  radius: number
  children: ReactNode
}) {
  const radiusSq = radius * radius
  const [visible, setVisible] = useState(() => (SPAWN.x - x) ** 2 + (SPAWN.z - z) ** 2 <= radiusSq)
  const frame = useRef(0)

  useFrame(() => {
    frame.current = (frame.current + 1) % 18
    if (frame.current !== 0) return

    const p = usePlayerStore.getState().playerObject
    const px = p ? p.position.x : SPAWN.x
    const pz = p ? p.position.z : SPAWN.z
    const next = (px - x) ** 2 + (pz - z) ** 2 <= radiusSq
    setVisible((current) => (current === next ? current : next))
  })

  return visible ? <>{children}</> : null
}

/**
 * LE MONDE : tout le décor et la map de Beauvais.
 *
 * 👉 Domaine "Monde & rendu" (voir docs/02-ARCHITECTURE.md).
 * Pour ajouter un élément au monde, tu l'ajoutes ICI — pas besoin de toucher GameCanvas.
 *
 * ⚠️ Le sol vient du LiDAR HD (chargement ASYNCHRONE, cf. docs/06). On attend qu'il
 * soit chargé AVANT d'afficher le décor : routes/bâtiments/verdure se posent sur
 * `terrainHeight`, qui doit déjà renvoyer le relief LiDAR — sinon ils seraient calés
 * sur l'ancienne grille et « flotteraient ». Si le LiDAR échoue, on retombe sur
 * l'ancien Terrain (jamais d'écran sans sol).
 *
 * Ordre = superposition au sol : sol → verdure → eau → routes, puis le relief
 * (murs, bâtiments) et enfin le mobilier (arbres, lampadaires).
 */
export default function World() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    loadLidarTerrain().then(() => setLoaded(true))
  }, [])

  if (!loaded) return null // court instant de chargement du relief global (un fichier ~4 Mo)

  const hasLidar = getGlobalMap() !== null

  return (
    <>
      {hasLidar ? <TerrainLidar /> : <Terrain />}
      <CentreVilleCleanGround />
      <CentreVilleRelief />
      <CentreVillePaving />
      <ProximityLayer x={220} z={-70} radius={520}>
        <CentreVillePedestrianAxes />
        <JuneGambettaGateways />
      </ProximityLayer>
      <ProximityLayer x={338} z={-194} radius={170}>
        <JuneGambettaJunction />
      </ProximityLayer>
      <ProximityLayer x={205} z={-304} radius={170}>
        <BreslesGesvresCorner />
      </ProximityLayer>
      <ProximityLayer x={454} z={-129} radius={175}>
        <MitterrandCourDesLettres />
      </ProximityLayer>
      <ProximityLayer x={634} z={-192} radius={230}>
        <PlaceMarechauxPrecinct />
      </ProximityLayer>
      <ProximityLayer x={765} z={-472} radius={430}>
        <JeanMoulinUnderpass />
      </ProximityLayer>
      <ProximityLayer x={587} z={-39} radius={180}>
        <BeauvaisKeyAnchor id="jeu-paume" />
      </ProximityLayer>
      <ProximityLayer x={647} z={-313} radius={190}>
        <BeauvaisKeyAnchor id="felix-faure" />
      </ProximityLayer>
      <ProximityLayer x={71} z={-371} radius={180}>
        <BeauvaisKeyAnchor id="jeanne-hachette-lycee" />
      </ProximityLayer>
      <ProximityLayer x={195} z={1026} radius={190}>
        <BeauvaisKeyAnchor id="truffaut" />
      </ProximityLayer>
      <ProximityLayer x={170} z={-115} radius={330}>
        <JeanneHachetteMemoryTrail />
      </ProximityLayer>
      <CathedralPrecinct />
      <CathedralClockMarker />
      <ProximityLayer x={-118} z={-35} radius={210}>
        <MudoPrecinct />
        <QuadrilaterePrecinct />
        <RomanWallsPrecinct />
        <SaintBarthelemyRuins />
      </ProximityLayer>
      <ProximityLayer x={-516} z={-205} radius={190}>
        <PrefectureSaintQuentinPrecinct />
      </ProximityLayer>
      <HistoricFacades />
      <CentreVilleStreetIdentity />
      <CentreVilleServices />
      <ProximityLayer x={86} z={235} radius={185}>
        <PlaceJeanneHachette />
        <CarrouselJeanneHachette />
        <PlaceJeannePlayArea />
        <MairiePrecinct />
      </ProximityLayer>
      <ProximityLayer x={-25} z={378} radius={160}>
        <TheatrePrecinct />
      </ProximityLayer>
      <ProximityLayer x={-459} z={684} radius={170}>
        <TourBoileauPrecinct />
      </ProximityLayer>
      <ProximityLayer x={165} z={135} radius={185}>
        <RueCarnotCommercial />
      </ProximityLayer>
      <ProximityLayer x={190} z={255} radius={175}>
        <HallesMarket />
      </ProximityLayer>
      <ProximityLayer x={-45} z={386} radius={175}>
        <SaintEtiennePrecinct />
      </ProximityLayer>
      <CentreVilleStreetFurniture />
      <GreenAreas />
      <Water />
      <Roads />
      <BeauvaisBridges />
      <ProximityLayer x={850} z={-1140} radius={360}>
        <DassaultIntermarcheJunction />
      </ProximityLayer>
      <CentreVilleRoadMarkings />
      <CentreVilleMobilityIdentity />
      <Walls />
      <Beauvais />
      <CentreVilleBuildingBases />
      <MonumentAccents />
      <CentreVilleLandmarks />
      <CentreVilleWayfinding />
      <Trees />
      <Lamps />
    </>
  )
}
