// mazos.js
// ===== CONFIGURACION Y LOGICA DE MAZOS ACTIVOS =====

var MAZOS_KEY = 'magical_athlete_mazos_v1';

var MAZOS_INFO = [
    { key: 'base', label: 'Base', tipo: 'base' },
    { key: 'expansion', label: 'Expansion', tipo: 'expansion' },
    { key: 'noficial', label: 'Noficiales', tipo: 'noficial' },
    { key: 'amano', label: 'Amano', tipo: 'amano' }
];

function cargarMazosActivos() {
    try {
        var raw = localStorage.getItem(MAZOS_KEY);
        if (raw) {
            var data = JSON.parse(raw);
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