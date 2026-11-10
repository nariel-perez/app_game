/**
 * main.js — LAB_RPG Suite Unificada ("Fisicoquímica: Crónicas de Mesada")
 * Controlador maestro de navegación entre:
 * - Hall Principal del Laboratorio ('hub')
 * - Misión 1: El Desafío de Poggendorff ('tp1_daniell' -> window.DaniellModule)
 * - Misión 2: La Inversión de la Sacarosa ('tp2_polarimetria' -> window.PolarModule)
 * - Modal de Libreta Universitaria (con animación de sello de goma y persistencia)
 * - Modal de Bitácora Experimental (tabla dinámica según la misión activa)
 */

window.App = (function () {
  const MODULES = {
    tp1_daniell: () => window.DaniellModule,
    tp2_polarimetria: () => window.PolarModule
  };

  const state = {
    activeView: 'hub', // 'hub' | 'tp1_daniell' | 'tp2_polarimetria'
    justStampedId: null,
    stampAnimProgress: 1.0,
    speaker: 'jtp',
    mood: 'mate',
    fullText: '',
    displayedText: '',
    typewriterId: null
  };

  let dom = {};

  function cacheDom() {
    dom = {
      sceneCanvas: document.getElementById('scene-canvas'),
      portraitCanvas: document.getElementById('portrait-canvas'),
      speakerName: document.getElementById('speaker-name'),
      speakerRole: document.getElementById('speaker-role'),
      dialogText: document.getElementById('dialog-text'),
      optionsContainer: document.getElementById('options-container'),
      hudStatsContainer: document.getElementById('hud-stats-container'),
      btnHubReturn: document.getElementById('btn-hub-return'),
      btnLibreta: document.getElementById('btn-libreta'),
      btnLogbook: document.getElementById('btn-logbook'),
      btnMute: document.getElementById('btn-mute'),
      // Modal Libreta Universitaria
      libretaModal: document.getElementById('libreta-modal'),
      libretaCardsContainer: document.getElementById('libreta-cards-container'),
      libretaStatusBanner: document.getElementById('libreta-status-banner'),
      btnCloseLibreta: document.getElementById('btn-close-libreta'),
      btnResetLibreta: document.getElementById('btn-reset-libreta'),
      // Modal Bitácora de Datos
      logbookModal: document.getElementById('logbook-modal'),
      logbookTitle: document.getElementById('logbook-title'),
      logbookMeta: document.getElementById('logbook-meta'),
      logbookThead: document.getElementById('logbook-thead'),
      logbookTbody: document.getElementById('logbook-tbody'),
      btnCloseLogbook: document.getElementById('btn-close-logbook')
    };
  }

  function getActiveModule() {
    const getter = MODULES[state.activeView];
    return getter ? getter() : null;
  }

  /**
   * Actualiza los indicadores del HUD superior según si estamos en el Hub o en una Misión
   */
  function updateHud() {
    const completed = window.MissionsRegistry.getCompletedCount();
    const total = window.MissionsRegistry.getTotalCount();
    dom.btnLibreta.textContent = `🪪 Libreta (${completed}/${total})`;

    const crestBar = document.getElementById('m3bn-crest-bar');
    if (state.activeView === 'hub') {
      dom.btnHubReturn.classList.add('hidden');
      dom.btnLogbook.classList.add('hidden');
      if (crestBar) crestBar.classList.remove('hidden');

      const tp1Ok = window.MissionsRegistry.isCompleted('tp1_daniell') ? '★ APROBADO' : 'Pendiente';
      const tp2Ok = window.MissionsRegistry.isCompleted('tp2_polarimetria') ? '★ APROBADO' : 'Pendiente';
      renderHudBoxes([
        { label: 'Ubicación', value: 'Hall Central' },
        { label: 'TP 1 (Daniell)', value: tp1Ok },
        { label: 'TP 2 (Sacarosa)', value: tp2Ok },
        { label: 'Regularidad', value: `${completed} / ${total} Sellos` }
      ]);
    } else {
      dom.btnHubReturn.classList.remove('hidden');
      dom.btnLogbook.classList.remove('hidden');
      if (crestBar) crestBar.classList.add('hidden');
      const mod = getActiveModule();
      if (mod && typeof mod.getHudStats === 'function') {
        renderHudBoxes(mod.getHudStats());
      }
    }
  }

  function renderHudBoxes(stats) {
    dom.hudStatsContainer.innerHTML = '';
    stats.forEach(item => {
      const div = document.createElement('div');
      div.className = 'stat-box';
      div.innerHTML = `<span class="stat-label">${item.label}:</span> <span class="stat-val">${item.value}</span>`;
      dom.hudStatsContainer.appendChild(div);
    });
  }

  /**
   * Muestra diálogo con efecto máquina de escribir y dibuja el retrato
   */
  function setDialog(speaker, mood, text, options = []) {
    state.speaker = speaker;
    state.mood = mood || 'normal';
    state.fullText = text;
    state.displayedText = '';

    const charInfo = window.HubDialogs.characters[speaker] || window.HubDialogs.characters.jtp;
    dom.speakerName.textContent = charInfo.name;
    dom.speakerName.style.color = charInfo.color;
    dom.speakerRole.textContent = charInfo.role;

    window.HubView.drawPortrait(dom.portraitCanvas, speaker, state.mood);

    if (state.typewriterId) {
      clearInterval(state.typewriterId);
    }

    let idx = 0;
    dom.dialogText.textContent = '';
    state.typewriterId = setInterval(() => {
      if (idx < state.fullText.length) {
        const chunk = state.fullText.slice(idx, idx + 2);
        state.displayedText += chunk;
        dom.dialogText.textContent = state.displayedText;
        if (idx % 6 === 0) {
          window.AudioEngine.playTextBlip(speaker);
        }
        idx += 2;
      } else {
        clearInterval(state.typewriterId);
        state.typewriterId = null;
      }
    }, 16);

    renderOptions(options);
  }

  function renderOptions(options) {
    dom.optionsContainer.innerHTML = '';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'rpg-btn ' + (opt.className || '');
      btn.textContent = opt.label;
      if (opt.disabled) btn.disabled = true;
      btn.addEventListener('click', () => {
        window.AudioEngine.playSelect();
        if (typeof opt.onClick === 'function') {
          opt.onClick();
        }
      });
      dom.optionsContainer.appendChild(btn);
    });
  }

  // ===========================================================================
  // NAVEGACIÓN: HALL PRINCIPAL (HUB) <-> MISIONES 1 Y 2
  // ===========================================================================
  function getHubButtons() {
    const missions = window.MissionsRegistry.getMissions();
    const btns = missions.map(m => {
      const done = window.MissionsRegistry.isCompleted(m.id);
      return {
        label: done ? `${m.buttonLabel} [★ APROBADO]` : m.buttonLabel,
        onClick: () => launchMission(m.id)
      };
    });

    btns.push({
      label: '🤔 Profe, ¿por cuál de las dos experiencias me conviene empezar?',
      onClick: () => {
        const adv = window.HubDialogs.whichFirstAdvice;
        setDialog(adv.speaker, adv.mood, adv.text, getHubButtons());
      }
    });

    btns.push({
      label: '🪪 Abrir mi Libreta Universitaria (Ver Sellos)',
      onClick: () => openLibretaModal(null)
    });

    return btns;
  }

  function enterHub(mode = 'welcome', stampedMissionId = null) {
    const prevMod = getActiveModule();
    if (prevMod && typeof prevMod.cleanup === 'function') {
      prevMod.cleanup();
    }

    state.activeView = 'hub';
    state.justStampedId = stampedMissionId;
    state.stampAnimProgress = stampedMissionId ? 0.0 : 1.0;
    updateHud();

    let dlg = window.HubDialogs.welcome;
    if (mode === 'stamped') {
      if (window.MissionsRegistry.areAllCompleted()) {
        dlg = window.HubDialogs.allCompletedFinale;
      } else if (stampedMissionId === 'tp1_daniell') {
        dlg = window.HubDialogs.returnAfterTp1;
      } else {
        dlg = window.HubDialogs.returnAfterTp2;
      }
    } else if (mode === 'midway') {
      dlg = window.HubDialogs.returnMidway;
    }

    setDialog(dlg.speaker, dlg.mood, dlg.text, getHubButtons());
  }

  function launchMission(missionId) {
    const prevMod = getActiveModule();
    if (prevMod && typeof prevMod.cleanup === 'function') {
      prevMod.cleanup();
    }

    state.activeView = missionId;
    state.justStampedId = null;
    updateHud();

    const mod = getActiveModule();
    if (mod && typeof mod.start === 'function') {
      mod.start({
        setDialog: setDialog,
        renderOptions: renderOptions,
        updateHud: updateHud,
        completeMissionAndReturn: completeMissionAndReturn
      });
    }
  }

  /**
   * Llamado al finalizar una Misión cuando el estudiante presiona "¡Sellar TP en mi Libreta!"
   */
  function completeMissionAndReturn(missionId, summaryText) {
    window.MissionsRegistry.markCompleted(missionId, summaryText);
    window.AudioEngine.playStampHit();
    enterHub('stamped', missionId);
    openLibretaModal(missionId);
  }

  // ===========================================================================
  // MODAL DE LIBRETA UNIVERSITARIA (CON SELLO ANIMADO)
  // ===========================================================================
  function openLibretaModal(newlyStampedId = null) {
    renderLibretaContents(newlyStampedId);
    dom.libretaModal.classList.remove('hidden');
  }

  function closeLibretaModal() {
    dom.libretaModal.classList.add('hidden');
  }

  function renderLibretaContents(newlyStampedId = null) {
    const missions = window.MissionsRegistry.getMissions();
    const completedCount = window.MissionsRegistry.getCompletedCount();
    const totalCount = window.MissionsRegistry.getTotalCount();

    if (completedCount === totalCount) {
      dom.libretaStatusBanner.className = 'libreta-banner libreta-banner-complete';
      dom.libretaStatusBanner.textContent =
        '🏆 ¡ESTADO ACADÉMICO: MATERIA REGULARIZADA CON HONORES! (2 / 2 TPs Firmados)';
    } else {
      dom.libretaStatusBanner.className = 'libreta-banner';
      dom.libretaStatusBanner.textContent =
        `📋 Progreso de Cursada: ${completedCount} de ${totalCount} Trabajos Prácticos Aprobados`;
    }

    dom.libretaCardsContainer.innerHTML = '';
    missions.forEach(m => {
      const rec = window.MissionsRegistry.getMissionRecord(m.id);
      const isApproved = Boolean(rec && rec.approved);
      const isNewStamp = newlyStampedId === m.id;

      const card = document.createElement('div');
      card.className = 'libreta-card' + (isApproved ? ' libreta-card-approved' : '');

      const stampHtml = isApproved
        ? `<div class="rubber-stamp ${isNewStamp ? 'stamp-slam-anim' : ''}">
             <div class="stamp-title">★ APROBADO Y FIRMADO ★</div>
             <div class="stamp-sub">JTP FISICOQUÍMICA · ${rec.date}</div>
           </div>`
        : `<div class="stamp-pending">[ ESPACIO RESERVADO PARA SELLO DEL JTP ]</div>`;

      card.innerHTML = `
        <div class="libreta-card-header">
          <span class="libreta-tp-code">${m.code}</span>
          <span class="libreta-tp-title">${m.shortTitle}: ${m.fullTitle}</span>
        </div>
        <div class="libreta-card-body">
          <div class="libreta-tp-desc">${m.subtitle}</div>
          <div class="libreta-tp-summary">
            <strong>Registro de Mesada:</strong> ${isApproved ? rec.summary : 'Sin calificar aún'}
          </div>
          ${stampHtml}
        </div>
      `;
      dom.libretaCardsContainer.appendChild(card);
    });
  }

  // ===========================================================================
  // MODAL DE BITÁCORA EXPERIMENTAL (DATOS DE LA MISIÓN ACTIVA)
  // ===========================================================================
  function openLogbookModal() {
    const mod = getActiveModule();
    if (!mod || typeof mod.getLogbookData !== 'function') return;

    const data = mod.getLogbookData();
    dom.logbookTitle.textContent = data.title;
    dom.logbookMeta.textContent = data.meta;

    dom.logbookThead.innerHTML = '';
    const trHead = document.createElement('tr');
    data.headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      trHead.appendChild(th);
    });
    dom.logbookThead.appendChild(trHead);

    dom.logbookTbody.innerHTML = '';
    data.rows.forEach(row => {
      const tr = document.createElement('tr');
      row.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = cell;
        tr.appendChild(td);
      });
      dom.logbookTbody.appendChild(tr);
    });

    dom.logbookModal.classList.remove('hidden');
  }

  function closeLogbookModal() {
    dom.logbookModal.classList.add('hidden');
  }

  // ===========================================================================
  // CONTROLES DE MOUSE, RUEDA Y TECLADO EN EL CANVAS
  // ===========================================================================
  function getCanvasCoords(e) {
    const rect = dom.sceneCanvas.getBoundingClientRect();
    const scaleX = dom.sceneCanvas.width / rect.width;
    const scaleY = dom.sceneCanvas.height / rect.height;
    let clientX = e.clientX;
    let clientY = e.clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    }
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function bindEvents() {
    // Botón para descartar el aviso de girar pantalla en móviles
    const btnDismissRotate = document.getElementById('btn-dismiss-rotate');
    if (btnDismissRotate) {
      btnDismissRotate.addEventListener('click', () => {
        document.body.classList.add('ignore-rotate-prompt');
        window.AudioEngine.playSelect();
      });
    }

    // Desbloquear sintetizador de audio en el primer toque en móviles (iOS/Android)
    const unlockMobileAudio = () => {
      window.AudioEngine.playTextBlip('jtp');
      window.removeEventListener('touchstart', unlockMobileAudio);
    };
    window.addEventListener('touchstart', unlockMobileAudio, { passive: true });

    // Clic rápido en el texto para completar el efecto máquina de escribir
    document.getElementById('dialog-box').addEventListener('click', e => {
      if (e.target.tagName === 'BUTTON') return;
      if (state.typewriterId) {
        clearInterval(state.typewriterId);
        state.typewriterId = null;
        dom.dialogText.textContent = state.fullText;
      }
    });

    // Botones superiores del HUD
    dom.btnHubReturn.addEventListener('click', () => {
      window.AudioEngine.playSelect();
      enterHub('midway', null);
    });

    dom.btnLibreta.addEventListener('click', () => {
      window.AudioEngine.playSelect();
      openLibretaModal(null);
    });

    dom.btnCloseLibreta.addEventListener('click', () => {
      window.AudioEngine.playSelect();
      closeLibretaModal();
    });

    dom.btnResetLibreta.addEventListener('click', () => {
      window.AudioEngine.playError();
      window.MissionsRegistry.resetAllProgress();
      updateHud();
      renderLibretaContents(null);
      if (state.activeView === 'hub') {
        enterHub('welcome', null);
      }
    });

    dom.btnLogbook.addEventListener('click', () => {
      window.AudioEngine.playSelect();
      openLogbookModal();
    });

    dom.btnCloseLogbook.addEventListener('click', () => {
      window.AudioEngine.playSelect();
      closeLogbookModal();
    });

    dom.btnMute.addEventListener('click', () => {
      const muted = window.AudioEngine.toggleMute();
      dom.btnMute.textContent = muted ? '🔇 Sonido: OFF' : '🔊 Sonido: ON';
    });

    // Eventos del Canvas (delegados a HubView o al Módulo activo)
    dom.sceneCanvas.addEventListener('mousedown', e => {
      const mod = getActiveModule();
      if (mod && typeof mod.onCanvasMouseDown === 'function') {
        mod.onCanvasMouseDown(getCanvasCoords(e));
      }
    });

    window.addEventListener('mousemove', e => {
      const mod = getActiveModule();
      if (mod && typeof mod.onMouseMove === 'function') {
        mod.onMouseMove(getCanvasCoords(e));
      }
    });

    window.addEventListener('mouseup', () => {
      const mod = getActiveModule();
      if (mod && typeof mod.onMouseUp === 'function') {
        mod.onMouseUp();
      }
    });

    // Soporte táctil directo en el Canvas (arrastre de diales R1, R2, R_cal y Laurent)
    dom.sceneCanvas.addEventListener(
      'touchstart',
      e => {
        const mod = getActiveModule();
        if (mod && typeof mod.onCanvasMouseDown === 'function') {
          mod.onCanvasMouseDown(getCanvasCoords(e));
        }
      },
      { passive: true }
    );

    dom.sceneCanvas.addEventListener(
      'touchmove',
      e => {
        const mod = getActiveModule();
        if (mod && typeof mod.onMouseMove === 'function') {
          mod.onMouseMove(getCanvasCoords(e));
          e.preventDefault();
        }
      },
      { passive: false }
    );

    window.addEventListener('touchend', () => {
      const mod = getActiveModule();
      if (mod && typeof mod.onMouseUp === 'function') {
        mod.onMouseUp();
      }
    });

    dom.sceneCanvas.addEventListener('click', e => {
      if (state.activeView === 'hub') {
        const clickedMission = window.HubView.getClickedMissionOnCanvas(dom.sceneCanvas, e);
        if (clickedMission) {
          window.AudioEngine.playSelect();
          launchMission(clickedMission);
        }
      } else {
        const mod = getActiveModule();
        if (mod && typeof mod.onCanvasClick === 'function') {
          mod.onCanvasClick(getCanvasCoords(e));
        }
      }
    });

    dom.sceneCanvas.addEventListener(
      'wheel',
      e => {
        const mod = getActiveModule();
        if (mod && typeof mod.onCanvasWheel === 'function') {
          const handled = mod.onCanvasWheel(getCanvasCoords(e), e.deltaY, e.shiftKey);
          if (handled) e.preventDefault();
        }
      },
      { passive: false }
    );

    window.addEventListener('keydown', e => {
      const mod = getActiveModule();
      if (mod && typeof mod.onKeyDown === 'function') {
        mod.onKeyDown(e);
      }
    });
  }

  // ===========================================================================
  // BUCLE DE RENDERIZADO CONTINUO (60 FPS)
  // ===========================================================================
  function startRenderLoop() {
    function frame() {
      if (state.activeView === 'hub') {
        if (state.stampAnimProgress < 1.0) {
          state.stampAnimProgress = Math.min(1.0, state.stampAnimProgress + 0.04);
        }
        window.HubView.renderHubScene(dom.sceneCanvas, state);
      } else {
        const mod = getActiveModule();
        if (mod && typeof mod.render === 'function') {
          mod.render(dom.sceneCanvas);
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  return {
    init: function () {
      cacheDom();
      bindEvents();
      startRenderLoop();
      enterHub('welcome', null);
    }
  };
})();

window.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});
