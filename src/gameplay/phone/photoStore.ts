import { create } from 'zustand'
import { useNotificationStore } from './notificationStore'

/**
 * 📷 La pellicule du téléphone.
 *
 * ⚠️ **Les photos vivent en MÉMOIRE, pas dans `localStorage`.** Une image même
 * réduite pèse ~30 à 80 ko en base64 ; une douzaine suffirait à saturer le quota
 * (~5 Mo) partagé avec l'inventaire, les stats et les points de passage. Elles
 * sont donc perdues au rechargement de la page — c'est assumé tant qu'il n'y a
 * pas de vraie sauvegarde de partie.
 */

export interface Photo {
  id: number
  /** L'image, en `data:image/jpeg;base64,...`. */
  dataUrl: string
  /** Quand la photo a été prise, en temps du jeu (ex : « Lundi 14:37 »). */
  timeLabel: string
  /** Où elle a été prise (zone du joueur), si on la connaît. */
  place: string
}

/** Au-delà, on jette les plus vieilles : c'est une pellicule, pas un disque dur. */
const MAX_PHOTOS = 12

interface PhotoState {
  photos: Photo[]
  /**
   * Déclencheur : passé à `true` quand le joueur appuie sur le bouton, remis à
   * `false` par `PhoneCameraCapture` qui prend l'image dans la foulée du rendu.
   * Même principe que `interactQueued` côté clavier.
   */
  shotQueued: boolean
  requestShot: () => void
  addPhoto: (photo: Omit<Photo, 'id'>) => void
  removePhoto: (id: number) => void
}

export const usePhotoStore = create<PhotoState>((set) => ({
  photos: [],
  shotQueued: false,
  requestShot: () => set({ shotQueued: true }),
  addPhoto: (photo) => {
    set((state) => ({
      shotQueued: false,
      photos: [{ ...photo, id: Date.now() }, ...state.photos].slice(0, MAX_PHOTOS),
    }))
    // La photo est prise pendant le rendu 3D, donc loin de l'interface : la
    // notification est le seul retour visible si le tel n'est pas sur l'app Photo.
    useNotificationStore.getState().notify({
      appId: 'camera',
      title: 'Photo enregistrée',
      body: `${photo.place} — ${photo.timeLabel}`,
      at: photo.timeLabel.split(' ').pop() ?? '',
    })
  },
  removePhoto: (id) => set((state) => ({ photos: state.photos.filter((photo) => photo.id !== id) })),
}))
