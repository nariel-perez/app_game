/**
 * audio.js — LAB_RPG Suite Unificada
 * Sintetizador retro de 8 bits usando Web Audio API nativo.
 * Incluye efectos para el Hub, Libreta Universitaria (sello de goma),
 * Misión 1 (Pila de Daniell) y Misión 2 (Polarimetría).
 */

window.AudioEngine = (function () {
  let ctx = null;
  let muted = false;

  function getContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  function playTone(freq, type, duration, vol = 0.08, delay = 0, slideTo = null) {
    if (muted) return;
    const c = getContext();
    if (!c) return;

    const now = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(c.destination);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  return {
    isMuted: function () {
      return muted;
    },

    toggleMute: function () {
      muted = !muted;
      if (!muted) {
        this.playSelect();
      }
      return muted;
    },

    playTextBlip: function (speaker) {
      if (muted) return;
      let baseFreq = 335;
      if (speaker === 'jtp') baseFreq = 235;
      else if (speaker === 'ayudante') baseFreq = 410;
      else if (speaker === 'alerta') baseFreq = 520;

      const jitter = (Math.random() - 0.5) * 42;
      playTone(baseFreq + jitter, 'square', 0.03, 0.032);
    },

    playSelect: function () {
      playTone(440, 'square', 0.055, 0.07, 0);
      playTone(660, 'square', 0.085, 0.07, 0.05);
    },

    // Sonido contundente de sello de goma sobre la Libreta Universitaria
    playStampHit: function () {
      playTone(140, 'triangle', 0.12, 0.14, 0, 55);
      playTone(95, 'sawtooth', 0.15, 0.12, 0.02, 42);
      playTone(587.33, 'square', 0.10, 0.08, 0.18);
      playTone(880.0, 'square', 0.28, 0.09, 0.28);
    },

    playBananaPlug: function () {
      playTone(310, 'triangle', 0.04, 0.09, 0);
      playTone(580, 'square', 0.06, 0.08, 0.035);
    },

    playSandScratch: function () {
      for (let i = 0; i < 6; i++) {
        playTone(180 + i * 65, 'sawtooth', 0.045, 0.06, i * 0.055);
      }
      playTone(880, 'triangle', 0.15, 0.08, 0.35);
    },

    playDialTick: function (isFine = true) {
      const freq = isFine ? 740 : 440;
      playTone(freq, 'triangle', 0.025, 0.065, 0);
    },

    playPulseKey: function (isBalanced = false) {
      if (isBalanced) {
        playTone(587.33, 'triangle', 0.08, 0.09, 0);
        playTone(880.0, 'square', 0.16, 0.09, 0.08);
      } else {
        playTone(260, 'sawtooth', 0.08, 0.07, 0, 190);
      }
    },

    playBubbleAlert: function () {
      playTone(300, 'sawtooth', 0.09, 0.09, 0, 620);
      playTone(320, 'sawtooth', 0.09, 0.09, 0.10, 680);
      playTone(680, 'square', 0.22, 0.09, 0.20, 260);
    },

    playPourTick: function (progress) {
      const freq = 220 + Math.min(progress * 60, 400);
      playTone(freq, 'sine', 0.05, 0.05, 0);
    },

    playMeasureServo: function (isZeroCross = false) {
      if (isZeroCross) {
        playTone(523.25, 'square', 0.10, 0.09, 0);
        playTone(659.25, 'square', 0.10, 0.09, 0.10);
        playTone(783.99, 'square', 0.12, 0.09, 0.20);
        playTone(1046.5, 'square', 0.30, 0.10, 0.32);
      } else {
        playTone(380, 'triangle', 0.05, 0.06, 0);
        playTone(540, 'square', 0.07, 0.06, 0.05);
      }
    },

    playError: function () {
      playTone(195, 'sawtooth', 0.14, 0.09, 0, 130);
      playTone(145, 'sawtooth', 0.22, 0.09, 0.14, 95);
    },

    playFanfare: function () {
      const notes = [
        { f: 523.25, d: 0.11, t: 0.00 },
        { f: 523.25, d: 0.11, t: 0.12 },
        { f: 523.25, d: 0.11, t: 0.24 },
        { f: 523.25, d: 0.26, t: 0.36 },
        { f: 415.30, d: 0.24, t: 0.64 },
        { f: 466.16, d: 0.24, t: 0.90 },
        { f: 523.25, d: 0.16, t: 1.16 },
        { f: 466.16, d: 0.10, t: 1.36 },
        { f: 523.25, d: 0.48, t: 1.48 }
      ];
      notes.forEach(n => playTone(n.f, 'square', n.d, 0.08, n.t));
    }
  };
})();
