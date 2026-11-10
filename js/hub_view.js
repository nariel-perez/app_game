/**
 * hub_view.js — LAB_RPG Suite Unificada
 * Renderizador Canvas 2D del Hall Principal del Laboratorio de Fisicoquímica,
 * las tarjetas de las Misiones 1 y 2, los sellos de aprobación y el retrato del JTP.
 */

window.HubView = (function () {
  let tick = 0;

  function drawPixelBox(ctx, x, y, w, h, fill, border = '#ffffff', borderW = 2) {
    ctx.fillStyle = fill;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
    if (border && borderW > 0) {
      ctx.strokeStyle = border;
      ctx.lineWidth = borderW;
      ctx.strokeRect(Math.floor(x) + 1, Math.floor(y) + 1, Math.floor(w) - 2, Math.floor(h) - 2);
    }
  }

  /**
   * Dibuja un sello de goma inclinado estilo universitario ("APROBADO · JTP")
   */
  function drawRubberStamp(ctx, cx, cy, text, subtext, color = '#06d6a0', scale = 1.0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.14);
    ctx.scale(scale, scale);

    ctx.fillStyle = 'rgba(12, 24, 20, 0.88)';
    ctx.fillRect(-78, -22, 156, 44);

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(-78, -22, 156, 44);
    ctx.lineWidth = 1;
    ctx.strokeRect(-73, -17, 146, 34);

    ctx.fillStyle = color;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, 0, -2);
    ctx.font = '10px monospace';
    ctx.fillText(subtext, 0, 12);
    ctx.restore();
  }

  /**
   * Dibuja el Escudo / Logo del Grupo M3BN (Modelado Molecular de Materiales Blandos y Nanoestructurados)
   * 100% por código Canvas 2D (nanopartícula central, cadenas poliméricas con cuentas y anillo M3BN).
   */
  function drawM3BNShield(ctx, cx, cy, outerR, animTick) {
    ctx.save();
    ctx.translate(cx, cy);

    // Anillo exterior celeste claro con borde azul marino oscuro (#0d3153)
    ctx.beginPath();
    ctx.arc(0, 0, outerR, 0, Math.PI * 2);
    ctx.fillStyle = '#eaf4f8';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0d3153';
    ctx.stroke();

    // Círculo interior blanco donde se despliega la micela/nanopartícula
    const innerR = outerR * 0.75;
    ctx.beginPath();
    ctx.arc(0, 0, innerR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#0d3153';
    ctx.stroke();

    // 10 Cadenas poliméricas radiales en zig-zag con cuentas (azul, celeste y naranja)
    const numChains = 10;
    const coreR = outerR * 0.30;
    const orangeIndices = { '0_2': true, '3_2': true, '6_1': true, '7_2': true, '8_0': true };
    const cyanIndices = { '1_2': true, '4_2': true, '5_1': true, '9_2': true };

    for (let i = 0; i < numChains; i++) {
      const baseAngle = (i * Math.PI * 2) / numChains;
      const sway = Math.sin(animTick * 0.04 + i * 1.1) * 0.04;

      const pts = [];
      for (let s = 0; s <= 3; s++) {
        const dist = coreR + (s / 3) * (innerR - coreR - 3);
        const zig = s === 0 ? 0 : (s % 2 === 1 ? 0.13 : -0.11) + sway;
        const a = baseAngle + zig;
        pts.push({
          x: Math.cos(a) * dist,
          y: Math.sin(a) * dist
        });
      }

      // Línea de enlace polimérico
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let s = 1; s < pts.length; s++) {
        ctx.lineTo(pts[s].x, pts[s].y);
      }
      ctx.strokeStyle = '#0d3153';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Monómeros / esferitas en los vértices
      for (let s = 1; s < pts.length; s++) {
        const key = `${i}_${s - 1}`;
        let beadColor = '#2c7da0';
        if (orangeIndices[key]) beadColor = '#f49d52';
        else if (cyanIndices[key]) beadColor = '#5bc0be';

        ctx.beginPath();
        ctx.arc(pts[s].x, pts[s].y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = beadColor;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#0d3153';
        ctx.stroke();
      }
    }

    // Esfera / Nanopartícula central azul con sombreado y brillo
    ctx.beginPath();
    ctx.arc(0, 0, coreR, 0, Math.PI * 2);
    ctx.fillStyle = '#2c7da0';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0d3153';
    ctx.stroke();

    // Brillo superior izquierdo en la nanopartícula
    ctx.beginPath();
    ctx.arc(-coreR * 0.3, -coreR * 0.3, coreR * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(123, 223, 242, 0.65)';
    ctx.fill();

    // Texto superior en el anillo ("MAT. BLANDOS · NANO")
    ctx.fillStyle = '#0d3153';
    ctx.font = 'bold 5.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MODELADO MOLECULAR', 0, -outerR * 0.86);

    // Cartel / Placa destacada "M3BN" en la base del escudo para máxima legibilidad
    drawPixelBox(ctx, -28, outerR - 11, 56, 15, '#eaf4f8', '#0d3153', 2);
    ctx.fillStyle = '#0d3153';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('M3BN', 0, outerR - 3);

    ctx.restore();
  }

  return {
    /**
     * Dibuja el retrato pixel-art en el canvas de avatar (64x64)
     */
    drawPortrait: function (canvas, speaker, mood) {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bgColors = {
        jtp: '#2b2d42',
        ayudante: '#1d3557',
        alerta: '#4a1525'
      };
      ctx.fillStyle = bgColors[speaker] || '#2b2d42';
      ctx.fillRect(0, 0, w, h);

      if (speaker === 'alerta') {
        ctx.fillStyle = '#ff5964';
        ctx.beginPath();
        ctx.arc(32, 32, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', 32, 33);
        return;
      }

      // Guardapolvo blanco
      ctx.fillStyle = '#f1faee';
      ctx.fillRect(10, 44, 44, 20);
      ctx.fillStyle = '#a8dadc';
      ctx.fillRect(26, 44, 12, 20);

      // Rostro
      ctx.fillStyle = '#f4a261';
      ctx.fillRect(18, 16, 28, 26);

      if (speaker === 'jtp') {
        ctx.fillStyle = '#4a4e69';
        ctx.fillRect(16, 10, 32, 8);
        ctx.fillRect(18, 34, 28, 8);
        ctx.fillStyle = '#f4a261';
        ctx.fillRect(26, 36, 12, 3);

        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 21, 10, 8);
        ctx.strokeRect(34, 21, 10, 8);
        ctx.beginPath();
        ctx.moveTo(30, 25);
        ctx.lineTo(34, 25);
        ctx.stroke();

        ctx.fillStyle = '#111';
        ctx.fillRect(24, 24, 3, 3);
        ctx.fillRect(38, 24, 3, 3);

        // Mate
        ctx.fillStyle = '#6f4e37';
        ctx.fillRect(46, 42, 12, 14);
        ctx.strokeStyle = '#d9d9d9';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(52, 42);
        ctx.lineTo(56, 32);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#2a9d8f';
        ctx.fillRect(16, 10, 32, 8);
        ctx.fillStyle = '#111';
        ctx.fillRect(23, 24, 4, 4);
        ctx.fillRect(37, 24, 4, 4);
        ctx.fillStyle = '#e76f51';
        ctx.fillRect(27, 34, 10, 3);
      }
    },

    /**
     * Renderiza el Hall Principal del Laboratorio (Selección de Misión 1 y Misión 2)
     */
    renderHubScene: function (canvas, hubState) {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      tick++;

      // Fondo de azulejos del laboratorio central
      ctx.fillStyle = '#111622';
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

      const tp1Done = window.MissionsRegistry.isCompleted('tp1_daniell');
      const tp2Done = window.MissionsRegistry.isCompleted('tp2_polarimetria');
      const allDone = tp1Done && tp2Done;

      // Cartel Principal Superior
      drawPixelBox(
        ctx,
        18,
        10,
        w - 36,
        34,
        allDone ? '#1c3b35' : '#1e2436',
        allDone ? '#06d6a0' : '#ffd166',
        2
      );
      ctx.fillStyle = allDone ? '#06d6a0' : '#ffd166';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        allDone
          ? '🏆 CÁTEDRA DE FISICOQUÍMICA — ¡TRABAJOS PRÁCTICOS REGULARIZADOS! 🏆'
          : '🏛️ HALL CENTRAL DEL LABORATORIO DE FISICOQUÍMICA — SELECCIÓN DE TP',
        w / 2,
        32
      );

      // =======================================================================
      // TARJETA / MESADA 1 (IZQUIERDA): EL DESAFÍO DE POGGENDORFF (DANIELL)
      // =======================================================================
      const card1X = 22;
      const cardY = 54;
      const cardW = 308;
      const cardH = 222;

      drawPixelBox(
        ctx,
        card1X,
        cardY,
        cardW,
        cardH,
        '#181f30',
        tp1Done ? '#06d6a0' : '#7bdff2',
        2
      );

      // Encabezado Misión 1
      ctx.fillStyle = '#232d45';
      ctx.fillRect(card1X + 4, cardY + 4, cardW - 8, 28);
      ctx.fillStyle = '#7bdff2';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ MISIÓN 1: EL DESAFÍO DE POGGENDORFF', card1X + cardW / 2, cardY + 22);

      // Ilustración miniatura de la Pila de Daniell y el Potenciómetro
      const m1Cx = card1X + cardW / 2;
      // Caja de Petri + 2 vainas
      drawPixelBox(ctx, m1Cx - 115, cardY + 88, 95, 22, 'rgba(123,223,242,0.25)', '#d8f3dc', 1.5);
      drawPixelBox(ctx, m1Cx - 102, cardY + 48, 24, 52, 'rgba(200,225,255,0.3)', '#d8f3dc', 1.5);
      drawPixelBox(ctx, m1Cx - 56, cardY + 48, 24, 52, 'rgba(0,168,232,0.45)', '#d8f3dc', 1.5);

      // Potenciómetro y Galvanómetro a la derecha
      drawPixelBox(ctx, m1Cx + 2, cardY + 48, 115, 62, '#241c18', '#c89d54', 2);
      ctx.beginPath();
      ctx.arc(m1Cx + 34, cardY + 79, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#141824';
      ctx.fill();
      ctx.strokeStyle = '#ffd166';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(m1Cx + 82, cardY + 79, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#06d6a0';
      ctx.stroke();

      // Descripción Misión 1
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('Pila de Daniell · Método de Oposición', m1Cx, cardY + 132);
      ctx.fillStyle = '#a0aec0';
      ctx.font = '10px monospace';
      ctx.fillText('• Armado de circuito con cables banana', m1Cx, cardY + 150);
      ctx.fillText('• Calibración Weston (10 mA) y 5 Pilas', m1Cx, cardY + 166);
      ctx.fillText('• Aditividad y Recta de Nernst (i₀ = 0)', m1Cx, cardY + 182);

      // Pie de estado o Sello de goma Misión 1
      if (tp1Done) {
        let scale1 = 1.0;
        if (hubState.justStampedId === 'tp1_daniell' && hubState.stampAnimProgress < 1) {
          scale1 = 1.8 - 0.8 * hubState.stampAnimProgress;
        }
        drawRubberStamp(
          ctx,
          m1Cx,
          cardY + 185,
          '★ TP 1 APROBADO ★',
          'FIRMADO · JTP FISICOQUÍMICA',
          '#06d6a0',
          scale1
        );
      } else {
        drawPixelBox(ctx, card1X + 24, cardY + 192, cardW - 48, 22, '#262f47', '#7bdff2', 1);
        ctx.fillStyle = '#7bdff2';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('▸ HACÉ CLIC PARA INICIAR MISIÓN 1', m1Cx, cardY + 207);
      }

      // =======================================================================
      // PERSONAJE CENTRAL: EL JTP CON SU MATE Y SELLO
      // =======================================================================
      const centerCx = w / 2;
      drawPixelBox(ctx, centerCx - 40, cardY + 38, 80, 148, '#1b2234', '#ffd166', 2);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('EL JTP', centerCx, cardY + 55);

      // Sprite de cuerpo medio del JTP en el centro
      ctx.fillStyle = '#f1faee';
      ctx.fillRect(centerCx - 22, cardY + 112, 44, 42);
      ctx.fillStyle = '#a8dadc';
      ctx.fillRect(centerCx - 6, cardY + 112, 12, 42);
      ctx.fillStyle = '#f4a261';
      ctx.fillRect(centerCx - 14, cardY + 82, 28, 28);
      ctx.fillStyle = '#4a4e69';
      ctx.fillRect(centerCx - 16, cardY + 75, 32, 9);
      ctx.fillRect(centerCx - 14, cardY + 102, 28, 8);
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.strokeRect(centerCx - 12, cardY + 88, 10, 7);
      ctx.strokeRect(centerCx + 2, cardY + 88, 10, 7);

      // Contador de sellos debajo del JTP
      const count = window.MissionsRegistry.getCompletedCount();
      ctx.fillStyle = count === 2 ? '#06d6a0' : '#ffd166';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`Sellos: ${count}/2`, centerCx, cardY + 174);

      // Renderizar también el Escudo M3BN grande en el canvas superior (#m3bn-logo-canvas)
      const logoCanvas = document.getElementById('m3bn-logo-canvas');
      if (logoCanvas) {
        const lctx = logoCanvas.getContext('2d');
        lctx.clearRect(0, 0, logoCanvas.width, logoCanvas.height);
        drawM3BNShield(lctx, logoCanvas.width / 2, logoCanvas.height / 2 - 2, 33, tick);
      }

      // =======================================================================
      // TARJETA / MESADA 2 (DERECHA): LA INVERSIÓN DE LA SACAROSA (POLARIMETRÍA)
      // =======================================================================
      const card2X = w - 22 - cardW;

      drawPixelBox(
        ctx,
        card2X,
        cardY,
        cardW,
        cardH,
        '#181f30',
        tp2Done ? '#06d6a0' : '#ffd166',
        2
      );

      // Encabezado Misión 2
      ctx.fillStyle = '#232d45';
      ctx.fillRect(card2X + 4, cardY + 4, cardW - 8, 28);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('📜 MISIÓN 2: LA INVERSIÓN DE LA SACAROSA', card2X + cardW / 2, cardY + 22);

      // Ilustración miniatura del Ocular de Laurent y Matraz de Sacarosa
      const m2Cx = card2X + cardW / 2;
      // Ocular bipartito de Laurent
      ctx.beginPath();
      ctx.arc(m2Cx - 55, cardY + 78, 26, Math.PI / 2, (3 * Math.PI) / 2);
      ctx.fillStyle = '#dca134';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(m2Cx - 55, cardY + 78, 26, -Math.PI / 2, Math.PI / 2);
      ctx.fillStyle = '#4a3510';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(m2Cx - 55, cardY + 78, 26, 0, Math.PI * 2);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#c89d54';
      ctx.stroke();

      // Erlenmeyer + Tubo polarimétrico de 10 cm
      drawPixelBox(ctx, m2Cx + 5, cardY + 66, 95, 24, 'rgba(180,230,255,0.22)', '#d8f3dc', 1.5);
      ctx.fillStyle = 'rgba(255, 209, 102, 0.35)';
      ctx.fillRect(m2Cx + 8, cardY + 70, 89, 16);

      // Descripción Misión 2
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('Cinética Química por Polarimetría', m2Cx, cardY + 132);
      ctx.fillStyle = '#a0aec0';
      ctx.font = '10px monospace';
      ctx.fillText('• Elección HCl 3M / 6M y calibración α₀', m2Cx, cardY + 150);
      ctx.fillText('• Mezcla Δt_m y trampa de burbuja (10 cm)', m2Cx, cardY + 166);
      ctx.fillText('• 20 puntos cinéticos, α_∞ y gráficos', m2Cx, cardY + 182);

      if (tp2Done) {
        let scale2 = 1.0;
        if (hubState.justStampedId === 'tp2_polarimetria' && hubState.stampAnimProgress < 1) {
          scale2 = 1.8 - 0.8 * hubState.stampAnimProgress;
        }
        drawRubberStamp(
          ctx,
          m2Cx,
          cardY + 185,
          '★ TP 2 APROBADO ★',
          'FIRMADO · JTP FISICOQUÍMICA',
          '#06d6a0',
          scale2
        );
      } else {
        drawPixelBox(ctx, card2X + 24, cardY + 192, cardW - 48, 22, '#262f47', '#ffd166', 1);
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('▸ HACÉ CLIC PARA INICIAR MISIÓN 2', m2Cx, cardY + 207);
      }

      // Lluvia de confeti sutil si completó ambos TPs
      if (allDone) {
        const colors = ['#ffd166', '#06d6a0', '#7bdff2', '#ff5964'];
        for (let i = 0; i < 18; i++) {
          const px = ((i * 97 + tick * 1.5) % (w - 40)) + 20;
          const py = ((i * 53 + tick * 1.2) % (h - 30)) + 15;
          ctx.fillStyle = colors[i % colors.length];
          ctx.fillRect(px, py, 4, 4);
        }
      }
    },

    /**
     * Detecta si el jugador hizo clic directamente sobre la tarjeta de Misión 1 o Misión 2 en el Canvas
     */
    getClickedMissionOnCanvas: function (canvas, event) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (event.clientX - rect.left) * scaleX;
      const my = (event.clientY - rect.top) * scaleY;

      if (my >= 54 && my <= 276) {
        if (mx >= 22 && mx <= 330) return 'tp1_daniell';
        if (mx >= canvas.width - 330 && mx <= canvas.width - 22) return 'tp2_polarimetria';
      }
      return null;
    }
  };
})();
