/**
 * missions_registry.js — LAB_RPG Suite Unificada
 * Registro modular y extensible de Trabajos Prácticos + Persistencia en localStorage
 * para la Libreta Universitaria.
 *
 * Para agregar un nuevo Trabajo Práctico en el futuro, basta con añadir
 * un nuevo objeto al arreglo MISSIONS y registrar su módulo correspondiente.
 */

window.MissionsRegistry = (function () {
  const STORAGE_KEY = 'fisicoquimica_lab_rpg_libreta_v1';

  // Lista ordenada de Misiones (Misión 1: Poggendorff/Daniell, Misión 2: Polarimetría)
  const MISSIONS = [
    {
      id: 'tp1_daniell',
      number: 1,
      code: 'TP Nº 1',
      shortTitle: 'El Desafío de Poggendorff',
      fullTitle: 'Medida de la FEM de la Pila de Daniell por el Método de Oposición',
      subtitle: 'Termodinámica reversible con corriente neta cero (i₀ = 0)',
      badgeColor: '#06d6a0',
      buttonLabel: '⚡ Misión 1: "El Desafío de Poggendorff" (Pila de Daniell)',
      defaultSummary: 'Calibración Weston (10 mA) · 5 Pilas medidas · Aditividad y Nernst'
    },
    {
      id: 'tp2_polarimetria',
      number: 2,
      code: 'TP Nº 2',
      shortTitle: 'La Inversión de la Sacarosa',
      fullTitle: 'Cinética Química por Polarimetría (Hidrólisis ácida de la Sacarosa)',
      subtitle: 'Seguimiento cinético de pseudo-primer orden con ocular de Laurent',
      badgeColor: '#ffd166',
      buttonLabel: '📜 Misión 2: "La Inversión de la Sacarosa" (Polarimetría)',
      defaultSummary: 'Calibración α₀ · Tiempo de mezcla Δt_m · 20 puntos y α_∞'
    }
  ];

  // Estado en memoria respaldado por localStorage
  let progressData = {
    completed: {} // { tp1_daniell: { approved: true, date: '...', summary: '...' }, ... }
  };

  function loadFromStorage() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.completed === 'object') {
          progressData = parsed;
        }
      }
    } catch (e) {
      // Si el navegador bloquea localStorage en modo privado estricto, usa memoria
    }
  }

  function saveToStorage() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progressData));
    } catch (e) {
      // Ignorar si localStorage no está disponible
    }
  }

  loadFromStorage();

  return {
    getMissions: function () {
      return MISSIONS;
    },

    getMissionById: function (id) {
      return MISSIONS.find(m => m.id === id);
    },

    isCompleted: function (missionId) {
      return Boolean(
        progressData.completed[missionId] && progressData.completed[missionId].approved
      );
    },

    getMissionRecord: function (missionId) {
      return progressData.completed[missionId] || null;
    },

    markCompleted: function (missionId, customSummary) {
      const m = this.getMissionById(missionId);
      const nowStr = new Date().toLocaleDateString('es-AR');
      progressData.completed[missionId] = {
        approved: true,
        date: nowStr,
        summary: customSummary || (m ? m.defaultSummary : 'Completado')
      };
      saveToStorage();
    },

    getCompletedCount: function () {
      return MISSIONS.filter(m => this.isCompleted(m.id)).length;
    },

    getTotalCount: function () {
      return MISSIONS.length;
    },

    areAllCompleted: function () {
      return this.getCompletedCount() === MISSIONS.length;
    },

    resetAllProgress: function () {
      progressData = { completed: {} };
      saveToStorage();
    }
  };
})();
