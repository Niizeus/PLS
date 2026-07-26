/**
 * ⚙️ MOTEUR, BOÎTE DE VITESSES ET VARIATEUR.
 *
 * ## Pourquoi ce n'est pas juste « une accélération »
 *
 * Avant, la voiture avait une accélération CONSTANTE (15 m/s²) puis un plafond
 * de vitesse : elle passait donc de 0 à sa vitesse maxi en 2 secondes, comme un
 * jouet. Adoucir la rampe n'aurait rien réglé — ça aurait juste donné une
 * voiture molle qui arrive quand même au bout d'un coup.
 *
 * Une vraie voiture est progressive parce que :
 *  - son moteur ne donne pas le même couple à tous les régimes (creux en bas,
 *    pic au milieu, chute à la zone rouge) ;
 *  - chaque rapport multiplie ce couple : la 1re arrache, la 6e pousse à peine ;
 *  - il y a un TROU à chaque passage de rapport — c'est ce trou qu'on SENT ;
 *  - et la résistance de l'air augmente avec le carré de la vitesse.
 *
 * 👉 Conséquence importante : **la vitesse maxi n'est pas un réglage, elle SORT
 * du calcul**. Elle est atteinte quand la poussée du moteur en dernier rapport
 * égale la résistance de l'air + le roulement. On calibre donc la traînée pour
 * que ça plafonne où on veut, et on obtient gratuitement le bon ressenti :
 * une 1re nerveuse, et une 6e qui met une éternité à passer de 180 à 210.
 *
 * ## Deux transmissions
 *
 *  - **Boîte à rapports** (voiture) : le régime découle de la vitesse et du
 *    rapport engagé, et on change de rapport à des régimes fixes.
 *  - **Variateur / CVT** (scooter) : il n'y a pas de rapport. Le variateur tient
 *    le moteur à un régime cible et adapte le rapport en continu. C'est pour ça
 *    qu'un scooter hurle à régime constant en accélérant.
 */

export interface EngineConfig {
  /** Couple maxi du moteur (N·m). */
  PEAK_TORQUE: number
  /** Régime où le couple est maxi (tr/min). */
  PEAK_RPM: number
  /** Régime de ralenti (tr/min). */
  IDLE_RPM: number
  /** Zone rouge (tr/min). */
  MAX_RPM: number
  /** Rendement de la transmission (0 → 1). */
  EFFICIENCY: number
  /**
   * Rapports de boîte, du plus court au plus long. `null` = variateur (scooter).
   */
  GEARS: readonly number[] | null
  /** Rapport de pont, commun à tous les rapports. */
  FINAL_DRIVE: number
  /** On monte un rapport au-dessus de ce régime. */
  SHIFT_UP_RPM: number
  /** On redescend un rapport en dessous de ce régime. */
  SHIFT_DOWN_RPM: number
  /** Coupure de couple pendant un passage de rapport (s). C'est le « à-coup ». */
  SHIFT_TIME: number
  /** Variateur : régime que le moteur tient sous les gaz (tr/min). */
  CVT_TARGET_RPM: number
  /** Variateur : rapport le plus long (haute vitesse). */
  CVT_RATIO_MIN: number
  /** Variateur : rapport le plus court (démarrage). */
  CVT_RATIO_MAX: number
}

/** Ce que la transmission produit à chaque image. */
export interface EngineOutput {
  /** Force de poussée aux roues (N). */
  force: number
  /** Régime moteur à afficher (tr/min). */
  rpm: number
  /** Rapport engagé, 1 = première. 0 = variateur (pas de rapport à afficher). */
  gear: number
}

const RPM_PER_RAD_S = 60 / (2 * Math.PI)

/**
 * Couple disponible à un régime donné (N·m).
 *
 * Courbe volontairement simple : une parabole centrée sur le pic de couple, qui
 * retombe à ~55 % au ralenti et à ~55 % à la zone rouge. C'est la forme réelle
 * d'un moteur atmosphérique, et ça suffit largement à faire sentir les rapports.
 */
export function engineTorque(engine: EngineConfig, rpm: number): number {
  const r = Math.min(Math.max(rpm, engine.IDLE_RPM), engine.MAX_RPM)
  const span = r < engine.PEAK_RPM ? engine.PEAK_RPM - engine.IDLE_RPM : engine.MAX_RPM - engine.PEAK_RPM
  const t = span > 0 ? (r - engine.PEAK_RPM) / span : 0
  return engine.PEAK_TORQUE * (1 - 0.45 * t * t)
}

/** État de la transmission, conservé d'une image à l'autre. */
export interface GearboxState {
  /** Rapport engagé, indexé à partir de 0. */
  gear: number
  /** Temps restant de coupure pendant un passage (s). */
  shiftTimer: number
}

export const createGearboxState = (): GearboxState => ({ gear: 0, shiftTimer: 0 })

/**
 * Calcule la poussée disponible aux roues pour la vitesse courante.
 *
 * @param speed        vitesse longitudinale (m/s), positive vers l'avant
 * @param wheelRadius  rayon de roue (m)
 * @param throttle     vrai si le joueur accélère
 */
export function driveTrain(
  engine: EngineConfig,
  box: GearboxState,
  speed: number,
  wheelRadius: number,
  throttle: boolean,
  delta: number,
): EngineOutput {
  // Vitesse de rotation des roues (rad/s). On garde un minimum : à l'arrêt,
  // l'embrayage (ou le variateur) patine, le moteur ne cale pas.
  const wheelAngular = Math.max(Math.abs(speed), 0.6) / wheelRadius

  if (!engine.GEARS) return variator(engine, wheelAngular, wheelRadius, throttle)

  // --- Boîte à rapports ---
  if (box.shiftTimer > 0) box.shiftTimer -= delta

  const ratioOf = (gear: number) => engine.GEARS![gear] * engine.FINAL_DRIVE
  let rpm = wheelAngular * ratioOf(box.gear) * RPM_PER_RAD_S

  // Passage de rapport. On ne monte que sous les gaz : sinon la boîte
  // s'emballerait toute seule en roue libre.
  if (box.shiftTimer <= 0) {
    if (throttle && rpm > engine.SHIFT_UP_RPM && box.gear < engine.GEARS.length - 1) {
      box.gear++
      box.shiftTimer = engine.SHIFT_TIME
    } else if (rpm < engine.SHIFT_DOWN_RPM && box.gear > 0) {
      box.gear--
      box.shiftTimer = engine.SHIFT_TIME
    }
    rpm = wheelAngular * ratioOf(box.gear) * RPM_PER_RAD_S
  }

  // Pendant la coupure, l'embrayage est ouvert : plus aucune poussée. C'est CE
  // trou de 0,2 s qui rend les rapports perceptibles.
  const ratio = ratioOf(box.gear)
  const force =
    throttle && box.shiftTimer <= 0 && rpm < engine.MAX_RPM
      ? (engineTorque(engine, rpm) * ratio * engine.EFFICIENCY) / wheelRadius
      : 0

  return { force, rpm: Math.min(rpm, engine.MAX_RPM), gear: box.gear + 1 }
}

/**
 * Variateur (scooter) : pas de rapport, le moteur reste au régime cible et
 * c'est le rapport qui glisse en continu entre ses deux butées.
 */
function variator(
  engine: EngineConfig,
  wheelAngular: number,
  wheelRadius: number,
  throttle: boolean,
): EngineOutput {
  const targetAngular = engine.CVT_TARGET_RPM / RPM_PER_RAD_S
  const ratio = Math.min(Math.max(targetAngular / wheelAngular, engine.CVT_RATIO_MIN), engine.CVT_RATIO_MAX)
  const rpm = wheelAngular * ratio * RPM_PER_RAD_S
  const force = throttle ? (engineTorque(engine, rpm) * ratio * engine.EFFICIENCY) / wheelRadius : 0
  return { force, rpm: Math.min(rpm, engine.MAX_RPM), gear: 0 }
}
