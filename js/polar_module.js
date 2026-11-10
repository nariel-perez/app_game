/**
 * polar_module.js — LAB_RPG Suite Unificada
 * Módulo autocontenido para la MISIÓN 2:
 * "La Inversión de la Sacarosa" (Cinética Química por Polarimetría — Arreglo de Laurent).
 */

window.PolarModule = (function () {
  const PARAMS = {
    polarimeterName: 'Polarímetro de Media Sombra de Laurent (LED Na 589.3 nm)',
    temperatureC: 20.0,
    cellLengthDm: 1.0,
    sucroseStockPercent: 40.0,
    sucroseMixPercent: 20.0,
    sucroseMixMolar: 0.584,
    alpha0Theoretical: +13.28,
    alphaInfTheoretical: -3.85
  };

  const ACID_CONFIGS = {
    '3M': {
      id: '3M',
      label: 'HCl 3.0 M',
      stockMolar: 3.0,
      mixMolar: 1.5,
      kReal: 5.15e-4,
      timePointsSec: [
        120, 240, 360, 480, 600,
        780, 960, 1140, 1380, 1620,
        1920, 2220, 2520, 2880, 3300,
        3720, 4200, 4740, 5340, 6000
      ]
    },
    '6M': {
      id: '6M',
      label: 'HCl 6.0 M',
      stockMolar: 6.0,
      mixMolar: 3.0,
      kReal: 1.06e-3,
      timePointsSec: [
        60, 120, 180, 240, 330,
        420, 510, 600, 720, 840,
        960, 1140, 1320, 1500, 1680,
        1920, 2160, 2400, 2700, 3000
      ]
    }
  };

  const st = {
    phase: 'intro', // 'intro' | 'prep' | 'calibration' | 'mixing' | 'bubble' | 'kinetics' | 'final'
    acidId: '3M',
    dialAngle: 5.20,
    alpha0Target: 13.28,
    alpha0Measured: 13.28,
    alphaInfMeasured: -3.85,
    calibDone: false,
    isPouring: false,
    mixDone: false,
    mixProgress: 0,
    deltaTmSec: 0.0,
    mixTimerId: null,
    bubbleState: 'hidden', // 'hidden' | 'trapped' | 'foamy' | 'cleared'
    dataRows: [],
    currentAlpha: 13.28,
    zeroCrossAnnounced: false,
    infinityReached: false,
    autoSweepId: null,
    graphMode: 'x_curves' // 'x_curves' | 'ln_linear'
  };

  let app = null;

  function gaussianNoise(sigma = 0.025, maxAbs = 0.05) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    const val = z * sigma;
    return Math.max(-maxAbs, Math.min(maxAbs, val));
  }

  function getAcidConfig(acidId) {
    return ACID_CONFIGS[acidId] || ACID_CONFIGS['3M'];
  }

  function computeAlphaAtTime(acidId, tCorrSec, alpha0Used, alphaInfUsed) {
    const cfg = getAcidConfig(acidId);
    const a0 = alpha0Used !== undefined ? alpha0Used : PARAMS.alpha0Theoretical;
    const aInf = alphaInfUsed !== undefined ? alphaInfUsed : PARAMS.alphaInfTheoretical;
    const expTerm = Math.exp(-cfg.kReal * Math.max(0, tCorrSec));
    const exactAlpha = aInf + (a0 - aInf) * expTerm;

    const scale = Math.max(0.30, expTerm);
    const noise = gaussianNoise(0.09 * scale, 0.16 * scale);
    let noisyAlpha = exactAlpha + noise;
    if (noisyAlpha <= aInf + 0.12) {
      noisyAlpha = aInf + 0.12 + Math.abs(gaussianNoise(0.01, 0.02));
    }
    return Number(noisyAlpha.toFixed(2));
  }

  function computeRowMetrics(tCronSec, deltaTmSec, alphaT, alpha0, alphaInf) {
    const t0Correction = deltaTmSec / 2.0;
    const tCorrSec = Math.max(1, tCronSec - t0Correction);
    const ratio = (alphaInf - alphaT) / (alphaInf - alpha0);
    const safeRatio = Math.max(1e-4, Math.min(0.9999, ratio));
    const oneMinusX = safeRatio;
    const x = 1.0 - oneMinusX;
    const lnTerm = Math.log(safeRatio);

    return {
      tCronSec: Number(tCronSec.toFixed(1)),
      tCorrSec: Number(tCorrSec.toFixed(2)),
      alphaT: Number(alphaT.toFixed(2)),
      lnTerm: Number(lnTerm.toFixed(4)),
      x: Number(x.toFixed(4)),
      oneMinusX: Number(oneMinusX.toFixed(4))
    };
  }

  function computeLinearRegression(dataRows) {
    const n = dataRows.length;
    if (n < 2) {
      return { k: 0, slope: 0, intercept: 0, r2: 1, tHalfSec: 0, tHalfMin: 0 };
    }
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
    for (let i = 0; i < n; i++) {
      const x = dataRows[i].tCorrSec;
      const y = dataRows[i].lnTerm;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
      sumYY += y * y;
    }
    const denom = n * sumXX - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = (sumY - slope * sumX) / n;
    const ssTot = sumYY - (sumY * sumY) / n;
    let ssRes = 0;
    for (let i = 0; i < n; i++) {
      const yPred = slope * dataRows[i].tCorrSec + intercept;
      const diff = dataRows[i].lnTerm - yPred;
      ssRes += diff * diff;
    }
    const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 1;
    const k = Math.abs(slope);
    const tHalfSec = k > 0 ? Math.LN2 / k : 0;
    return {
      k: k,
      slope: slope,
      intercept: intercept,
      r2: r2,
      tHalfSec: tHalfSec,
      tHalfMin: tHalfSec / 60.0
    };
  }

  function computeLaurentFields(dialAngle, targetAngle) {
    const deltaHalfDeg = 7.0;
    const diff = dialAngle - targetAngle;
    const radL = ((diff - deltaHalfDeg) * Math.PI) / 180.0;
    const radR = ((diff + deltaHalfDeg) * Math.PI) / 180.0;
    const iMin = 0.14;
    const iLeft = iMin + (1 - iMin) * Math.pow(Math.sin(radL), 2);
    const iRight = iMin + (1 - iMin) * Math.pow(Math.sin(radR), 2);
    const absDiff = Math.abs(diff);
    const isPenumbraMatch = absDiff <= 0.12;
    const isClose = absDiff > 0.12 && absDiff <= 1.0;
    const isBrightField = Math.abs(Math.abs(diff) - 90) < 20 || Math.abs(Math.abs(diff) - 180) < 12;

    return {
      iLeft: Math.min(1, Math.max(0.08, iLeft)),
      iRight: Math.min(1, Math.max(0.08, iRight)),
      diff: diff,
      absDiff: absDiff,
      isPenumbraMatch: isPenumbraMatch,
      isClose: isClose,
      isBrightField: isBrightField
    };
  }

  function intensityToSodiumColor(intensity) {
    const r = Math.round(28 + 227 * Math.pow(intensity, 0.88));
    const g = Math.round(18 + 168 * Math.pow(intensity, 0.94));
    const b = Math.round(4 + 28 * intensity);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function stopTimers() {
    if (st.mixTimerId) {
      clearInterval(st.mixTimerId);
      st.mixTimerId = null;
    }
    if (st.autoSweepId) {
      clearInterval(st.autoSweepId);
      st.autoSweepId = null;
    }
  }

  // =========================================================================
  // FLUJO DE ESCENAS DE LA MISIÓN 2
  // =========================================================================
  function startIntro() {
    stopTimers();
    st.phase = 'intro';
    st.acidId = '3M';
    st.dialAngle = 5.20;
    st.alpha0Target = PARAMS.alpha0Theoretical;
    st.alpha0Measured = PARAMS.alpha0Theoretical;
    st.alphaInfMeasured = PARAMS.alphaInfTheoretical;
    st.calibDone = false;
    st.isPouring = false;
    st.mixDone = false;
    st.mixProgress = 0;
    st.deltaTmSec = 0.0;
    st.bubbleState = 'hidden';
    st.dataRows = [];
    st.currentAlpha = 13.28;
    st.zeroCrossAnnounced = false;
    st.infinityReached = false;
    st.graphMode = 'x_curves';
    app.updateHud();

    app.setDialog(
      'jtp',
      'mate',
      '«¡Te damos la bienvenida a la Mesada 2: Cinética de Inversión de la Sacarosa por Polarimetría! ¡Por las barbas de Faraday, qué alegría tenerte por acá! Vamos a seguir la catálisis ácida paso a paso. Antes de tomar las pipetas, decime: ¿con qué concentración de ácido querés realizar la experiencia hoy?»',
      [
        {
          label: '🧪 Elijo HCl 3 M (Tranqui, cinética a ritmo humano)',
          onClick: () => selectAcid('3M')
        },
        {
          label: '⚡ Elijo HCl 6 M (Modo activo, cinética el doble de rápida)',
          onClick: () => selectAcid('6M')
        },
        {
          label: '🤔 ¿Por qué se denomina "inversión" a esta reacción?',
          onClick: () => {
            app.setDialog(
              'jtp',
              'explicando',
              '«¡Una pregunta clásica y fundamental! La sacarosa inicial es marcadamente dextrógira (+66.4°). A medida que el ácido cataliza la hidrólisis, se generan cantidades equimolares de glucosa (+52.7°) y fructosa (con un poder rotatorio fuertemente levógiro de -92.0°). Como la fructosa tiene mayor magnitud rotatoria negativa que el aporte positivo de la glucosa, el ángulo óptico neto cambia de signo y pasa a ser negativo. ¡Por la ley de Biot, el sentido de rotación se invirtió! Ahora sí, elijamos la concentración de ácido.»',
              [
                {
                  label: '🧪 Elijo HCl 3 M (Tranqui, cinética a ritmo humano)',
                  onClick: () => selectAcid('3M')
                },
                {
                  label: '⚡ Elijo HCl 6 M (Modo activo, cinética el doble de rápida)',
                  onClick: () => selectAcid('6M')
                }
              ]
            );
          }
        }
      ]
    );
  }

  function selectAcid(acidId) {
    st.acidId = acidId;
    app.updateHud();
    if (acidId === '3M') {
      app.setDialog(
        'jtp',
        'feliz',
        '«Una elección muy prudente. Con HCl 3 M (1.5 M efectivo en la mezcla), la cinética transcurre a un ritmo pausado y permite registrar las lecturas con tranquilidad. ¡Comencemos con la preparación de las soluciones!»',
        [{ label: '⚗️ Ir a la Mesada a Preparar las Soluciones', className: 'rpg-btn-accent', onClick: startPrepPhase }]
      );
    } else {
      app.setDialog(
        'jtp',
        'sorpresa',
        '«¡Una opción con mucha energía! Al duplicar los protones, la velocidad se duplica y el tiempo de vida media desciende a unos 10 minutos. Habrá que tomar las lecturas con agilidad. ¡Vamos a preparar las soluciones!»',
        [{ label: '⚗️ Ir a la Mesada a Preparar las Soluciones', className: 'rpg-btn-accent', onClick: startPrepPhase }]
      );
    }
  }

  function startPrepPhase() {
    st.phase = 'prep';
    app.setDialog(
      'ayudante',
      'normal',
      '«Disolviste 20.0 g de sacarosa pura en la balanza analítica hasta completar 50 mL de solución madre al 40% p/v. Ahora tomás 25 mL de esa solución y la mezclás en un Erlenmeyer con 25 mL de agua destilada: tenés tu blanco listo con sacarosa al 20% p/v para medir α₀.»',
      [
        {
          label: '👌 Solución Blanco Lista · Escuchar al JTP',
          className: 'rpg-btn-accent',
          onClick: () => {
            app.setDialog(
              'jtp',
              'serio',
              '«Un momento antes de avanzar. Antes de incorporar el ácido, debemos medir α₀ (el ángulo a tiempo cero con el blanco acuoso). Si este valor inicial tiene error, afectará el cálculo de toda la serie cinética posterior. Acerquémonos al polarímetro.»',
              [
                {
                  label: '🔭 Acercarse al Polarímetro de Laurent',
                  className: 'rpg-btn-accent',
                  onClick: startCalibrationPhase
                }
              ]
            );
          }
        }
      ]
    );
  }

  function startCalibrationPhase() {
    st.phase = 'calibration';
    st.dialAngle = 5.20;
    st.alpha0Target = PARAMS.alpha0Theoretical;
    st.calibDone = false;

    app.setDialog(
      'jtp',
      'explicando',
      '«Asomate al ocular. Ese círculo dividido es el campo bipartito de Laurent. Usá los botones, las flechas del teclado (←/→) o la ruedita del mouse para rotar el analizador. El objetivo es igualar ambas mitades en la misma penumbra oscura, donde el ojo humano es mucho más sensible al contraste.»',
      getCalibrationButtons()
    );
  }

  function rotateDial(deltaDeg) {
    if (st.phase !== 'calibration' || st.calibDone) return;
    st.dialAngle = Number((st.dialAngle + deltaDeg).toFixed(2));
    if (st.dialAngle > 180) st.dialAngle -= 360;
    if (st.dialAngle < -180) st.dialAngle += 360;
    window.AudioEngine.playDialTick(Math.abs(deltaDeg) < 0.5);
  }

  function getCalibrationButtons() {
    return [
      { label: '◀◀ -1.0°', onClick: () => rotateDial(-1.0) },
      { label: '◀ -0.1°', onClick: () => rotateDial(-0.1) },
      { label: '▶ +0.1°', onClick: () => rotateDial(0.1) },
      { label: '▶▶ +1.0°', onClick: () => rotateDial(1.0) },
      {
        label: '🎯 Clavar Lectura de α₀',
        className: 'rpg-btn-accent',
        onClick: checkCalibrationMatch
      }
    ];
  }

  function checkCalibrationMatch() {
    const fields = computeLaurentFields(st.dialAngle, st.alpha0Target);
    if (fields.isPenumbraMatch) {
      st.calibDone = true;
      st.alpha0Measured = Number(st.dialAngle.toFixed(2));
      st.currentAlpha = st.alpha0Measured;
      app.updateHud();
      window.AudioEngine.playFanfare();

      app.setDialog(
        'ayudante',
        'feliz',
        `«¡CLAC! Ambos campos quedaron fundidos en una penumbra perfecta. Lectura registrada en la libreta: α₀ = +${st.alpha0Measured.toFixed(2)}°. ¡Subiste de nivel! Tu agudeza óptica sumó +10 de respeto en la cátedra.»`,
        [
          {
            label: '💬 Escuchar al JTP',
            className: 'rpg-btn-accent',
            onClick: () => {
              app.setDialog(
                'jtp',
                'feliz',
                '«¡Excelente calibración! Muy buen ajuste óptico. Registremos ese valor con precisión porque ahora llega el momento clave: el contacto con el ácido catalizador.»',
                [
                  {
                    label: '🧪 Pasar a la Mesa de Reacción (Mezclar HCl)',
                    className: 'rpg-btn-accent',
                    onClick: startMixingPhase
                  }
                ]
              );
            }
          }
        ]
      );
    } else if (fields.isBrightField) {
      window.AudioEngine.playError();
      app.setDialog(
        'jtp',
        'alerta',
        '«¡Cuidado con la vista! Ambos campos están en brillo total. La guía indica claramente que el ojo humano es mucho más sensible a las diferencias de intensidad en la penumbra oscura, cuando la iluminación es tenue. Busquemos el ajuste fino cerca de +13.3°.»',
        getCalibrationButtons()
      );
    } else if (fields.isClose) {
      window.AudioEngine.playError();
      app.setDialog(
        'jtp',
        'explicando',
        '«Muy cerca. Si observás con atención, una de las mitades conserva una leve sombra. Aplicá el ajuste fino de 0.1° hasta lograr la penumbra simétrica.»',
        getCalibrationButtons()
      );
    } else {
      window.AudioEngine.playError();
      app.setDialog(
        'jtp',
        'sorpresa',
        '«¡Por las barbas de Faraday! La asimetría entre ambos campos es muy marcada; un semicírculo está totalmente brillante y el otro en sombras. Rotá el dial hacia los ángulos positivos cercanos a +13°.»',
        getCalibrationButtons()
      );
    }
  }

  function startMixingPhase() {
    st.phase = 'mixing';
    st.isPouring = false;
    st.mixDone = false;
    st.mixProgress = 0;
    st.deltaTmSec = 0.0;

    app.setDialog(
      'jtp',
      'serio',
      '«Llegó el instante del tiempo cero. En el momento exacto en que la solución ácida entre en contacto con los 25 mL de sacarosa, comienza la reacción. Presioná el botón para iniciar el vertido y el cronómetro, y esperá al 100% de mezcla para registrar Δt_m.»',
      getMixingButtons()
    );
  }

  function getMixingButtons() {
    if (!st.isPouring && st.mixProgress === 0) {
      return [
        {
          label: '🔴 ¡Iniciar Vertido y Cronómetro!',
          className: 'rpg-btn-accent',
          onClick: startPouringTimer
        }
      ];
    } else if (st.isPouring) {
      const canStop = st.mixProgress >= 100;
      return [
        {
          label: canStop
            ? '⏹️ ¡Mezcla Homogénea! Registrar Cronómetro (Δt_m)'
            : '⏳ Volcando y homogeneizando... esperá al 100%',
          className: canStop ? 'rpg-btn-accent' : '',
          onClick: stopPouringTimer
        }
      ];
    }
    return [];
  }

  function startPouringTimer() {
    if (st.isPouring || st.mixDone) return;
    st.isPouring = true;
    st.deltaTmSec = 0.0;
    st.mixProgress = 0;
    let readyButtonRendered = false;

    app.renderOptions(getMixingButtons());

    st.mixTimerId = setInterval(() => {
      st.deltaTmSec = Number((st.deltaTmSec + 0.1).toFixed(2));
      st.mixProgress = Math.min(100, (st.deltaTmSec / 4.2) * 100);

      if (Math.round(st.deltaTmSec * 10) % 3 === 0) {
        window.AudioEngine.playPourTick(st.mixProgress);
      }

      if (st.mixProgress >= 100 && !readyButtonRendered) {
        readyButtonRendered = true;
        app.renderOptions(getMixingButtons());
      }
    }, 100);
  }

  function stopPouringTimer() {
    if (st.mixProgress < 100) {
      window.AudioEngine.playError();
      app.setDialog(
        'jtp',
        'alerta',
        '«¡Un momento! Todavía no se completó el vertido ni la homogeneización del ácido. Esperá hasta que el indicador de mezcla llegue al 100%.»',
        getMixingButtons()
      );
      return;
    }

    if (st.mixTimerId) {
      clearInterval(st.mixTimerId);
      st.mixTimerId = null;
    }
    st.isPouring = false;
    st.mixDone = true;
    app.updateHud();
    window.AudioEngine.playFanfare();

    const t0Corr = st.deltaTmSec / 2.0;
    app.setDialog(
      'jtp',
      'feliz',
      `«¡Impecable! Registro cronometrado en Δt_m = ${st.deltaTmSec.toFixed(2)} s. Aplicamos el criterio cinético de la guía para el tiempo cero (t₀ = Δt_m / 2 = ${t0Corr.toFixed(2)} s). A cada tiempo registrado en el cronómetro se le descontará esta corrección.»`,
      [
        {
          label: '🧪 Enjuagar y Llenar el Tubo Polarimétrico (10 cm)',
          className: 'rpg-btn-accent',
          onClick: startBubblePhase
        }
      ]
    );
  }

  function startBubblePhase() {
    st.phase = 'bubble';
    st.bubbleState = 'hidden';
    app.setDialog(
      'ayudante',
      'normal',
      '«Enjuagaste la celda de 10 cm (1.0 dm) dos veces con una pequeña porción de la mezcla reactiva para evitar dilución residual, la llenaste al ras y colocaste la tapa a rosca... Pero mirá a trasluz.»',
      [
        {
          label: '👀 Mirar el Tubo Polarimétrico a Contraluz',
          className: 'rpg-btn-accent',
          onClick: () => {
            st.bubbleState = 'trapped';
            window.AudioEngine.playBubbleAlert();
            app.setDialog(
              'jtp',
              'alerta',
              '«¡Por el fantasma de Arrhenius! Quedó una burbuja de aire justo en el centro del tubo. Si el haz de luz incide ahí, la dispersión óptica va a arruinar las lecturas. ¿Cómo procedemos?»',
              getBubbleButtons()
            );
          }
        }
      ]
    );
  }

  function getBubbleButtons() {
    return [
      {
        label: '🤷 Dejarla ahí, la luz pasa por los costados',
        onClick: () => {
          window.AudioEngine.playError();
          app.setDialog(
            'jtp',
            'enojado',
            '«¡Cuidado! Si dejamos esa burbuja en el camino óptico, la refracción distorsionará por completo la ley de Malus y las medidas rotatorias. Pensemos en la geometría del tubo polarimétrico.»',
            getBubbleButtons()
          );
        }
      },
      {
        label: '🌪️ Agitar la celda con fuerza para desarmarla',
        onClick: () => {
          window.AudioEngine.playError();
          st.bubbleState = 'foamy';
          app.setDialog(
            'ayudante',
            'alerta',
            '«Al agitar con fuerza, la burbuja grande se dividió en numerosas microburbujas espumosas que enturbian el líquido. Hubo que vaciar y volver a enrasar el tubo... y la burbuja volvió a aparecer. Probemos con una maniobra más suave.»',
            getBubbleButtons()
          );
        }
      },
      {
        label: '👌 Inclinar el tubo suavemente hacia la ampolla reservorio',
        onClick: () => {
          st.bubbleState = 'cleared';
          window.AudioEngine.playFanfare();
          app.setDialog(
            'jtp',
            'feliz',
            '«¡Exacto! Para eso está diseñada la ampolla ensanchada del tubo polarimétrico. La burbuja quedó alojada en la parte superior y el camino óptico de 1.0 dm quedó totalmente despejado. ¡Vamos al polarímetro!»',
            [
              {
                label: '🔬 Colocar Celda en la Cuna e Iniciar Toma de 20 Puntos',
                onClick: startKineticsPhase
              }
            ]
          );
        }
      }
    ];
  }

  function startKineticsPhase() {
    st.phase = 'kinetics';
    st.dataRows = [];
    st.currentAlpha = st.alpha0Measured;
    st.zeroCrossAnnounced = false;
    st.infinityReached = false;
    app.updateHud();

    app.setDialog(
      'jtp',
      'mate',
      '«Habiendo verificado el manejo manual del ocular de Laurent, habilitamos el modo ágil del analizador para registrar sistemáticamente los 20 puntos cinéticos de la reacción. Pulsá el botón de avance para ir registrando las lecturas.»',
      getKineticsButtons()
    );
  }

  function getKineticsButtons() {
    const count = st.dataRows.length;
    const acidCfg = getAcidConfig(st.acidId);

    if (count < 20) {
      const nextTimeSec = acidCfg.timePointsSec[count];
      const nextMin = (nextTimeSec / 60).toFixed(1);
      return [
        {
          label: `⏱️ Medir Punto ${count + 1}/20 (t = ${nextMin} min)`,
          className: 'rpg-btn-accent',
          onClick: recordNextKineticPoint
        },
        {
          label: st.autoSweepId ? '⏸️ Pausar Auto-Avance' : '⚡ Completar Ráfaga Automática',
          onClick: toggleAutoSweep
        }
      ];
    } else if (!st.infinityReached) {
      return [
        {
          label: '⏩ Esperar al Día Siguiente (24 hs · Medir α_∞)',
          className: 'rpg-btn-accent',
          onClick: measureInfinityPoint
        }
      ];
    } else {
      return [
        {
          label: '📊 Ver Gráficos (I y II) y Exportar Archivo (.txt)',
          className: 'rpg-btn-accent',
          onClick: startFinalPhase
        }
      ];
    }
  }

  function toggleAutoSweep() {
    if (st.autoSweepId) {
      clearInterval(st.autoSweepId);
      st.autoSweepId = null;
      app.renderOptions(getKineticsButtons());
      return;
    }
    st.autoSweepId = setInterval(() => {
      if (st.dataRows.length < 20) {
        recordNextKineticPoint();
      } else {
        clearInterval(st.autoSweepId);
        st.autoSweepId = null;
        app.renderOptions(getKineticsButtons());
      }
    }, 280);
    app.renderOptions(getKineticsButtons());
  }

  function recordNextKineticPoint() {
    const idx = st.dataRows.length;
    if (idx >= 20) return;

    const acidCfg = getAcidConfig(st.acidId);
    const tCronSec = acidCfg.timePointsSec[idx];
    const tCorrSec = Math.max(1, tCronSec - st.deltaTmSec / 2.0);
    const alphaT = computeAlphaAtTime(st.acidId, tCorrSec, st.alpha0Measured, st.alphaInfMeasured);
    const row = computeRowMetrics(tCronSec, st.deltaTmSec, alphaT, st.alpha0Measured, st.alphaInfMeasured);

    const prevAlpha = st.currentAlpha;
    st.currentAlpha = row.alphaT;
    st.dataRows.push(row);
    app.updateHud();

    const ptNum = st.dataRows.length;
    const crossedZeroNow = prevAlpha >= 0 && row.alphaT < 0 && !st.zeroCrossAnnounced;
    if (crossedZeroNow) st.zeroCrossAnnounced = true;
    window.AudioEngine.playMeasureServo(crossedZeroNow);

    let msg = '';
    let mood = 'normal';
    if (ptNum === 20) {
      if (st.autoSweepId) {
        clearInterval(st.autoSweepId);
        st.autoSweepId = null;
      }
      msg = `«¡Punto 20/20 registrado (α_t = ${row.alphaT.toFixed(2)}°)! Ya tenemos toda la curva cinética. Ahora habilitamos el salto temporal de 24 horas para medir el ángulo a tiempo infinito (α_∞).»`;
      mood = 'feliz';
    } else if (crossedZeroNow) {
      msg = `«¡Atención al dial en el punto ${ptNum}: α_t = ${row.alphaT.toFixed(2)}°! ¡Acaba de cruzar el cero óptico! La solución pasa a ser nítidamente LEVÓGIRA. El aporte rotatorio negativo de la fructosa liberada (-92°) supera a la sacarosa remanente y a la glucosa.»`;
      mood = 'sorpresa';
    } else if (ptNum === 1) {
      msg = `«Punto 1 (t = ${(tCronSec / 60).toFixed(1)} min): α_t = +${row.alphaT.toFixed(2)}°. Comienza el seguimiento cinético: la sacarosa predomina en la mezcla, pero su concentración ya comienza a descender.»`;
      mood = 'mate';
    } else if (ptNum <= 6) {
      msg = `«Punto ${ptNum}/20 registrado: α_t = ${row.alphaT >= 0 ? '+' : ''}${row.alphaT.toFixed(2)}°. La rotación desciende sostenidamente a medida que los protones catalizan la hidrólisis de los enlaces glucosídicos.»`;
      mood = 'explicando';
    } else if (ptNum <= 14) {
      msg = `«Punto ${ptNum}/20: α_t = ${row.alphaT >= 0 ? '+' : ''}${row.alphaT.toFixed(2)}°. Ya se hidrolizó el ${(row.x * 100).toFixed(1)}% de la sacarosa inicial. ¡Continuemos registrando!»`;
      mood = 'mate';
    } else {
      msg = `«Punto ${ptNum}/20: α_t = ${row.alphaT.toFixed(2)}° (conversión ${(row.x * 100).toFixed(1)}%). La velocidad de cambio disminuye al aproximarse al equilibrio de la hidrólisis completa.»`;
      mood = 'normal';
    }

    app.setDialog('jtp', mood, msg, getKineticsButtons());
  }

  function measureInfinityPoint() {
    st.infinityReached = true;
    st.alphaInfMeasured = -3.85;
    st.currentAlpha = st.alphaInfMeasured;
    window.AudioEngine.playFanfare();

    app.setDialog(
      'jtp',
      'feliz',
      `«¡Al día siguiente en el laboratorio! Llegamos a t = ∞ (24 hs). La hidrólisis de la sacarosa es completa (x ≈ 1.0). Registramos la lectura final: α_∞ = ${st.alphaInfMeasured.toFixed(2)}°. ¡Por la constante de Arrhenius y la ley de Biot, tenemos la serie completa!»`,
      getKineticsButtons()
    );
  }

  function startFinalPhase() {
    st.phase = 'final';
    st.graphMode = 'x_curves';
    app.setDialog(
      'jtp',
      'feliz',
      '«¡Excelente labor experimental! Mirá los gráficos en pantalla: el ajuste lineal refleja con claridad la cinética de pseudo-primer orden. Descargá el archivo .txt con los datos tabulados para tu informe y sellá el TP 2 en tu Libreta Universitaria para volver al Hall Principal.»',
      getFinalButtons()
    );
  }

  function getFinalButtons() {
    const isXMode = st.graphMode !== 'ln_linear';
    const reg = computeLinearRegression(st.dataRows);
    const acidCfg = getAcidConfig(st.acidId);
    const summaryStr = `${acidCfg.label} | k=${reg.k.toExponential(2)} s⁻¹ | t₁/₂=${reg.tHalfMin.toFixed(1)} min`;

    return [
      {
        label: `💾 1. Descargar Datos Experimentales (${st.acidId}.txt)`,
        className: 'rpg-btn-accent',
        onClick: downloadTxtFile
      },
      {
        label: isXMode
          ? '📈 Cambiar a Gráfico I: Lineal ln((α_∞ - α_t)/(α_∞ - α_0)) vs t'
          : '📉 Cambiar a Gráfico II: Curvas de x y (1 - x) vs t',
        onClick: () => {
          st.graphMode = isXMode ? 'ln_linear' : 'x_curves';
          app.renderOptions(getFinalButtons());
        }
      },
      {
        label: '🪪 2. ¡Sellar TP 2 en mi Libreta y Volver al Hall Principal!',
        className: 'rpg-btn-accent',
        onClick: () => {
          app.completeMissionAndReturn('tp2_polarimetria', summaryStr);
        }
      }
    ];
  }

  function downloadTxtFile() {
    const pad = (s, n) => (String(s).length >= n ? String(s) : String(s) + ' '.repeat(n - String(s).length));
    const acidCfg = getAcidConfig(st.acidId);
    const t0Corr = st.deltaTmSec / 2.0;
    const nowStr = new Date().toLocaleString('es-AR');

    const lines = [];
    lines.push('================================================================================');
    lines.push('LABORATORIO DE FISICOQUÍMICA - CINÉTICA QUÍMICA POR POLARIMETRÍA (TP Nº 2)');
    lines.push('Trabajo Práctico: Hidrólisis ácida de la Sacarosa (Inversión)');
    lines.push('================================================================================');
    lines.push(`Fecha de registro:                                 ${nowStr}`);
    lines.push(`Polarímetro empleado:                              ${PARAMS.polarimeterName}`);
    lines.push(`Celda empleada (camino óptico l):                  ${PARAMS.cellLengthDm.toFixed(1)} dm (10.0 cm)`);
    lines.push(`Temperatura de trabajo:                            ${PARAMS.temperatureC.toFixed(1)} °C`);
    lines.push(`Concentración inicial de Sacarosa (sol. madre):    ${PARAMS.sucroseStockPercent.toFixed(1)} % p/v`);
    lines.push(`Concentración inicial de Sacarosa en mezcla:       ${PARAMS.sucroseMixPercent.toFixed(1)} % p/v (${PARAMS.sucroseMixMolar.toFixed(3)} M)`);
    lines.push(`Ácido catalizador (solución empleada):             HCl ${acidCfg.stockMolar.toFixed(1)} M`);
    lines.push(`Concentración de HCl en la mezcla de reacción:     ${acidCfg.mixMolar.toFixed(2)} M`);
    lines.push(`Tiempo de mezclado medido (Delta t_m):             ${st.deltaTmSec.toFixed(2)} s`);
    lines.push(`Corrección de tiempo cero (t_0 = Delta t_m / 2):   ${t0Corr.toFixed(2)} s`);
    lines.push(`Ángulo de rotación inicial (alpha_0):              +${st.alpha0Measured.toFixed(2)} deg`);
    lines.push(`Ángulo a tiempo infinito 24h (alpha_inf):          ${st.alphaInfMeasured.toFixed(2)} deg`);
    lines.push('================================================================================');
    lines.push(
      pad('t_cron/s', 12) +
      pad('t_corr/s', 12) +
      pad('alpha_t/deg', 14) +
      pad('ln((a_inf-at)/(a_inf-a0))', 28) +
      pad('x', 12) +
      '1-x'
    );
    lines.push('--------------------------------------------------------------------------------');
    lines.push(
      pad('0.0', 12) +
      pad('0.00', 12) +
      pad(`+${st.alpha0Measured.toFixed(2)}`, 14) +
      pad('0.0000', 28) +
      pad('0.0000', 12) +
      '1.0000'
    );

    st.dataRows.forEach(row => {
      const alphaStr = (row.alphaT >= 0 ? '+' : '') + row.alphaT.toFixed(2);
      lines.push(
        pad(row.tCronSec.toFixed(1), 12) +
        pad(row.tCorrSec.toFixed(2), 12) +
        pad(alphaStr, 14) +
        pad(row.lnTerm.toFixed(4), 28) +
        pad(row.x.toFixed(4), 12) +
        row.oneMinusX.toFixed(4)
      );
    });

    lines.push('--------------------------------------------------------------------------------');
    lines.push(
      pad('86400 (inf)', 12) +
      pad('inf', 12) +
      pad(st.alphaInfMeasured.toFixed(2), 14) +
      pad('-', 28) +
      pad('1.0000', 12) +
      '0.0000'
    );
    lines.push('================================================================================');

    const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `datos_tp2_polarimetria_HCl_${st.acidId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // =========================================================================
  // RENDERIZADO GRÁFICO DE LA MISIÓN 2
  // =========================================================================
  let animTick = 0;

  function drawPixelBox(ctx, x, y, w, h, fill, border = '#ffffff', borderW = 2) {
    ctx.fillStyle = fill;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
    if (border && borderW > 0) {
      ctx.strokeStyle = border;
      ctx.lineWidth = borderW;
      ctx.strokeRect(Math.floor(x) + 1, Math.floor(y) + 1, Math.floor(w) - 2, Math.floor(h) - 2);
    }
  }

  function renderLaurentOcular(ctx, cx, cy, radius, dialAngle, targetAngle, showHints = true) {
    const fields = computeLaurentFields(dialAngle, targetAngle);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 14, 0, Math.PI * 2);
    ctx.fillStyle = '#1b1f2a';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#c89d54';
    ctx.stroke();

    for (let a = 0; a < 4; a++) {
      const ang = (a * Math.PI) / 2 + Math.PI / 4;
      ctx.fillStyle = '#e5c178';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * (radius + 8), cy + Math.sin(ang) * (radius + 8), 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI / 2, (3 * Math.PI) / 2);
    ctx.closePath();
    ctx.fillStyle = intensityToSodiumColor(fields.iLeft);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = intensityToSodiumColor(fields.iRight);
    ctx.fill();

    ctx.strokeStyle = 'rgba(20, 12, 4, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = fields.isPenumbraMatch ? '#06d6a0' : '#4a5568';
    ctx.stroke();

    if (showHints) {
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      let statusText = 'DESBALANCEADO';
      let statusColor = '#ff6b6b';
      if (fields.isPenumbraMatch) {
        statusText = '★ IGUALDAD DE PENUMBRA ★';
        statusColor = '#06d6a0';
      } else if (fields.isClose) {
        statusText = 'CASI IGUALADO (Ajuste fino ±0.1°)';
        statusColor = '#ffd166';
      } else if (fields.isBrightField) {
        statusText = 'CAMPO CLARO (Buscá la penumbra oscura)';
        statusColor = '#ff9f1c';
      }
      ctx.fillStyle = statusColor;
      ctx.fillText(statusText, cx, cy + radius + 30);
    }
    ctx.restore();
  }

  function renderGraduatedDial(ctx, cx, cy, radius, dialAngle, labelTitle = 'ANALIZADOR (Vernier)') {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#23293a';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#9aa5b1';
    ctx.stroke();

    const rotRad = (dialAngle * Math.PI) / 180.0;
    for (let deg = 0; deg < 360; deg += 10) {
      const a = ((deg - 90) * Math.PI) / 180.0 + rotRad;
      const isMajor = deg % 30 === 0;
      const rIn = isMajor ? radius - 14 : radius - 8;
      ctx.strokeStyle = isMajor ? '#ffd166' : '#cbd5e0';
      ctx.lineWidth = isMajor ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn);
      ctx.lineTo(cx + Math.cos(a) * (radius - 2), cy + Math.sin(a) * (radius - 2));
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#141824';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#e5c178';
    ctx.stroke();

    ctx.fillStyle = '#ff5964';
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius + 2);
    ctx.lineTo(cx - 6, cy - radius - 9);
    ctx.lineTo(cx + 6, cy - radius - 9);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#06d6a0';
    ctx.font = 'bold 17px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const sign = dialAngle >= 0 ? '+' : '';
    ctx.fillText(`${sign}${dialAngle.toFixed(2)}°`, cx, cy);

    ctx.fillStyle = '#cbd5e0';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(labelTitle, cx, cy + radius + 24);
    ctx.restore();
  }

  function drawFlask(ctx, x, y, label, sublabel, liquidColor, fillLevel = 0.65) {
    ctx.save();
    ctx.fillStyle = 'rgba(200, 235, 255, 0.22)';
    ctx.fillRect(x - 10, y - 62, 20, 22);

    ctx.beginPath();
    ctx.moveTo(x - 10, y - 40);
    ctx.lineTo(x - 32, y + 10);
    ctx.lineTo(x + 32, y + 10);
    ctx.lineTo(x + 10, y - 40);
    ctx.closePath();
    ctx.fillStyle = 'rgba(200, 235, 255, 0.16)';
    ctx.fill();

    const liqTopY = y + 10 - 46 * fillLevel;
    const halfWTop = 10 + 22 * (1 - fillLevel);
    ctx.beginPath();
    ctx.moveTo(x - halfWTop, liqTopY);
    ctx.lineTo(x - 30, y + 8);
    ctx.lineTo(x + 30, y + 8);
    ctx.lineTo(x + halfWTop, liqTopY);
    ctx.closePath();
    ctx.fillStyle = liquidColor;
    ctx.fill();

    ctx.strokeStyle = '#d8f3dc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 62);
    ctx.lineTo(x + 12, y - 62);
    ctx.moveTo(x - 10, y - 62);
    ctx.lineTo(x - 10, y - 40);
    ctx.lineTo(x - 32, y + 10);
    ctx.lineTo(x + 32, y + 10);
    ctx.lineTo(x + 10, y - 40);
    ctx.lineTo(x + 10, y - 62);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 25);
    if (sublabel) {
      ctx.fillStyle = '#ffd166';
      ctx.font = '10px monospace';
      ctx.fillText(sublabel, x, y + 38);
    }
    ctx.restore();
  }

  function renderFinalPlots(ctx, w, h) {
    const rows = st.dataRows;
    const reg = computeLinearRegression(rows);
    const acidCfg = getAcidConfig(st.acidId);
    const padL = 68, padT = 54, plotW = 415, plotH = 195;

    ctx.fillStyle = '#1e2436';
    ctx.fillRect(16, 10, w - 32, 30);
    ctx.strokeStyle = st.graphMode === 'x_curves' ? '#7bdff2' : '#06d6a0';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 10, w - 32, 30);

    ctx.fillStyle = st.graphMode === 'x_curves' ? '#7bdff2' : '#06d6a0';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      st.graphMode === 'x_curves'
        ? `GRÁFICO II (VISTA PREVIA): x y (1 - x) vs t  [${acidCfg.label}]`
        : `GRÁFICO I (VISTA PREVIA): ln((α_∞ - α_t)/(α_∞ - α_0)) vs t  [${acidCfg.label}]`,
      w / 2,
      29
    );

    ctx.fillStyle = '#0c101a';
    ctx.fillRect(padL, padT, plotW, plotH);
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 2;
    ctx.strokeRect(padL, padT, plotW, plotH);

    if (rows.length > 0) {
      const maxT = Math.max(...rows.map(r => r.tCorrSec), 100) * 1.04;
      const toX = t => padL + (t / maxT) * plotW;

      if (st.graphMode === 'x_curves') {
        const toY = val => padT + (1.0 - val) * plotH;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#a0aec0';
        ctx.font = '10px monospace';
        for (let i = 0; i <= 4; i++) {
          const yVal = 1.0 - i * 0.25;
          const py = toY(yVal);
          ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(padL + plotW, py); ctx.stroke();
          ctx.textAlign = 'right';
          ctx.fillText(yVal.toFixed(2), padL - 6, py + 3);
        }
        for (let j = 0; j <= 4; j++) {
          const tVal = (j / 4) * maxT;
          const px = toX(tVal);
          ctx.beginPath(); ctx.moveTo(px, padT); ctx.lineTo(px, padT + plotH); ctx.stroke();
          ctx.textAlign = 'center';
          ctx.fillText(`${Math.round(tVal)}s`, px, padT + plotH + 15);
        }

        const allPts = [{ tCorrSec: 0, x: 0, oneMinusX: 1 }].concat(rows);
        ctx.strokeStyle = '#06d6a0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        allPts.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(toX(pt.tCorrSec), toY(pt.x));
          else ctx.lineTo(toX(pt.tCorrSec), toY(pt.x));
        });
        ctx.stroke();

        ctx.strokeStyle = '#7bdff2';
        ctx.beginPath();
        allPts.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(toX(pt.tCorrSec), toY(pt.oneMinusX));
          else ctx.lineTo(toX(pt.tCorrSec), toY(pt.oneMinusX));
        });
        ctx.stroke();
      } else {
        const minY = Math.min(...rows.map(r => r.lnTerm), -2.5) * 1.08;
        const maxY = 0.05;
        const toY = yVal => padT + ((maxY - yVal) / (maxY - minY)) * plotH;

        ctx.strokeStyle = '#ff5964';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(toX(0), toY(reg.intercept));
        ctx.lineTo(toX(maxT * 0.95), toY(reg.slope * maxT * 0.95 + reg.intercept));
        ctx.stroke();

        rows.forEach(pt => {
          ctx.fillStyle = '#06d6a0';
          ctx.beginPath();
          ctx.arc(toX(pt.tCorrSec), toY(pt.lnTerm), 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    // Caja lateral de resumen
    const boxX = padL + plotW + 18;
    const boxW = w - boxX - 16;
    drawPixelBox(ctx, boxX, padT, boxW, plotH, '#181e2c', '#ffd166', 2);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('RESUMEN TP Nº 2:', boxX + 12, padT + 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px monospace';
    ctx.fillText(`• Ácido:   ${acidCfg.label}`, boxX + 12, padT + 44);
    ctx.fillText(`• Δt_m:    ${st.deltaTmSec.toFixed(2)} s`, boxX + 12, padT + 64);
    ctx.fillText(`• α₀:      +${st.alpha0Measured.toFixed(2)}°`, boxX + 12, padT + 84);
    ctx.fillText(`• α_∞:     ${st.alphaInfMeasured.toFixed(2)}°`, boxX + 12, padT + 104);
    ctx.fillStyle = '#06d6a0';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`• k ≈ ${reg.k.toExponential(3)} s⁻¹`, boxX + 12, padT + 132);
    ctx.fillText(`• t₁/₂ ≈ ${reg.tHalfMin.toFixed(1)} min`, boxX + 12, padT + 152);
    ctx.fillStyle = '#7bdff2';
    ctx.fillText(`• R² = ${reg.r2.toFixed(4)}`, boxX + 12, padT + 174);
  }

  return {
    start: function (appCallbacks) {
      app = appCallbacks;
      startIntro();
    },

    render: function (canvas) {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      animTick++;

      ctx.fillStyle = '#131722';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 38) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h - 65); ctx.stroke();
      }
      for (let gy = 0; gy < h - 65; gy += 38) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
      }

      ctx.fillStyle = '#252b3d';
      ctx.fillRect(0, h - 65, w, 65);
      ctx.fillStyle = '#3b4254';
      ctx.fillRect(0, h - 65, w, 5);

      if (st.phase === 'intro') {
        drawPixelBox(ctx, 20, 14, w - 40, 34, '#1e2436', '#ffd166', 2);
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('★ MISIÓN 2: CINÉTICA DE INVERSIÓN DE LA SACAROSA POR POLARIMETRÍA ★', w / 2, 36);

        drawFlask(ctx, 130, h - 80, 'SACAROSA 40%', 'Solución Madre', 'rgba(255, 235, 150, 0.55)', 0.75);
        drawFlask(ctx, 270, h - 80, 'HCl 3.0 M', 'Ruta Estándar', 'rgba(114, 239, 221, 0.55)', 0.65);
        drawFlask(ctx, 400, h - 80, 'HCl 6.0 M', 'Ruta Furiosa', 'rgba(255, 89, 100, 0.65)', 0.65);

        drawPixelBox(ctx, 515, h - 165, 205, 95, '#1b1f2a', '#c89d54', 3);
        ctx.fillStyle = '#e5c178';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('POLARÍMETRO DE LAURENT', 617, h - 142);
        ctx.fillStyle = '#ffd166';
        ctx.font = '11px monospace';
        ctx.fillText('Lámpara Na (λ = 589.3 nm)', 617, h - 122);
        ctx.fillStyle = '#06d6a0';
        ctx.fillText('Celda l = 1.0 dm (10 cm)', 617, h - 102);
      } else if (st.phase === 'prep') {
        drawPixelBox(ctx, 20, 14, w - 40, 34, '#1e2436', '#7bdff2', 2);
        ctx.fillStyle = '#7bdff2';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PASO 1: PREPARACIÓN DE SOLUCIONES Y BLANCO PARA α₀', w / 2, 36);

        const pulse = 0.65 + 0.08 * Math.sin(animTick * 0.08);
        drawFlask(ctx, 140, h - 80, 'Matraz 50 mL', 'Sacarosa 40% p/v', 'rgba(255, 225, 130, 0.6)', 0.85);
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('── 25 mL ──►', 240, h - 115);
        drawFlask(ctx, 355, h - 80, 'BLANCO (α₀)', '25mL Sac + 25mL H₂O', 'rgba(123, 223, 242, 0.55)', pulse);
        ctx.fillStyle = '#ff9f1c';
        ctx.fillText('── 25 mL ──►', 475, h - 115);
        const acidCfg = getAcidConfig(st.acidId);
        drawFlask(ctx, 600, h - 80, 'PARA CINÉTICA', `25mL Sac + ${acidCfg.label}`, 'rgba(255, 159, 28, 0.55)', 0.55);
      } else if (st.phase === 'calibration') {
        drawPixelBox(ctx, 20, 10, w - 40, 30, '#1e2436', '#ffd166', 2);
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CALIBRACIÓN MANUAL DEL BLANCO (α₀): IGUALÁ LA PENUMBRA OSCURA', w / 2, 29);

        renderLaurentOcular(ctx, 205, 152, 76, st.dialAngle, st.alpha0Target, true);
        renderGraduatedDial(ctx, 535, 145, 68, st.dialAngle, 'VERNIER DEL ANALIZADOR');

        drawPixelBox(ctx, 330, 75, 110, 125, '#192030', '#4a5568', 1);
        ctx.fillStyle = '#cbd5e0';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GUÍA RÁPIDA', 385, 95);
        ctx.fillStyle = '#ffd166';
        ctx.fillText('Sacarosa 20%', 385, 118);
        ctx.fillText('l = 1.0 dm', 385, 136);
        ctx.fillStyle = '#a0aec0';
        ctx.fillText('Usá ← / →', 385, 162);
        ctx.fillText('o Ruedita', 385, 178);
      } else if (st.phase === 'mixing') {
        const acidCfg = getAcidConfig(st.acidId);
        drawPixelBox(ctx, 20, 10, w - 40, 30, '#1e2436', '#ff9f1c', 2);
        ctx.fillStyle = '#ff9f1c';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`CONTACTO INICIAL: 25 mL SACAROSA 40% + 25 mL ${acidCfg.label}`, w / 2, 29);

        const mixFrac = Math.min(1, st.mixProgress / 100);
        drawFlask(
          ctx,
          220,
          h - 75,
          'MEZCLA REACCIÓN',
          `[HCl]ef = ${acidCfg.mixMolar.toFixed(1)} M`,
          mixFrac > 0.5 ? 'rgba(255, 159, 28, 0.7)' : 'rgba(255, 235, 150, 0.6)',
          0.45 + 0.4 * mixFrac
        );

        if (st.isPouring && st.mixProgress < 100) {
          ctx.strokeStyle = '#72efdd';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(220, 62);
          ctx.lineTo(220, h - 90);
          ctx.stroke();
        }

        drawPixelBox(ctx, 390, 65, 320, 155, '#181e2c', '#ffd166', 3);
        ctx.fillStyle = '#a0aec0';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CRONÓMETRO DE MEZCLADO (Δt_m)', 550, 92);
        ctx.fillStyle = '#06d6a0';
        ctx.font = 'bold 34px monospace';
        ctx.fillText(`${st.deltaTmSec.toFixed(2)} s`, 550, 135);

        drawPixelBox(ctx, 425, 158, 250, 22, '#0f131d', '#4a5568', 2);
        ctx.fillStyle = st.mixProgress >= 100 ? '#06d6a0' : '#ff9f1c';
        ctx.fillRect(427, 160, Math.floor(2.46 * Math.min(100, st.mixProgress)), 18);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`Homogeneizado: ${Math.floor(st.mixProgress)}%`, 550, 173);
        ctx.fillStyle = '#ffd166';
        ctx.font = '12px monospace';
        ctx.fillText(`Corrección t₀ = Δt_m / 2 = ${(st.deltaTmSec / 2).toFixed(2)} s`, 550, 204);
      } else if (st.phase === 'bubble') {
        drawPixelBox(ctx, 20, 10, w - 40, 30, '#1e2436', '#7bdff2', 2);
        ctx.fillStyle = '#7bdff2';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('INSPECCIÓN DEL TUBO POLARIMÉTRICO (Camino óptico l = 1.0 dm)', w / 2, 29);

        const cx = w / 2, cy = 155;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(st.bubbleState === 'cleared' ? -0.08 : 0);

        ctx.fillStyle = st.bubbleState === 'cleared' ? 'rgba(255, 209, 102, 0.35)' : 'rgba(255, 89, 100, 0.22)';
        ctx.fillRect(-260, -18, 520, 36);
        drawPixelBox(ctx, -190, -26, 380, 52, 'rgba(180, 230, 255, 0.18)', '#d8f3dc', 3);
        drawPixelBox(ctx, 40, -68, 70, 44, 'rgba(180, 230, 255, 0.22)', '#d8f3dc', 3);
        ctx.fillStyle = '#ffd166';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Ampolla Trampa', 75, -75);

        drawPixelBox(ctx, -212, -32, 24, 64, '#3b4254', '#c89d54', 2);
        drawPixelBox(ctx, 188, -32, 24, 64, '#3b4254', '#c89d54', 2);

        if (st.bubbleState === 'trapped') {
          ctx.beginPath();
          ctx.arc(0, 0, 20, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#ff5964';
          ctx.stroke();
          ctx.fillStyle = '#ff5964';
          ctx.font = 'bold 12px monospace';
          ctx.fillText('¡BURBUJA EN EL CAMINO ÓPTICO!', 0, 48);
        } else if (st.bubbleState === 'foamy') {
          for (let i = 0; i < 28; i++) {
            ctx.beginPath();
            ctx.arc(-150 + ((i * 37) % 300), -16 + ((i * 19) % 32), 5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fill();
          }
          ctx.fillStyle = '#ff9f1c';
          ctx.font = 'bold 12px monospace';
          ctx.fillText('¡ESPUMA DE MICROBURBUJAS! REINTENTÁ CON CUIDADO', 0, 48);
        } else if (st.bubbleState === 'cleared') {
          ctx.beginPath();
          ctx.arc(75, -48, 14, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#06d6a0';
          ctx.stroke();
          ctx.fillStyle = '#06d6a0';
          ctx.font = 'bold 13px monospace';
          ctx.fillText('✓ CAMINO ÓPTICO DE 1.0 dm 100% DESPEJADO', 0, 48);
        }
        ctx.restore();
      } else if (st.phase === 'kinetics') {
        const acidCfg = getAcidConfig(st.acidId);
        drawPixelBox(ctx, 20, 10, w - 40, 30, '#1e2436', '#06d6a0', 2);
        ctx.fillStyle = '#06d6a0';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`SEGUIMIENTO CINÉTICO (${acidCfg.label}) — PUNTOS REGISTRADOS: ${st.dataRows.length} / 20`, w / 2, 29);

        renderLaurentOcular(ctx, 130, 148, 62, st.currentAlpha, st.currentAlpha, false);
        renderGraduatedDial(ctx, 315, 148, 58, st.currentAlpha, 'ÁNGULO α_t');

        drawPixelBox(ctx, 425, 55, 315, 195, '#181e2c', '#4a5568', 2);
        const lastRow = st.dataRows.length > 0 ? st.dataRows[st.dataRows.length - 1] : null;
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('ESTADO EN TIEMPO REAL:', 445, 80);
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px monospace';
        const tDisp = st.infinityReached ? '86400 s (24 hs)' : lastRow ? `${lastRow.tCorrSec.toFixed(1)} s` : '0.0 s';
        const xDisp = st.infinityReached ? '100.0 %' : lastRow ? `${(lastRow.x * 100).toFixed(1)} %` : '0.0 %';
        ctx.fillText(`• Tiempo corr (t):  ${tDisp}`, 445, 106);
        ctx.fillText(`• Rotación (α_t):   ${st.currentAlpha >= 0 ? '+' : ''}${st.currentAlpha.toFixed(2)}°`, 445, 128);
        ctx.fillText(`• Conversión (x):   ${xDisp}`, 445, 150);
        const signLabel = st.currentAlpha >= 0 ? 'DEXTRÓGIRA (+)' : 'LEVÓGIRA (-)';
        ctx.fillStyle = st.currentAlpha >= 0 ? '#7bdff2' : '#ff9f1c';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`• Carácter óptico:  ${signLabel}`, 445, 174);
      } else if (st.phase === 'final') {
        renderFinalPlots(ctx, w, h);
      }
    },

    onCanvasMouseDown: function (pt) {
      if (st.phase === 'calibration' && !st.calibDone) {
        st.isDraggingDial = true;
        st.dragStartX = pt.x;
        st.dragMoved = false;
      }
    },

    onMouseMove: function (pt) {
      if (st.phase === 'calibration' && !st.calibDone && st.isDraggingDial) {
        const dx = pt.x - st.dragStartX;
        if (Math.abs(dx) >= 8) {
          const steps = Math.trunc(dx / 8);
          rotateDial(steps * 0.1);
          st.dragStartX += steps * 8;
          st.dragMoved = true;
        }
      }
    },

    onMouseUp: function () {
      st.isDraggingDial = false;
    },

    onCanvasClick: function (pt) {
      if (st.phase === 'calibration' && !st.calibDone && !st.dragMoved) {
        if (pt.x >= 450 && pt.x <= 620 && pt.y >= 65 && pt.y <= 225) {
          rotateDial(pt.x < 535 ? -0.1 : 0.1);
        }
      }
    },

    onCanvasWheel: function (pt, deltaY, shiftKey) {
      if (st.phase === 'calibration' && !st.calibDone) {
        const step = shiftKey ? 1.0 : 0.1;
        rotateDial(deltaY < 0 ? step : -step);
        return true;
      }
      return false;
    },

    onKeyDown: function (e) {
      if (st.phase === 'calibration' && !st.calibDone) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); rotateDial(e.shiftKey ? -1.0 : -0.1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); rotateDial(e.shiftKey ? 1.0 : 0.1); }
        else if (e.key === 'Enter') { e.preventDefault(); checkCalibrationMatch(); }
      }
    },

    getHudStats: function () {
      const acidCfg = getAcidConfig(st.acidId);
      return [
        { label: 'Misión 2', value: `Polarimetría (${acidCfg.label})` },
        { label: 'Blanco α₀', value: st.calibDone ? `+${st.alpha0Measured.toFixed(2)}°` : 'Pendiente' },
        { label: 'Mezcla Δt_m', value: st.mixDone ? `${st.deltaTmSec.toFixed(2)} s` : 'Pendiente' },
        { label: 'Puntos', value: `${st.dataRows.length} / 20` }
      ];
    },

    getLogbookData: function () {
      const acidCfg = getAcidConfig(st.acidId);
      const rows = [
        ['0', '0.0', '0.00', `+${st.alpha0Measured.toFixed(2)}°`, '0.0000', '0.0000', '1.0000']
      ];
      st.dataRows.forEach((r, idx) => {
        rows.push([
          String(idx + 1),
          r.tCronSec.toFixed(1),
          r.tCorrSec.toFixed(2),
          `${r.alphaT >= 0 ? '+' : ''}${r.alphaT.toFixed(2)}°`,
          r.lnTerm.toFixed(4),
          r.x.toFixed(4),
          r.oneMinusX.toFixed(4)
        ]);
      });
      if (st.infinityReached) {
        rows.push(['∞ (24h)', '86400', '∞', `${st.alphaInfMeasured.toFixed(2)}°`, '—', '1.0000', '0.0000']);
      }

      return {
        title: `📒 BITÁCORA TP Nº 2 — POLARIMETRÍA (${acidCfg.label})`,
        meta: `l = 1.0 dm | T = 20.0 °C | Δt_m = ${st.deltaTmSec.toFixed(2)} s | α₀ = +${st.alpha0Measured.toFixed(2)}° | α_∞ = ${st.alphaInfMeasured.toFixed(2)}°`,
        headers: ['#', 't_cron (s)', 't_corr (s)', 'α_t (°)', 'ln((α_∞-α_t)/(α_∞-α_0))', 'x', '1 - x'],
        rows: rows
      };
    },

    cleanup: function () {
      stopTimers();
    }
  };
})();
