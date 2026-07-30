/**
 * 📝 Notes du téléphone — les pistes que Chibrux se griffonne pour quitter Beauvais.
 *
 * C'est du CONTENU, donc ça vit dans `src/data/` et pas dans le code de l'interface
 * (convention `AGENTS.md` §3) : on peut en ajouter sans toucher à un seul composant.
 *
 * ⚠️ Pour l'instant ces notes sont ÉCRITES EN DUR et toujours visibles. Quand un
 * système de quêtes/progression existera, c'est lui qui décidera lesquelles sont
 * découvertes — il suffira de filtrer cette liste, pas de la réécrire.
 */

export interface PhoneNote {
  id: string
  /** Titre court, façon note prise à l'arrache. */
  title: string
  /** Le corps de la note. Deux ou trois lignes maximum : c'est un téléphone. */
  body: string
  /** Étiquette de piste, affichée en petit. */
  tag: 'Train' | 'Avion' | 'Fric' | 'Chelou' | 'Rumeur'
}

export const PHONE_NOTES: PhoneNote[] = [
  {
    id: 'gare',
    title: 'La gare',
    body: "Billet pour Paris = pas donné. Et le guichet me connaît. Trouver du fric avant de retenter le coup.",
    tag: 'Train',
  },
  {
    id: 'travaux',
    title: 'Travaux partout',
    body: "Toutes les sorties de bagnole sont bloquées. C'est même plus une coïncidence à ce stade.",
    tag: 'Rumeur',
  },
  {
    id: 'aeroport',
    title: 'Aéroport Beauvais-Tillé',
    body: "Soi-disant « Paris ». Faut y monter, mais on m'a dit qu'il y a un truc à savoir pour passer.",
    tag: 'Avion',
  },
  {
    id: 'egouts',
    title: 'Les égouts',
    body: "Quelqu'un jure que ça sort de la ville. Quelqu'un qui sentait très fort. À vérifier quand même.",
    tag: 'Chelou',
  },
  {
    id: 'thune',
    title: 'Faire de la thune',
    body: "Revendre ce qui traîne, bosser, ou pire. Dans tous les cas : arrêter d'être fauché.",
    tag: 'Fric',
  },
]
