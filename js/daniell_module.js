/**
 * daniell_module.js — LAB_RPG Suite Unificada
 * Módulo autocontenido para la MISIÓN 1:
 * "El Desafío de Poggendorff" (Medida de la FEM de la Pila de Daniell por Oposición).
 */

window.DaniellModule = (function () {
  const PARAMS = {
    temperatureC: 20.0,
    temperatureK: 293.15,
    eWeston: 1.0186,
    eCalomel20C: 0.2445,
    gamma: {
      CuSO4: { '0.1': 0.16, '0.01': 0.40, '0.001': 0.69 },
      ZnSO4: { '0.1': 0.15, '0.01': 0.39, '0.001': 0.70 }
    }
  };

  const PILAS = [
    {
      id: 1,
      code: 'Pila 1',
      name: 'Pila 1: Zn (0.1 M) vs Calomel Saturado (ECS)',
      iupac: 'Me / Zn / ZnSO₄ (0,1 M) // KCl(sat) / Hg₂Cl₂(s) / Hg / Me',
      znConc: 0.1,
      cuConc: null,
      targetEmf: 1.055
    },
    {
      id: 2,
      code: 'Pila 2',
      name: 'Pila 2: Calomel Saturado (ECS) vs Cu (0.1 M)',
      iupac: 'Me / Hg / Hg₂Cl₂(s) / KCl(sat) // CuSO₄ (0,1 M) / Cu / Me',
      znConc: null,
      cuConc: 0.1,
      targetEmf: 0.046
    },
    {
      id: 3,
      code: 'Pila 3',
      name: 'Pila 3: Daniell Clásica — Zn (0.1 M) // Cu (0.1 M)',
      iupac: 'Me / Zn / ZnSO₄ (0,1 M) // CuSO₄ (0,1 M) / Cu / Me',
      znConc: 0.1,
      cuConc: 0.1,
      targetEmf: 1.101
    },
    {
      id: 4,
      code: 'Pila 4',
      name: 'Pila 4: Daniell Diluida — Zn (0.1 M) // Cu (0.01 M)',
      iupac: 'Me / Zn / ZnSO₄ (0,1 M) // CuSO₄ (0,01 M) / Cu / Me',
      znConc: 0.1,
      cuConc: 0.01,
      targetEmf: 1.084
    },
    {
      id: 5,
      code: 'Pila 5',
      name: 'Pila 5: Daniell Muy Diluida — Zn (0.1 M) // Cu (0.001 M)',
      iupac: 'Me / Zn / ZnSO₄ (0,1 M) // CuSO₄ (0,001 M) / Cu / Me',
      znConc: 0.1,
      cuConc: 0.001,
      targetEmf: 1.062
    }
  ];

  // Los 12 bornes del circuito (con margen amplio respecto a los bordes de cada caja)
  const TERMINALS = [
    { id: 'src_pos', label: 'Fuente (+)', short: '+', x: 70, y: 102, polarity: 'pos' },
    { id: 'src_neg', label: 'Fuente (-)', short: '-', x: 156, y: 102, polarity: 'neg' },
    { id: 'cell_pos', label: 'Cátodo (+)', short: '+', x: 70, y: 222, polarity: 'pos' },
    { id: 'cell_neg', label: 'Ánodo (-)', short: '-', x: 156, y: 222, polarity: 'neg' },
    { id: 'pot_alim_pos', label: 'Alim (+)', short: '+', x: 325, y: 102, polarity: 'pos' },
    { id: 'pot_alim_neg', label: 'Alim (-)', short: '-', x: 435, y: 102, polarity: 'neg' },
    { id: 'pot_pila_pos', label: 'Pila (+)', short: '+', x: 292, y: 222, polarity: 'pos' },
    { id: 'pot_pila_neg', label: 'Pila (-)', short: '-', x: 358, y: 222, polarity: 'neg' },
    { id: 'pot_galv_pos', label: 'Galv (+)', short: '+', x: 424, y: 222, polarity: 'galv' },
    { id: 'pot_galv_neg', label: 'Galv (-)', short: '-', x: 490, y: 222, polarity: 'galv' },
    { id: 'galv_pos', label: 'G (+)', short: '+', x: 606, y: 222, polarity: 'galv' },
    { id: 'galv_neg', label: 'G (-)', short: '-', x: 686, y: 222, polarity: 'galv' }
  ];

  const CORRECT_PAIRS = [
    ['src_pos', 'pot_alim_pos'],
    ['src_neg', 'pot_alim_neg'],
    ['cell_pos', 'pot_pila_pos'],
    ['cell_neg', 'pot_pila_neg'],
    ['galv_pos', 'pot_galv_pos'],
    ['galv_neg', 'pot_galv_neg']
  ];

  const st = {
    phase: 'intro', // 'intro' | 'cell_prep' | 'circuit' | 'weston' | 'measure' | 'final'
    electrodesSanded: false,
    sheathBubbleCleared: false,
    wires: [],
    selectedTerminal: null,
    circuitAttempts: 0,
    circuitComplete: false,
    rCalOhms: 43.0,
    westonCalibrated: false,
    pulsePressed: false,
    currentPilaIndex: 0,
    dialR1: 0.8,
    dialR2: 0.020,
    activeDial: 'R1',
    measuredEmfs: {},
    graphMode: 'nernst',
    dragDial: null,
    dragStartX: 0,
    dragMoved: false
  };

  let app = null; // Callbacks hacia main.js: { setDialog, renderOptions, updateHud, completeMissionAndReturn }

  function getTerm(id) {
    return TERMINALS.find(t => t.id === id);
  }

  function hasConn(idA, idB) {
    return st.wires.some(
      w => (w.from === idA && w.to === idB) || (w.from === idB && w.to === idA)
    );
  }

  function wireColor(tA, tB) {
    if (tA.polarity === 'galv' || tB.polarity === 'galv') return '#ffd166';
    if (tA.polarity === 'pos' && tB.polarity === 'pos') return '#ff5964';
    if (tA.polarity === 'neg' && tB.polarity === 'neg') return '#4a5568';
    return '#ff9f1c';
  }

  function drawPixelBox(ctx, x, y, w, h, fill, border = '#ffffff', borderW = 2) {
    ctx.fillStyle = fill;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
    if (border && borderW > 0) {
      ctx.strokeStyle = border;
      ctx.lineWidth = borderW;
      ctx.strokeRect(Math.floor(x) + 1, Math.floor(y) + 1, Math.floor(w) - 2, Math.floor(h) - 2);
    }
  }

  // ===========================================================================
  // SECUENCIA DE FASES Y DIÁLOGOS DE LA MISIÓN 1
  // ===========================================================================
  function showIntro() {
    st.phase = 'intro';
    app.setDialog(
      'jtp',
      'mate',
      '«¡Te damos la bienvenida a la Mesada 1: El Desafío de Poggendorff! Por las barbas de Faraday, hoy vamos a medir la FEM de la Pila de Daniell en condiciones de estricta reversibilidad termodinámica mediante el Método de Oposición, sin conectar un voltímetro común.»',
      [
        {
          label: '🔌 ¿Por qué no usamos un multímetro digital común y listo?',
          onClick: () => {
            app.setDialog(
              'jtp',
              'explicando',
              '«¡Por el principio de Le Chatelier, ni se te ocurra! Si conectás un voltímetro común, hacés circular corriente. Eso genera gradientes de concentración en los electrodos, sobrepotenciales y calor, alejando a la pila del equilibrio termodinámico. Por oposición, en cambio, aplicamos un potencial idéntico y en sentido contrario hasta que el galvanómetro marca corriente CERO (i₀ = 0). Recién en esa condición se cumple con total rigor que ΔG = -nFE_pila.»',
              [
                {
                  label: '🧫 ¡Clarísimo! Armemos la celda en la Caja de Petri',
                  onClick: startCellPrep
                }
              ]
            );
          }
        },
        {
          label: '⚖️ Claro, necesitamos corriente neta cero (i₀ = 0) para medir en equilibrio',
          onClick: () => {
            app.setDialog(
              'jtp',
              'feliz',
              '«¡Exactamente! Qué gusto da cuando leen la guía con anticipación. Corriente neta cero significa reversibilidad termodinámica estricta: no hay paso apreciable de carga, no hay caída óhmica interna y medimos la FEM pura en equilibrio. ¡Vamos a preparar los electrodos y el puente salino!»',
              [
                {
                  label: '🧫 Preparar Electrodos y Caja de Petri (KCl sat.)',
                  onClick: startCellPrep
                }
              ]
            );
          }
        }
      ]
    );
  }

  function startCellPrep() {
    st.phase = 'cell_prep';
    st.electrodesSanded = false;
    st.sheathBubbleCleared = false;
    app.updateHud();

    const oxideOpts = [
      {
        label: '🪨 Pasarles lija fina a los alambres de Zn y Cu hasta dejarlos con brillo metálico',
        onClick: () => {
          st.electrodesSanded = true;
          window.AudioEngine.playSandScratch();
          showBubbleStep();
        }
      },
      {
        label: '🤷 Mandarlos así nomás, total los iones pasan igual',
        onClick: () => {
          window.AudioEngine.playError();
          app.setDialog(
            'jtp',
            'alerta',
            '«¡Por las barbas de Faraday, de ninguna manera! Si dejás esa película pasivante de óxido, el potencial de interfase metal/solución va a ser totalmente inestable. ¡Hay que pasarle lija fina hasta dejar el metal con brillo vivo!»',
            oxideOpts
          );
        }
      }
    ];

    app.setDialog(
      'jtp',
      'serio',
      '«Acá tenemos la caja de Petri con solución saturada de KCl (nuestro puente salino). Pero observemos ese alambre de Zinc: tiene una capa superficial opaca de óxido y carbonato básico que debemos retirar antes de medir.»',
      oxideOpts
    );
  }

  function showBubbleStep() {
    const bubbleOpts = [
      {
        label: '👌 Darle un toquecito suave con el dedo a la vaina para que la burbuja suba',
        onClick: () => {
          st.sheathBubbleCleared = true;
          window.AudioEngine.playFanfare();
          app.setDialog(
            'jtp',
            'feliz',
            '«¡Excelente! Pase libre para la migración de los iones K⁺ y Cl⁻. El puente salino hace contacto franco y sin resistencia parásita. Ahora pasemos a los cables del circuito.»',
            [
              {
                label: '🔌 Pasar al Banco del Potenciómetro (Conectar Circuito)',
                onClick: startCircuitPhase
              }
            ]
          );
        }
      },
      {
        label: '🌬️ Soplar la caja de Petri con ganas',
        onClick: () => {
          window.AudioEngine.playError();
          app.setDialog(
            'jtp',
            'alerta',
            '«¡Cuidado! No soplamos las cajas de Petri porque salpicamos solución por toda la mesada. Basta con un toquecito suave a la vaina de vidrio y la burbuja sube sola.»',
            bubbleOpts
          );
        }
      }
    ];

    app.setDialog(
      'ayudante',
      'normal',
      '«¡Los electrodos quedaron impecables! Sumergiste las vainas en la caja de Petri con KCl saturado... Pero atención: en la punta capilar inferior quedó atrapada una burbuja de aire cortando el contacto electrolítico.»',
      bubbleOpts
    );
  }

  function startCircuitPhase() {
    st.phase = 'circuit';
    st.wires = [];
    st.selectedTerminal = null;
    st.circuitAttempts = 0;
    st.circuitComplete = false;
    app.updateHud();

    app.setDialog(
      'jtp',
      'explicando',
      '«Hacé clic en un borne y luego en otro para tender los 6 cables banana: 1) Fuente CC (+/-) a Alim (+/-). 2) Galvanómetro (+/-) a Galv (+/-). 3) ¡Mucha atención con la Pila!: Cátodo (+) con Pila (+) y Ánodo (-) con Pila (-) para que las fuerzas electromotrices actúen en OPOSICIÓN.»',
      getCircuitButtons()
    );
  }

  function getCircuitButtons() {
    const btns = [
      {
        label: '⚡ Verificar Conexiones del Circuito',
        className: 'rpg-btn-accent',
        onClick: checkCircuitConnections
      },
      {
        label: '🧹 Desconectar Todos los Cables',
        onClick: () => {
          st.wires = [];
          st.selectedTerminal = null;
          app.updateHud();
        }
      }
    ];

    if (st.circuitAttempts >= 3) {
      btns.push({
        label: '🛠️ Armado Asistido por el JTP (Auto-Conectar)',
        className: 'rpg-btn-accent',
        onClick: () => {
          st.selectedTerminal = null;
          st.wires = CORRECT_PAIRS.map(p => ({
            from: p[0],
            to: p[1],
            color: wireColor(getTerm(p[0]), getTerm(p[1]))
          }));
          st.circuitComplete = true;
          app.updateHud();
          window.AudioEngine.playFanfare();
          app.setDialog(
            'jtp',
            'feliz',
            '«¡Circuito completado con éxito! Quedaron los 6 cables conectados en oposición perfecta. Ahora vamos a calibrar los 10.0 mA de la malla principal con la Pila Patrón de Weston.»',
            [
              {
                label: '⚖️ Pasar a la Calibración con la Pila de Weston',
                className: 'rpg-btn-accent',
                onClick: startWestonPhase
              }
            ]
          );
        }
      });
    }
    return btns;
  }

  function validateCircuit() {
    if (st.wires.length < 6) {
      return {
        ok: false,
        reason: `«Todavía te faltan cables por conectar (${st.wires.length}/6 conectados). Recordá unir la Fuente CC, la Celda en oposición y el Galvanómetro.»`
      };
    }
    if (hasConn('cell_pos', 'pot_pila_neg') || hasConn('cell_neg', 'pot_pila_pos')) {
      return {
        ok: false,
        reason: '«¡Atención con la polaridad! Conectaste el positivo de la pila al negativo del potenciómetro. De esa forma los voltajes no se oponen, sino que se suman en serie. Conectá Cátodo (+) con Pila (+) y Ánodo (-) con Pila (-).»'
      };
    }
    if (hasConn('src_pos', 'pot_alim_neg') || hasConn('src_neg', 'pot_alim_pos')) {
      return {
        ok: false,
        reason: '«¡Ojo en la Malla I! Conectaste la Fuente Auxiliar CC con la polaridad invertida respecto a Alim (+) y Alim (-).»'
      };
    }
    const alimOk = hasConn('src_pos', 'pot_alim_pos') && hasConn('src_neg', 'pot_alim_neg');
    const pilaOk = hasConn('cell_pos', 'pot_pila_pos') && hasConn('cell_neg', 'pot_pila_neg');
    const galvOk =
      (hasConn('galv_pos', 'pot_galv_pos') && hasConn('galv_neg', 'pot_galv_neg')) ||
      (hasConn('galv_pos', 'pot_galv_neg') && hasConn('galv_neg', 'pot_galv_pos'));

    if (!alimOk || !pilaOk || !galvOk) {
      return {
        ok: false,
        reason: '«Hay cables cruzados entre mallas distintas. Revisá que Fuente vaya a Alim, Celda a Pila y Galvanómetro a Galv.»'
      };
    }
    return { ok: true };
  }

  function checkCircuitConnections() {
    const res = validateCircuit();
    if (res.ok) {
      st.circuitComplete = true;
      app.updateHud();
      window.AudioEngine.playFanfare();
      app.setDialog(
        'jtp',
        'feliz',
        '«¡Impecable! Por las leyes de Kirchhoff, el conexionado en oposición está perfecto y el galvanómetro en serie listo para detectar corriente nula. Ahora vamos a calibrar la corriente con la Pila Patrón de Weston.»',
        [
          {
            label: '⚖️ Pasar a la Calibración con la Pila Patrón de Weston',
            className: 'rpg-btn-accent',
            onClick: startWestonPhase
          }
        ]
      );
    } else {
      st.circuitAttempts++;
      window.AudioEngine.playError();
      if (st.circuitAttempts >= 3) {
        app.setDialog(
          'jtp',
          'mate',
          res.reason +
            ' «No hay problema, a cualquiera le pasa en las primeras prácticas de conexionado. Podés seguir intentando con tranquilidad, o si preferís avanzar, tenés disponible el botón de asistencia para completar el cableado automáticamente.»',
          getCircuitButtons()
        );
      } else {
        const left = 3 - st.circuitAttempts;
        app.setDialog(
          'jtp',
          'alerta',
          `${res.reason} (Intentos restantes antes de habilitar asistencia: ${left})`,
          getCircuitButtons()
        );
      }
    }
  }

  function startWestonPhase() {
    st.phase = 'weston';
    st.rCalOhms = 43.0;
    st.westonCalibrated = false;
    st.pulsePressed = false;
    app.updateHud();

    app.setDialog(
      'jtp',
      'explicando',
      '«Para que los diales de R₁ y R₂ lean voltios directamente, necesitamos que por la malla principal circulen exactamente 10.0 mA. Clavamos los diales en la FEM de la Weston a 20 °C (1.0186 V). Mové R_cal (con botones o mouse) y tocá el pulsador P hasta que la aguja permanezca en cero.»',
      getWestonButtons()
    );
  }

  function adjustRCal(delta) {
    if (st.phase !== 'weston' || st.westonCalibrated) return;
    st.rCalOhms = Math.max(30.0, Math.min(70.0, Number((st.rCalOhms + delta).toFixed(1))));
    st.pulsePressed = true;
    window.AudioEngine.playDialTick(Math.abs(delta) < 1.0);
  }

  function getWestonButtons() {
    return [
      { label: '◀◀ R_cal -2.0 Ω', onClick: () => adjustRCal(-2.0) },
      { label: '◀ R_cal -0.5 Ω', onClick: () => adjustRCal(-0.5) },
      { label: '▶ R_cal +0.5 Ω', onClick: () => adjustRCal(0.5) },
      { label: '▶▶ R_cal +2.0 Ω', onClick: () => adjustRCal(2.0) },
      {
        label: '👆 Pulsador P y Confirmar Calibración (10.0 mA)',
        className: 'rpg-btn-accent',
        onClick: checkWestonCalibration
      },
      {
        label: '🤔 ¿Por qué deben circular exactamente 10.0 mA y no otro valor?',
        onClick: () => {
          app.setDialog(
            'jtp',
            'explicando',
            '«¡Una deducción impecable de la ley de Ohm! Fijate en la arquitectura interna: el dial R₁ tiene 15 resistencias fijas en serie de 10 Ω cada una, y R₂ es una resistencia continua de 0 a 10 Ω. Según la ley de Ohm (ΔV = i · R), si circulan exactamente i = 10 mA = 0.010 A, cada resistencia de 10 Ω genera una caída de ΔV = 0.010 A × 10 Ω = 0.100 V. ¡Por el ingenio de Poggendorff, cada paso de R₁ pasa a leer directamente 0.1 V y R₂ cubre de 0.000 a 0.100 V sin hacer conversiones matemáticas!»',
            getWestonButtons()
          );
        }
      }
    ];
  }

  function checkWestonCalibration() {
    st.pulsePressed = true;
    if (Math.abs(st.rCalOhms - 50.0) <= 0.3) {
      st.rCalOhms = 50.0;
      st.westonCalibrated = true;
      app.updateHud();
      window.AudioEngine.playFanfare();
      app.setDialog(
        'jtp',
        'feliz',
        '«¡Al pulsar P la aguja queda en cero como una estatua! Corriente de 10.0 mA fijada con éxito en la Malla I. De acá en más, ¡no se toca más R_cal! Pasamos la llave selectora a posición PILA y comenzamos las mediciones de las 5 celdas.»',
        [
          {
            label: '🔋 Arrancar Medición Manual de las 5 Pilas (Pila 1 a 5)',
            className: 'rpg-btn-accent',
            onClick: () => startMeasurePila(0)
          }
        ]
      );
    } else {
      window.AudioEngine.playPulseKey(false);
      app.setDialog(
        'jtp',
        'alerta',
        '«Todavía circula corriente por el galvanómetro (i₀ ≠ 0). Observá para qué lado deflexiona la aguja y ajustá R_cal hasta llegar a 50.0 Ω (10.00 mA).»',
        getWestonButtons()
      );
    }
  }

  function startMeasurePila(idx) {
    st.phase = 'measure';
    st.currentPilaIndex = idx;
    st.pulsePressed = false;
    st.activeDial = 'R1';

    if (idx === 0) {
      st.dialR1 = 0.8;
      st.dialR2 = 0.020;
    } else if (idx === 1) {
      st.dialR1 = 0.2;
      st.dialR2 = 0.015;
    } else {
      st.dialR1 = 0.9;
      st.dialR2 = 0.030;
    }

    const pila = PILAS[idx];
    app.setDialog(
      'jtp',
      'explicando',
      `«Midiendo ${pila.name}. Ajustá el dial grueso R₁ (pasos de 0.1 V) y el dial fino R₂ (0.000 a 0.100 V) con los botones, haciendo clic/arrastrando o girando la rueda del mouse sobre cada dial. Clavá la lectura cuando el galvanómetro marque CERO (i₀ = 0).»`,
      getMeasureButtons()
    );
  }

  function adjustDialR1(deltaV) {
    if (st.phase !== 'measure') return;
    st.activeDial = 'R1';
    st.dialR1 = Math.max(0.0, Math.min(1.5, Number((st.dialR1 + deltaV).toFixed(1))));
    st.pulsePressed = true;
    window.AudioEngine.playDialTick(false);
  }

  function adjustDialR2(deltaV) {
    if (st.phase !== 'measure') return;
    st.activeDial = 'R2';
    st.dialR2 = Math.max(0.0, Math.min(0.100, Number((st.dialR2 + deltaV).toFixed(3))));
    st.pulsePressed = true;
    window.AudioEngine.playDialTick(true);
  }

  function getMeasureButtons() {
    const pila = PILAS[st.currentPilaIndex];
    return [
      { label: 'R₁ -0.1 V', onClick: () => adjustDialR1(-0.1) },
      { label: 'R₁ +0.1 V', onClick: () => adjustDialR1(0.1) },
      { label: 'R₂ -0.010 V', onClick: () => adjustDialR2(-0.010) },
      { label: 'R₂ -0.001 V', onClick: () => adjustDialR2(-0.001) },
      { label: 'R₂ +0.001 V', onClick: () => adjustDialR2(0.001) },
      { label: 'R₂ +0.010 V', onClick: () => adjustDialR2(0.010) },
      {
        label: `👆 Pulsador P y Clavar FEM de ${pila.code}`,
        className: 'rpg-btn-accent',
        onClick: checkPilaMeasurement
      }
    ];
  }

  function checkPilaMeasurement() {
    st.pulsePressed = true;
    const pila = PILAS[st.currentPilaIndex];
    const totalV = Number((st.dialR1 + st.dialR2).toFixed(3));
    const diffV = totalV - pila.targetEmf;

    if (Math.abs(diffV) <= 0.0015) {
      st.measuredEmfs[pila.id] = totalV;
      app.updateHud();
      window.AudioEngine.playFanfare();

      let msg = '';
      if (pila.id === 1) {
        msg = `«¡Anotá en la libreta: E₁ = ${totalV.toFixed(3)} V! El electrodo de calomel saturado (ECS) actúa acá como cátodo (+0.2445 V a 20 °C) frente al Zinc. Con esto después vas a poder despejar el potencial individual del electrodo de Zinc. ¡Cambiemos los electrodos para la Pila 2!»`;
      } else if (pila.id === 2) {
        msg = `«¡Clavado en E₂ = ${totalV.toFixed(3)} V! Dio bajo (con R₁ = 0.0 V) porque el calomel y el cobre tienen potenciales bastante cercanos. Ahora observemos con atención: se viene la Pila 3, la Daniell completa con las mismas concentraciones.»`;
      } else if (pila.id === 3) {
        const sum12 = (st.measuredEmfs[1] + st.measuredEmfs[2]).toFixed(3);
        msg = `«¡Momento cumbre de la experiencia! E₁ = ${st.measuredEmfs[1].toFixed(3)} V, E₂ = ${st.measuredEmfs[2].toFixed(3)} V, y la suma da E₁ + E₂ = ${sum12} V ≡ E₃ (${totalV.toFixed(3)} V). ¡Por la energía libre de Gibbs, el principio de ADITIVIDAD de potenciales se verifica experimentalmente en la mesada! Vamos con la serie de dilución en la Pila 4.»`;
      } else if (pila.id === 4) {
        msg = `«¡E₄ = ${totalV.toFixed(3)} V registrado! Al reducir la concentración de Cu²⁺ de 0.1 M a 0.01 M, el potencial disminuye exactamente como predice la ecuación de Nernst: menor actividad de reactivo catódico, menor fuerza impulsora termodinámica. ¡Vamos por la quinta y última!»`;
      } else {
        msg = `«¡E₅ = ${totalV.toFixed(3)} V! ¡Determinación completada con gran pulso y precisión! Ya tenemos las 5 medidas requeridas para trazar la recta de Nernst y verificar la aditividad en pantalla.»`;
      }

      const nextIdx = st.currentPilaIndex + 1;
      if (nextIdx < 5) {
        const nextP = PILAS[nextIdx];
        app.setDialog('jtp', 'feliz', msg, [
          {
            label: `🔋 Pasar a Medir ${nextP.code}: ${nextP.name}`,
            className: 'rpg-btn-accent',
            onClick: () => startMeasurePila(nextIdx)
          }
        ]);
      } else {
        app.setDialog('jtp', 'feliz', msg, [
          {
            label: '📈 Ver Gráficos de Nernst y Aditividad y Exportar (.txt)',
            className: 'rpg-btn-accent',
            onClick: startFinalPhase
          }
        ]);
      }
    } else {
      window.AudioEngine.playPulseKey(false);
      const dir = diffV < 0 ? 'izquierda (falta potencial en los diales)' : 'derecha (te pasaste de potencial)';
      app.setDialog(
        'jtp',
        'alerta',
        `«Todavía no alcanzamos el equilibrio: la aguja deflexiona hacia la ${dir}. Ajustá R₁ y R₂ hasta que al pulsar P el galvanómetro marque i₀ = 0.»`,
        getMeasureButtons()
      );
    }
  }

  function startFinalPhase() {
    st.phase = 'final';
    st.graphMode = 'nernst';
    app.setDialog(
      'jtp',
      'feliz',
      '«Ahí están los gráficos de verificación en pantalla. En el archivo descargable (.txt) te llevás los datos crudos de potencial y concentración para que en tu informe calcules las actividades con los coeficientes γ± y la pendiente de Nernst. ¡Sellá tu Libreta Universitaria para volver al Hall Principal!»',
      getFinalButtons()
    );
  }

  function getFinalButtons() {
    const isNernst = st.graphMode === 'nernst';
    const e1 = st.measuredEmfs[1] || 1.055;
    const e2 = st.measuredEmfs[2] || 0.046;
    const e3 = st.measuredEmfs[3] || 1.101;
    const summaryStr = `E₁=${e1.toFixed(3)}V, E₂=${e2.toFixed(3)}V, E₃=${e3.toFixed(3)}V (Aditividad y Serie Nernst OK)`;

    return [
      {
        label: '💾 1. Descargar Datos Crudos (.txt)',
        className: 'rpg-btn-accent',
        onClick: downloadRawTxt
      },
      {
        label: isNernst
          ? '📊 Cambiar a Gráfico de Aditividad (E₁ + E₂ vs E₃)'
          : '📈 Cambiar a Gráfico de Nernst: E_pila vs ln(a_Zn²⁺ / a_Cu²⁺)',
        onClick: () => {
          st.graphMode = isNernst ? 'additivity' : 'nernst';
          app.renderOptions(getFinalButtons());
        }
      },
      {
        label: '🪪 2. ¡Sellar TP 1 en mi Libreta y Volver al Hall Principal!',
        className: 'rpg-btn-accent',
        onClick: () => {
          app.completeMissionAndReturn('tp1_daniell', summaryStr);
        }
      }
    ];
  }

  function downloadRawTxt() {
    const pad = (s, n) => (String(s).length >= n ? String(s) : String(s) + ' '.repeat(n - String(s).length));
    const nowStr = new Date().toLocaleString('es-AR');
    const e1 = (st.measuredEmfs[1] || 1.055).toFixed(3);
    const e2 = (st.measuredEmfs[2] || 0.046).toFixed(3);
    const e3 = (st.measuredEmfs[3] || 1.101).toFixed(3);
    const e4 = (st.measuredEmfs[4] || 1.084).toFixed(3);
    const e5 = (st.measuredEmfs[5] || 1.062).toFixed(3);

    const lines = [
      '================================================================================',
      'LABORATORIO DE FISICOQUÍMICA - POTENCIOMETRÍA Y PILA DE DANIELL',
      'Trabajo Práctico Nº 1: Medida de FEM por el Método de Oposición',
      '================================================================================',
      `Fecha de registro:                                 ${nowStr}`,
      'Método experimental:                               Oposición de Poggendorff (i_0 = 0)',
      `Temperatura de trabajo (T):                        ${PARAMS.temperatureC.toFixed(1)} °C (${PARAMS.temperatureK.toFixed(2)} K)`,
      `Potencial del Electrodo de Calomel Saturado (ECS): +${PARAMS.eCalomel20C.toFixed(4)} V vs ENH`,
      `Pila Patrón empleada para calibración (10.0 mA):   Weston Normal (E = ${PARAMS.eWeston.toFixed(4)} V)`,
      '================================================================================',
      'TABLA II: MEDIDAS CON ELECTRODO DE CALOMEL SATURADO (DATOS CRUDOS)',
      pad('Pila', 46) + pad('Cátodo (+)', 14) + pad('Ánodo (-)', 12) + 'E_pila / V',
      '--------------------------------------------------------------------------------',
      pad('Pila 1: Zn/ZnSO4(0.1M) // KCl(sat) // ECS', 46) + pad('ECS', 14) + pad('Zn', 12) + e1,
      pad('Pila 2: ECS // KCl(sat) // CuSO4(0.1M)/Cu', 46) + pad('Cu', 14) + pad('ECS', 12) + e2,
      pad('Pila 3: Zn/ZnSO4(0.1M) // CuSO4(0.1M)/Cu', 46) + pad('Cu', 14) + pad('Zn', 12) + e3,
      '================================================================================',
      'TABLA III: MEDIDAS DE LAS PILAS DE DANIELL DE DISTINTA CONCENTRACIÓN',
      pad('Pila', 14) + pad('[Zn2+] / M', 18) + pad('[Cu2+] / M', 18) + 'E_pila / V',
      '--------------------------------------------------------------------------------',
      pad('Pila 3', 14) + pad('0.100', 18) + pad('0.100', 18) + e3,
      pad('Pila 4', 14) + pad('0.100', 18) + pad('0.010', 18) + e4,
      pad('Pila 5', 14) + pad('0.100', 18) + pad('0.001', 18) + e5,
      '================================================================================'
    ];

    const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'datos_TP1_pila_daniell_oposicion.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // ===========================================================================
  // RENDERIZADO GRÁFICO DE LA MISIÓN 1
  // ===========================================================================
  function drawRotaryDial(ctx, cx, cy, r, valueRatio, title, valueText, accentColor, isActive) {
    ctx.save();
    if (isActive) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + 9, 0, Math.PI * 2);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#1b1f2d';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = isActive ? accentColor : '#c89d54';
    ctx.stroke();

    // Botones visuales [-] y [+] laterales
    ctx.fillStyle = '#262f47';
    ctx.fillRect(cx - r - 24, cy - 11, 18, 22);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - r - 24, cy - 11, 18, 22);

    ctx.fillRect(cx + r + 6, cy - 11, 18, 22);
    ctx.strokeRect(cx + r + 6, cy - 11, 18, 22);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('-', cx - r - 15, cy);
    ctx.fillText('+', cx + r + 15, cy);
    ctx.textBaseline = 'alphabetic';

    for (let i = 0; i <= 10; i++) {
      const frac = i / 10;
      const ang = ((-135 + frac * 270) - 90) * (Math.PI / 180);
      const x1 = cx + Math.cos(ang) * (r - 9);
      const y1 = cy + Math.sin(ang) * (r - 9);
      const x2 = cx + Math.cos(ang) * (r - 2);
      const y2 = cy + Math.sin(ang) * (r - 2);
      ctx.strokeStyle = i % 5 === 0 ? '#ffd166' : '#9aa5b1';
      ctx.lineWidth = i % 5 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    const clampedRatio = Math.max(0, Math.min(1, valueRatio));
    const pointerAng = ((-135 + clampedRatio * 270) - 90) * (Math.PI / 180);

    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = '#10141f';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = accentColor;
    ctx.stroke();

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(pointerAng) * (r * 0.58), cy + Math.sin(pointerAng) * (r * 0.58));
    ctx.stroke();

    ctx.fillStyle = '#cbd5e0';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, cx, cy - r - 10);

    ctx.fillStyle = accentColor;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(valueText, cx, cy + r + 18);
    ctx.restore();
  }

  function drawGalvanometer(ctx, cx, cy, w, h, currentDiffVolts, pulseActive) {
    drawPixelBox(ctx, cx - w / 2, cy - h / 2, w, h, '#171c2b', '#ffd166', 2);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GALVANÓMETRO DE CERO (G)', cx, cy - h / 2 + 20);

    const arcCx = cx;
    const arcCy = cy + 22;
    const arcR = 66;

    ctx.beginPath();
    ctx.arc(arcCx, arcCy, arcR, Math.PI, 0);
    ctx.fillStyle = '#0c1018';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#4a5568';
    ctx.stroke();

    for (let s = -5; s <= 5; s++) {
      const ang = -Math.PI / 2 + (s / 5) * (Math.PI * 0.42);
      const x1 = arcCx + Math.cos(ang) * (arcR - (s === 0 ? 14 : 9));
      const y1 = arcCy + Math.sin(ang) * (arcR - (s === 0 ? 14 : 9));
      const x2 = arcCx + Math.cos(ang) * (arcR - 2);
      const y2 = arcCy + Math.sin(ang) * (arcR - 2);
      ctx.strokeStyle = s === 0 ? '#06d6a0' : '#a0aec0';
      ctx.lineWidth = s === 0 ? 2.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.fillStyle = '#06d6a0';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('0', arcCx, arcCy - arcR - 5);
    ctx.fillStyle = '#ff5964';
    ctx.fillText('-', arcCx - arcR + 10, arcCy - 14);
    ctx.fillText('+', arcCx + arcR - 10, arcCy - 14);

    const clampedDiff = Math.max(-0.08, Math.min(0.08, currentDiffVolts));
    const normDeflection = pulseActive ? clampedDiff / 0.08 : 0;
    const needleAng = -Math.PI / 2 + normDeflection * (Math.PI * 0.42);
    const isZero = Math.abs(currentDiffVolts) <= 0.0012;

    ctx.strokeStyle = !pulseActive ? '#9aa5b1' : isZero ? '#06d6a0' : '#ff5964';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(arcCx, arcCy);
    ctx.lineTo(arcCx + Math.cos(needleAng) * (arcR - 6), arcCy + Math.sin(needleAng) * (arcR - 6));
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(arcCx, arcCy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#e5c178';
    ctx.fill();

    const microAmps = pulseActive ? (currentDiffVolts * 250).toFixed(1) : '0.0';
    ctx.font = 'bold 12px monospace';
    if (!pulseActive) {
      ctx.fillStyle = '#a0aec0';
      ctx.fillText('Circuito abierto (Tocá Pulsador P)', cx, cy + h / 2 - 14);
    } else if (isZero) {
      ctx.fillStyle = '#06d6a0';
      ctx.fillText('★ i₀ = 0.0 μA (¡SIN DEFLEXIÓN!) ★', cx, cy + h / 2 - 14);
    } else {
      ctx.fillStyle = '#ff5964';
      const dirTxt = currentDiffVolts < 0 ? '◄ Falta V' : 'Te pasaste ►';
      ctx.fillText(`i₀ ≈ ${microAmps} μA (${dirTxt})`, cx, cy + h / 2 - 14);
    }
  }

  function drawPetriCellAssembly(ctx, cx, cy, electrodesSanded, bubbleCleared) {
    drawPixelBox(ctx, cx - 130, cy + 32, 260, 42, 'rgba(123, 223, 242, 0.22)', '#d8f3dc', 2);
    ctx.fillStyle = 'rgba(123, 223, 242, 0.38)';
    ctx.fillRect(cx - 127, cy + 44, 254, 28);
    ctx.fillStyle = '#7bdff2';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Puente Salino: Caja de Petri con KCl (sat.)', cx, cy + 90);

    drawPixelBox(ctx, cx - 95, cy - 58, 46, 118, 'rgba(220, 240, 255, 0.16)', '#d8f3dc', 2);
    ctx.fillStyle = 'rgba(200, 225, 255, 0.35)';
    ctx.fillRect(cx - 92, cy - 25, 40, 82);

    ctx.strokeStyle = electrodesSanded ? '#e2e8f0' : '#5c5346';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - 72, cy - 75);
    ctx.lineTo(cx - 72, cy + 35);
    ctx.stroke();

    if (!electrodesSanded) {
      ctx.fillStyle = '#6b4f35';
      ctx.fillRect(cx - 76, cy - 45, 8, 65);
      ctx.fillStyle = '#ff9f1c';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('¡Zn Oxidado!', cx - 72, cy - 84);
    } else {
      ctx.fillStyle = '#06d6a0';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('✨ Zn Lijado (-)', cx - 72, cy - 84);
    }

    drawPixelBox(ctx, cx + 49, cy - 58, 46, 118, 'rgba(220, 240, 255, 0.16)', '#d8f3dc', 2);
    ctx.fillStyle = 'rgba(0, 168, 232, 0.48)';
    ctx.fillRect(cx + 52, cy - 25, 40, 82);

    ctx.strokeStyle = electrodesSanded ? '#f4a261' : '#7f4f24';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx + 72, cy - 75);
    ctx.lineTo(cx + 72, cy + 35);
    ctx.stroke();

    ctx.fillStyle = electrodesSanded ? '#ffd166' : '#a0aec0';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(electrodesSanded ? '✨ Cu Brillante (+)' : 'Cu Opaco (+)', cx + 72, cy - 84);

    if (electrodesSanded && !bubbleCleared) {
      ctx.beginPath();
      ctx.arc(cx - 72, cy + 52, 13, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ff5964';
      ctx.stroke();
      ctx.fillStyle = '#ff5964';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('¡Burbuja en la vaina! ►', cx - 102, cy + 56);
      ctx.textAlign = 'center';
    } else if (electrodesSanded && bubbleCleared) {
      ctx.fillStyle = '#06d6a0';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('✓ Contacto iónico perfecto', cx, cy + 12);
    }
  }

  function renderFinalPlots(ctx, w, h) {
    const pts = [2, 3, 4].map(idx => {
      const p = PILAS[idx];
      const eVal = st.measuredEmfs[p.id] || p.targetEmf;
      const aZn = p.znConc * PARAMS.gamma.ZnSO4[String(p.znConc)];
      const aCu = p.cuConc * PARAMS.gamma.CuSO4[String(p.cuConc)];
      return { code: p.code, lnRatio: Math.log(aZn / aCu), emf: eVal };
    });

    const n = pts.length;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    pts.forEach(pt => {
      sx += pt.lnRatio;
      sy += pt.emf;
      sxy += pt.lnRatio * pt.emf;
      sxx += pt.lnRatio * pt.lnRatio;
    });
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    const e0Intercept = (sy - slope * sx) / n;

    const padL = 72, padT = 54, plotW = 400, plotH = 195;

    if (st.graphMode === 'additivity') {
      drawPixelBox(ctx, 16, 10, w - 32, 30, '#1e2436', '#7bdff2', 2);
      ctx.fillStyle = '#7bdff2';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('VISTA PREVIA ADITIVIDAD (TABLA II): (E₁ + E₂) vs E₃', w / 2, 29);

      drawPixelBox(ctx, padL, padT, plotW, plotH, '#0c101a', '#4a5568', 2);
      const e1 = st.measuredEmfs[1] || 1.055;
      const e2 = st.measuredEmfs[2] || 0.046;
      const e3 = st.measuredEmfs[3] || 1.101;
      const toH = v => (v / 1.25) * (plotH - 30);
      const baseY = padT + plotH - 22;

      const b1X = padL + 85, barW = 85;
      const h1 = toH(e1), h2 = toH(e2);
      ctx.fillStyle = '#06d6a0';
      ctx.fillRect(b1X, baseY - h1, barW, h1);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(b1X, baseY - h1 - h2, barW, h2);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`E₁ + E₂ = ${(e1 + e2).toFixed(3)} V`, b1X + barW / 2, baseY - h1 - h2 - 8);
      ctx.fillStyle = '#cbd5e0';
      ctx.fillText('Suma Pila 1 + Pila 2', b1X + barW / 2, baseY + 15);

      const b2X = padL + 235, h3 = toH(e3);
      ctx.fillStyle = '#7bdff2';
      ctx.fillRect(b2X, baseY - h3, barW, h3);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`E₃ = ${e3.toFixed(3)} V`, b2X + barW / 2, baseY - h3 - 8);
      ctx.fillStyle = '#cbd5e0';
      ctx.fillText('Pila 3 (Daniell directa)', b2X + barW / 2, baseY + 15);
    } else {
      drawPixelBox(ctx, 16, 10, w - 32, 30, '#1e2436', '#06d6a0', 2);
      ctx.fillStyle = '#06d6a0';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('VISTA PREVIA RECTA DE NERNST: E_pila vs ln(a_Zn²⁺ / a_Cu²⁺)', w / 2, 29);

      drawPixelBox(ctx, padL, padT, plotW, plotH, '#0c101a', '#4a5568', 2);
      const minX = -0.3, maxX = 3.5, minY = 1.050, maxY = 1.115;
      const toX = xVal => padL + ((xVal - minX) / (maxX - minX)) * plotW;
      const toY = yVal => padT + ((maxY - yVal) / (maxY - minY)) * plotH;

      ctx.strokeStyle = '#ff5964';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(toX(minX), toY(slope * minX + e0Intercept));
      ctx.lineTo(toX(maxX), toY(slope * maxX + e0Intercept));
      ctx.stroke();

      pts.forEach(pt => {
        const px = toX(pt.lnRatio), py = toY(pt.emf);
        ctx.fillStyle = '#7bdff2';
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${pt.code} (${pt.emf.toFixed(3)}V)`, px + 8, py - 5);
      });

      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ln(a_Zn²⁺ / a_Cu²⁺)', padL + plotW / 2, padT + plotH + 22);
    }

    // Caja de resumen lateral
    const boxX = padL + plotW + 18, boxW = w - boxX - 16;
    drawPixelBox(ctx, boxX, padT, boxW, plotH, '#181e2c', '#ffd166', 2);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('POTENCIALES MEDIDOS:', boxX + 12, padT + 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px monospace';
    for (let i = 1; i <= 5; i++) {
      ctx.fillText(`• Pila ${i}: ${(st.measuredEmfs[i] || PILAS[i - 1].targetEmf).toFixed(3)} V`, boxX + 12, padT + 26 + i * 19);
    }
    ctx.fillStyle = '#06d6a0';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`• E° (ord.) ≈ ${e0Intercept.toFixed(3)} V`, boxX + 12, padT + 152);
    ctx.fillStyle = '#7bdff2';
    ctx.fillText('• Método: Oposición (i₀=0)', boxX + 12, padT + 174);
  }

  return {
    start: function (appCallbacks) {
      app = appCallbacks;
      st.electrodesSanded = false;
      st.sheathBubbleCleared = false;
      st.wires = [];
      st.selectedTerminal = null;
      st.circuitAttempts = 0;
      st.circuitComplete = false;
      st.westonCalibrated = false;
      st.measuredEmfs = {};
      showIntro();
    },

    render: function (canvas) {
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = '#131722';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 38) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 38) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      if (st.phase === 'intro') {
        drawPixelBox(ctx, 20, 12, w - 40, 32, '#1e2436', '#ffd166', 2);
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('★ MISIÓN 1: MEDIDA DE LA FEM DE LA PILA DE DANIELL POR OPOSICIÓN ★', w / 2, 33);
        drawPetriCellAssembly(ctx, 200, 155, true, true);
        drawPixelBox(ctx, 415, 72, 310, 185, '#241c18', '#c89d54', 3);
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 13px monospace';
        ctx.fillText('POTENCIÓMETRO DE POGGENDORFF', 570, 98);
        ctx.fillStyle = '#06d6a0';
        ctx.font = '12px monospace';
        ctx.fillText('Condición Reversible: i₀ = 0', 570, 126);
        ctx.fillStyle = '#7bdff2';
        ctx.fillText('ΔG = w_eléc^rev = -n · F · E_pila', 570, 152);
        ctx.fillStyle = '#cbd5e0';
        ctx.font = '11px monospace';
        ctx.fillText('• Pila Patrón: Weston (1.0186 V)', 570, 184);
        ctx.fillText('• Referencia: ECS (+0.2445 V)', 570, 206);
        ctx.fillText('• Temperatura: 20.0 °C', 570, 228);
      } else if (st.phase === 'cell_prep') {
        drawPixelBox(ctx, 20, 10, w - 40, 30, '#1e2436', '#7bdff2', 2);
        ctx.fillStyle = '#7bdff2';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PASO 1: PREPARACIÓN DE ELECTRODOS Y PUENTE SALINO (KCl sat.)', w / 2, 29);
        drawPetriCellAssembly(ctx, w / 2, 155, st.electrodesSanded, st.sheathBubbleCleared);
      } else if (st.phase === 'circuit') {
        drawPixelBox(ctx, 16, 8, w - 32, 28, '#1e2436', '#ffd166', 2);
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        const selTxt = st.selectedTerminal
          ? `BORNE SELECCIONADO: [${getTerm(st.selectedTerminal).label}] ➔ Tocá otro borne`
          : `CONEXIÓN DEL CIRCUITO DE OPOSICIÓN — Cables: ${st.wires.length}/6 (Fallos: ${st.circuitAttempts}/3)`;
        ctx.fillText(selTxt, w / 2, 26);

        drawPixelBox(ctx, 24, 46, 180, 102, '#1a2133', '#7bdff2', 2);
        ctx.fillStyle = '#7bdff2';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('FUENTE AUXILIAR CC', 114, 65);

        drawPixelBox(ctx, 24, 160, 180, 114, '#1a2133', '#06d6a0', 2);
        ctx.fillStyle = '#06d6a0';
        ctx.fillText('CELDA / PILA (E_pila)', 114, 180);

        drawPixelBox(ctx, 238, 46, 286, 228, '#241c18', '#c89d54', 3);
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('POTENCIÓMETRO (160 Ω)', 381, 68);
        ctx.fillStyle = '#cbd5e0';
        ctx.font = '10px monospace';
        ctx.fillText('Bornes Pila            Bornes Galv', 390, 184);

        drawPixelBox(ctx, 556, 74, 180, 200, '#1a2133', '#ffd166', 2);
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('GALVANÓMETRO (G)', 646, 98);

        st.wires.forEach(wire => {
          const tA = getTerm(wire.from), tB = getTerm(wire.to);
          if (!tA || !tB) return;
          ctx.save();
          ctx.strokeStyle = wire.color;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(tA.x, tA.y);
          ctx.quadraticCurveTo((tA.x + tB.x) / 2, (tA.y + tB.y) / 2 - 18, tB.x, tB.y);
          ctx.stroke();
          ctx.restore();
        });

        TERMINALS.forEach(t => {
          const isSel = st.selectedTerminal === t.id;
          const isW = st.wires.some(wire => wire.from === t.id || wire.to === t.id);
          ctx.save();
          if (isSel) {
            ctx.beginPath();
            ctx.arc(t.x, t.y, 17, 0, Math.PI * 2);
            ctx.strokeStyle = '#06d6a0';
            ctx.lineWidth = 3;
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(t.x, t.y, 12, 0, Math.PI * 2);
          ctx.fillStyle = t.polarity === 'pos' ? '#d90429' : t.polarity === 'neg' ? '#2b2d42' : '#d4a373';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = isW ? '#06d6a0' : '#f1faee';
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(t.short, t.x, t.y);
          ctx.fillStyle = '#cbd5e0';
          ctx.font = '9px monospace';
          ctx.fillText(t.label, t.x, t.y + 21);
          ctx.restore();
        });
      } else if (st.phase === 'weston') {
        drawPixelBox(ctx, 16, 10, w - 32, 30, '#1e2436', '#ffd166', 2);
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PASO 3: CALIBRACIÓN DE CORRIENTE (10.0 mA) CON PILA DE WESTON (1.0186 V)', w / 2, 29);

        drawPixelBox(ctx, 20, 52, 225, 220, '#181e2c', '#7bdff2', 2);
        drawRotaryDial(ctx, 132, 135, 46, (st.rCalOhms - 30) / 40, 'REÓSTATO R_cal', `${st.rCalOhms.toFixed(1)} Ω`, '#7bdff2', true);
        const currentMa = 10.0 * (50.0 / st.rCalOhms);
        ctx.fillStyle = Math.abs(st.rCalOhms - 50.0) <= 0.3 ? '#06d6a0' : '#ff9f1c';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Corriente Malla I: ${currentMa.toFixed(2)} mA`, 132, 226);

        drawPixelBox(ctx, 260, 52, 205, 220, '#241c18', '#c89d54', 2);
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('LLAVE S: [PILA WESTON]', 362, 82);
        ctx.fillStyle = '#06d6a0';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('V_pot = 1.0186 V', 362, 145);
        ctx.fillStyle = '#cbd5e0';
        ctx.font = '11px monospace';
        ctx.fillText('R₁ = 1.0 V | R₂ = 0.0186 V', 362, 185);

        drawGalvanometer(ctx, 612, 162, 265, 220, (50.0 - st.rCalOhms) * 0.004, st.pulsePressed);
      } else if (st.phase === 'measure') {
        const pila = PILAS[st.currentPilaIndex];
        drawPixelBox(ctx, 16, 8, w - 32, 42, '#1e2436', '#06d6a0', 2);
        ctx.fillStyle = '#06d6a0';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`MIDIENDO [${pila.code} de 5]: ${pila.name}`, w / 2, 24);
        ctx.fillStyle = '#ffd166';
        ctx.font = '11px monospace';
        ctx.fillText(`Diagrama IUPAC: ${pila.iupac}`, w / 2, 42);

        drawPixelBox(ctx, 16, 58, 438, 220, '#241c18', '#c89d54', 2);
        drawRotaryDial(ctx, 122, 142, 44, st.dialR1 / 1.5, 'DIAL R₁ (Pasos 0.1 V)', `${st.dialR1.toFixed(1)} V`, '#ffd166', st.activeDial === 'R1');
        drawRotaryDial(ctx, 338, 142, 44, st.dialR2 / 0.1, 'DIAL R₂ (Continuo 0-0.1 V)', `${st.dialR2.toFixed(3)} V`, '#7bdff2', st.activeDial === 'R2');

        const totalPotV = Number((st.dialR1 + st.dialR2).toFixed(3));
        drawPixelBox(ctx, 65, 222, 340, 42, '#141824', '#06d6a0', 2);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`LECTURA R₁ + R₂ = ${totalPotV.toFixed(3)} V`, 235, 248);

        drawGalvanometer(ctx, 606, 168, 275, 220, totalPotV - pila.targetEmf, st.pulsePressed);
      } else if (st.phase === 'final') {
        renderFinalPlots(ctx, w, h);
      }
    },

    onCanvasMouseDown: function (pt) {
      if (st.phase === 'measure') {
        if (pt.x >= 35 && pt.x <= 215 && pt.y >= 75 && pt.y <= 215) {
          st.activeDial = 'R1';
          st.dragDial = 'R1';
          st.dragStartX = pt.x;
          st.dragMoved = false;
        } else if (pt.x >= 250 && pt.x <= 430 && pt.y >= 75 && pt.y <= 215) {
          st.activeDial = 'R2';
          st.dragDial = 'R2';
          st.dragStartX = pt.x;
          st.dragMoved = false;
        }
      } else if (st.phase === 'weston' && !st.westonCalibrated) {
        if (pt.x >= 45 && pt.x <= 220 && pt.y >= 65 && pt.y <= 205) {
          st.dragDial = 'Rcal';
          st.dragStartX = pt.x;
          st.dragMoved = false;
        }
      }
    },

    onMouseMove: function (pt) {
      if (!st.dragDial) return;
      const dx = pt.x - st.dragStartX;
      if (st.dragDial === 'R1' && Math.abs(dx) >= 14) {
        const steps = Math.trunc(dx / 14);
        adjustDialR1(steps * 0.1);
        st.dragStartX += steps * 14;
        st.dragMoved = true;
      } else if (st.dragDial === 'R2' && Math.abs(dx) >= 6) {
        const steps = Math.trunc(dx / 6);
        adjustDialR2(steps * 0.001);
        st.dragStartX += steps * 6;
        st.dragMoved = true;
      } else if (st.dragDial === 'Rcal' && Math.abs(dx) >= 8) {
        const steps = Math.trunc(dx / 8);
        adjustRCal(steps * 0.5);
        st.dragStartX += steps * 8;
        st.dragMoved = true;
      }
    },

    onMouseUp: function () {
      st.dragDial = null;
    },

    onCanvasClick: function (pt) {
      if (st.phase === 'circuit') {
        let clicked = null;
        for (let i = 0; i < TERMINALS.length; i++) {
          if (Math.hypot(pt.x - TERMINALS[i].x, pt.y - TERMINALS[i].y) <= 28) {
            clicked = TERMINALS[i];
            break;
          }
        }
        if (!clicked) {
          st.selectedTerminal = null;
          return;
        }
        if (!st.selectedTerminal) {
          st.selectedTerminal = clicked.id;
          window.AudioEngine.playSelect();
        } else if (st.selectedTerminal === clicked.id) {
          st.wires = st.wires.filter(w => w.from !== clicked.id && w.to !== clicked.id);
          st.selectedTerminal = null;
          window.AudioEngine.playSelect();
        } else {
          const fromId = st.selectedTerminal, toId = clicked.id;
          st.wires = st.wires.filter(
            w => w.from !== fromId && w.to !== fromId && w.from !== toId && w.to !== toId
          );
          st.wires.push({
            from: fromId,
            to: toId,
            color: wireColor(getTerm(fromId), getTerm(toId))
          });
          st.selectedTerminal = null;
          window.AudioEngine.playBananaPlug();
        }
        app.updateHud();
      } else if (st.phase === 'measure' && !st.dragMoved) {
        if (pt.x >= 35 && pt.x <= 215 && pt.y >= 75 && pt.y <= 215) {
          st.activeDial = 'R1';
          adjustDialR1(pt.x < 122 ? -0.1 : 0.1);
        } else if (pt.x >= 250 && pt.x <= 430 && pt.y >= 75 && pt.y <= 215) {
          st.activeDial = 'R2';
          if (pt.x < 292) adjustDialR2(-0.005);
          else if (pt.x < 338) adjustDialR2(-0.001);
          else if (pt.x <= 384) adjustDialR2(0.001);
          else adjustDialR2(0.005);
        }
      } else if (st.phase === 'weston' && !st.westonCalibrated && !st.dragMoved) {
        if (pt.x >= 45 && pt.x <= 220 && pt.y >= 65 && pt.y <= 205) {
          adjustRCal(pt.x < 132 ? -0.5 : 0.5);
        }
      }
    },

    onCanvasWheel: function (pt, deltaY, shiftKey) {
      const dir = deltaY < 0 ? 1 : -1;
      if (st.phase === 'weston' && !st.westonCalibrated) {
        adjustRCal(dir * 0.5);
        return true;
      } else if (st.phase === 'measure') {
        if (pt.x < 230) adjustDialR1(dir * 0.1);
        else if (pt.x >= 230 && pt.x <= 450) adjustDialR2(dir * (shiftKey ? 0.010 : 0.001));
        else if (st.activeDial === 'R1') adjustDialR1(dir * 0.1);
        else adjustDialR2(dir * (shiftKey ? 0.010 : 0.001));
        return true;
      }
      return false;
    },

    onKeyDown: function (e) {
      if (st.phase === 'weston' && !st.westonCalibrated) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); adjustRCal(e.shiftKey ? -2.0 : -0.5); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); adjustRCal(e.shiftKey ? 2.0 : 0.5); }
        else if (e.key === 'Enter') { e.preventDefault(); checkWestonCalibration(); }
      } else if (st.phase === 'measure') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (st.activeDial === 'R1') adjustDialR1(-0.1);
          else adjustDialR2(e.shiftKey ? -0.010 : -0.001);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (st.activeDial === 'R1') adjustDialR1(0.1);
          else adjustDialR2(e.shiftKey ? 0.010 : 0.001);
        } else if (e.key === 'ArrowUp') { e.preventDefault(); adjustDialR1(0.1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); adjustDialR1(-0.1); }
        else if (e.key === 'Enter') { e.preventDefault(); checkPilaMeasurement(); }
      }
    },

    getHudStats: function () {
      const done = Object.keys(st.measuredEmfs).length;
      return [
        { label: 'Misión 1', value: 'Poggendorff (Daniell)' },
        { label: 'Circuito', value: st.circuitComplete ? '✓ En Oposición' : `${st.wires.length}/6 cables` },
        { label: 'Weston', value: st.westonCalibrated ? '✓ 10.0 mA' : 'Pendiente' },
        { label: 'Pilas', value: `${done} / 5 medidas` }
      ];
    },

    getLogbookData: function () {
      return {
        title: '📒 BITÁCORA TP Nº 1 — PILA DE DANIELL (DATOS CRUDOS)',
        meta: 'Método de Oposición (i₀ = 0) | T = 20.0 °C | E_ECS = +0.2445 V | E_Weston = 1.0186 V',
        headers: ['Pila', 'Diagrama IUPAC', '[Zn²⁺] / M', '[Cu²⁺] / M', 'E_pila / V'],
        rows: PILAS.map(p => {
          const v = st.measuredEmfs[p.id];
          return [
            p.code,
            p.iupac,
            p.znConc !== null ? p.znConc.toFixed(3) : '— (ECS)',
            p.cuConc !== null ? p.cuConc.toFixed(3) : '— (ECS)',
            v !== undefined ? `${v.toFixed(3)} V` : 'Pendiente'
          ];
        })
      };
    },

    cleanup: function () {
      st.dragDial = null;
    }
  };
})();
