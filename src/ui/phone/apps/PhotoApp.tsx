import { useEffect, useState } from 'react'
import { usePhotoStore } from '../../../gameplay/phone/photoStore'
import { PHONE, appScroll, appSectionLabel, card } from '../phoneStyle'

/**
 * 📷 Application Photo — elle prend de VRAIES captures de la vue du jeu.
 *
 * Le bouton ne fait que poser une demande dans `photoStore` ; c'est
 * `gameplay/phone/PhoneCameraCapture.tsx`, monté dans la scène 3D, qui prend
 * l'image au bon moment de l'image suivante (voir ses commentaires).
 *
 * Le HUD et le téléphone n'apparaissent pas sur la photo : on ne capture que la
 * 3D. Le petit éclair blanc est purement cosmétique.
 */
export default function PhotoApp() {
  const photos = usePhotoStore((s) => s.photos)
  const requestShot = usePhotoStore((s) => s.requestShot)
  const removePhoto = usePhotoStore((s) => s.removePhoto)
  const [openedId, setOpenedId] = useState<number | null>(null)
  const [flash, setFlash] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(false), 160)
    return () => clearTimeout(timer)
  }, [flash])

  /**
   * La capture a lieu dans la boucle 3D. Si celle-ci ne tourne pas (onglet en
   * arrière-plan, scène pas encore montée), la demande resterait en attente et le
   * bouton n'aurait l'air de rien faire. On le dit au bout d'une seconde et demie.
   */
  const takePhoto = () => {
    const before = usePhotoStore.getState().photos.length
    setFailed(false)
    setFlash(true)
    requestShot()
    setTimeout(() => {
      const store = usePhotoStore.getState()
      if (store.photos.length === before) {
        usePhotoStore.setState({ shotQueued: false })
        setFailed(true)
      }
    }, 1500)
  }

  const opened = photos.find((photo) => photo.id === openedId)

  // Une photo ouverte en grand : elle remplit l'écran de l'app.
  if (opened) {
    return (
      <div style={{ ...appScroll, gap: 8 }}>
        <img src={opened.dataUrl} alt="" style={{ width: '100%', borderRadius: 12, display: 'block' }} />
        <div style={{ ...card, font: `11px ${PHONE.font}` }}>
          <strong>{opened.place}</strong>
          <span style={{ display: 'block', color: PHONE.textDim, font: `700 10px ${PHONE.mono}` }}>
            {opened.timeLabel}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" onClick={() => setOpenedId(null)} style={buttonStyle}>
            Retour
          </button>
          <button
            type="button"
            onClick={() => {
              removePhoto(opened.id)
              setOpenedId(null)
            }}
            style={{ ...buttonStyle, color: '#fca5a5', borderColor: 'rgba(248, 113, 113, 0.4)' }}
          >
            Supprimer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={appScroll}>
      {flash && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#fff',
            opacity: 0.85,
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />
      )}

      <button
        type="button"
        onClick={takePhoto}
        style={{
          display: 'grid',
          placeItems: 'center',
          gap: 6,
          padding: '14px 0',
          borderRadius: 14,
          border: '1px solid rgba(167, 139, 250, 0.45)',
          background: 'linear-gradient(150deg, rgba(167,139,250,0.28), rgba(109,40,217,0.28))',
          color: PHONE.text,
          cursor: 'pointer',
        }}
      >
        <span style={shutterStyle} />
        <span style={{ font: `800 11px ${PHONE.font}` }}>Prendre une photo</span>
        <span style={{ font: `10px ${PHONE.font}`, color: PHONE.textDim }}>
          Photographie ce que tu vois à l’écran
        </span>
      </button>

      {failed && (
        <div style={{ ...card, borderColor: 'rgba(248, 113, 113, 0.4)', font: `11px ${PHONE.font}`, color: '#fca5a5' }}>
          La photo n’est pas partie : la scène 3D ne tourne pas en ce moment.
        </div>
      )}

      <div style={appSectionLabel}>
        Pellicule · {photos.length} photo{photos.length > 1 ? 's' : ''}
      </div>

      {photos.length === 0 ? (
        <div style={{ ...card, font: `11px ${PHONE.font}`, color: PHONE.textDim, lineHeight: 1.5 }}>
          Rien pour l’instant. Vise un truc con et appuie sur le bouton.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setOpenedId(photo.id)}
              title={`${photo.place} — ${photo.timeLabel}`}
              style={{
                padding: 0,
                border: PHONE.cardBorder,
                borderRadius: 10,
                overflow: 'hidden',
                background: 'none',
                cursor: 'pointer',
                display: 'block',
              }}
            >
              <img src={photo.dataUrl} alt="" style={{ width: '100%', display: 'block' }} />
            </button>
          ))}
        </div>
      )}

      <div style={{ font: `10px ${PHONE.font}`, color: PHONE.muted, lineHeight: 1.45 }}>
        Les photos sont gardées en mémoire (12 maximum) et disparaissent si tu recharges le jeu :
        il n’y a pas encore de sauvegarde de partie.
      </div>
    </div>
  )
}

const shutterStyle = {
  width: 34,
  height: 34,
  borderRadius: '50%',
  background: '#fff',
  boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.3)',
}

const buttonStyle = {
  padding: '8px 0',
  borderRadius: 10,
  border: PHONE.cardBorder,
  background: PHONE.card,
  color: PHONE.text,
  font: `800 11px ${PHONE.font}`,
  cursor: 'pointer',
}
