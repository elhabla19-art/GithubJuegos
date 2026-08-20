// mazos.js
// ===== CONFIGURACION Y LOGICA DE MAZOS ACTIVOS =====
// Ajuste local (por dispositivo): decide que numeros de carta entran al
// mazoRestante cuando se presiona "Corredores". No se sincroniza por MQTT:
// quien presiona "Corredores" primero es quien decide, y el mazoRestante ya
// filtrado viaja completo a todos via broadcastStart/broadcastState, igual
// que el resto del estado de la partida.
//
// Para agregar un mazo nuevo en el futuro: solo hay que sumar una entrada
// aqui en MAZOS_INFO (key + label + tipo), donde "tipo" debe coincidir con
// lo que devuelve getTipoCarta() en juego.js para esas cartas. El modal
// (en modales.js) se arma dinamicamente a partir de esta lista, asi que no
// hace falta tocar el HTML ni el modal para que aparezca el nuevo mazo.

var MAZOS_KEY = 'magical_athlete_mazos_v1';

var MAZOS_INFO = [
    { key: 'base', label: 'Base', tipo: 'base' },
    { key: 'expansion', label: 'Expansion', tipo: 'expansion' },
    { key: 'noficial', label: 'Noficiales', tipo: 'noficial' }
];

function cargarMazosActivos() {
    try {
        var raw = localStorage.getItem(MAZOS_KEY);
        if (raw) {
            var data = JSON.parse(raw);
            // Por si en el futuro se agrega un mazo nuevo: cualquier clave
            // que falte en lo guardado se asume activa por defecto.
            var resultado = {};
            for (var i = 0; i < MAZOS_INFO.length; i++) {
                var key = MAZOS_INFO[i].key;
                resultado[key] = (data[key] !== undefined) ? !!data[key] : true;
            }
            return resultado;
        }
    } catch (e) {
        console.error('No se pudo leer la seleccion de mazos', e);
    }
    // Por defecto, todos los mazos activos
    var porDefecto = {};
    for (var j = 0; j < MAZOS_INFO.length; j++) {
        porDefecto[MAZOS_INFO[j].key] = true;
    }
    return porDefecto;
}

function guardarMazosActivos(mazos) {
    try {
        localStorage.setItem(MAZOS_KEY, JSON.stringify(mazos));
    } catch (e) {
        console.error('No se pudo guardar la seleccion de mazos', e);
    }
}

// Devuelve true si el numero de carta pertenece a un mazo actualmente activo
function mazoActivoParaNumero(numero) {
    var mazos = cargarMazosActivos();
    var tipo = (typeof getTipoCarta === 'function') ? getTipoCarta(numero) : 'base';
    for (var i = 0; i < MAZOS_INFO.length; i++) {
        if (MAZOS_INFO[i].tipo === tipo) {
            return mazos[MAZOS_INFO[i].key] !== false;
        }
    }
    return true;
}

window.MAZOS_INFO = MAZOS_INFO;
window.cargarMazosActivos = cargarMazosActivos;
window.guardarMazosActivos = guardarMazosActivos;
window.mazoActivoParaNumero = mazoActivoParaNumero;