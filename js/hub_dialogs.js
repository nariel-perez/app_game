/**
 * hub_dialogs.js — LAB_RPG Suite Unificada
 * Guion de diálogos del JTP en el Hall Principal del Laboratorio,
 * escenas de retorno, sellado de la Libreta Universitaria y festejo final.
 */

window.HubDialogs = {
  characters: {
    jtp: {
      name: 'El JTP (Profe de TP)',
      role: 'Jefe de Trabajos Prácticos · Mate y Sello en mano',
      color: '#ffd166'
    },
    ayudante: {
      name: 'Ayudante de Primera',
      role: 'Narrador · Guía de la Cátedra de Fisicoquímica',
      color: '#7bdff2'
    },
    alerta: {
      name: '¡EVENTO DE LABORATORIO!',
      role: 'Aviso Crítico',
      color: '#ff5964'
    }
  },

  welcome: {
    speaker: 'jtp',
    mood: 'mate',
    text: '«¡Te damos la bienvenida al laboratorio! ¡Por las barbas de Faraday, qué alegría tenerte por acá! Pasá, guardá las cosas en el casillero y ajustate el guardapolvo y las gafas de seguridad. Hoy tenemos jornada doble en la cátedra de Fisicoquímica: en la Mesada 1 tenés "El Desafío de Poggendorff" (Pila de Daniell por Oposición) y en la Mesada 2 tenés "La Inversión de la Sacarosa" (Cinética por Polarimetría). ¿Por cuál de las dos experiencias querés empezar?»'
  },

  whichFirstAdvice: {
    speaker: 'jtp',
    mood: 'explicando',
    text: '«¡Cualquiera de las dos experiencias está perfecta! Pero si querés seguir el camino de la elegancia termodinámica, te sugiero empezar por la Misión 1 de Poggendorff: ahí vas a cablear el potenciómetro y medir la FEM con corriente neta cero (i₀ = 0) para comprobar la aditividad de potenciales y la ley de Nernst. ¡Por la energía libre de Gibbs, es una belleza! Después pasás a la Misión 2 a ver cómo los protones del ácido hidrolizan la sacarosa e invierten la rotación óptica. ¡Elegí la que más te interese!»'
  },

  returnAfterTp1: {
    speaker: 'jtp',
    mood: 'feliz',
    text: '«¡Impecable trabajo con el potenciómetro de oposición! ¡Por el potencial estándar de reducción, la recta de Nernst dio perfecta y se verificó la aditividad de potenciales! ¡CLAC! Ya tenés el sello oficial del TP 1 estampado en tu Libreta Universitaria. Una breve pausa para tomar aire... y cuando quieras continuar, pasamos a la Mesada 2 para encarar "La Inversión de la Sacarosa".»'
  },

  returnAfterTp2: {
    speaker: 'jtp',
    mood: 'feliz',
    text: '«¡Excelente esa serie cinética de 20 puntos y la determinación de α_∞! ¡Por las ecuaciones de Arrhenius, ese cruce por cero cuando la fructosa invirtió la rotación fue una verdadera belleza molecular! ¡CLAC! Sello del TP 2 estampado con éxito en tu Libreta Universitaria. Si todavía tenés pendiente la Misión 1, el potenciómetro de Poggendorff te espera en la otra mesada.»'
  },

  allCompletedFinale: {
    speaker: 'jtp',
    mood: 'feliz',
    text: '«¡ATENCIÓN EN TODO EL LABORATORIO! ¡Por la segunda ley de la termodinámica y el número de Avogadro! Quien está en esta mesada acaba de completar LA TOTALIDAD de los Trabajos Prácticos de Fisicoquímica con precisión milimétrica, cuidando el instrumental y sin derramar una sola gota de reactivo. ¡MATERIA REGULARIZADA CON DIPLOMA DE HONOR! Mirá cómo lucen los dos sellos en tu Libreta Universitaria. ¡Felicitaciones por semejante dedicación y rigor experimental!»'
  },

  returnMidway: {
    speaker: 'jtp',
    mood: 'mate',
    text: '«Con calma, nadie te apura en el laboratorio. Tomate una pausa en el Hall Principal, revisá tu Libreta Universitaria y cuando tengas ganas retomamos las mediciones en las mesadas.»'
  }
};
