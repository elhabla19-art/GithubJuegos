// enemigos.js
// ===== DATOS DE LOS ENEMIGOS =====
// Monstruo_N.png -> [nivel, dano, cartas de botin, potenciadores]
var VIDA_INICIAL_HEROE = 100;

var STATS_ENEMIGOS = {
    1: [3, 20, 1, 0],   2: [4, 5, 1, 0],    3: [4, 5, 0, 0],    4: [5, 15, 1, 0],
    5: [6, 15, 1, 0],   6: [6, 10, 1, 0],   7: [7, 15, 0, 1],   8: [7, 10, 2, 0],
    9: [7, 5, 1, 0],    10: [8, 10, 1, 1],  11: [8, 5, 1, 0],   12: [8, 15, 3, 0],
    13: [8, 5, 1, 0],   14: [8, 10, 1, 0],  15: [9, 10, 1, 0],  16: [9, 10, 2, 0],
    17: [10, 10, 1, 1], 18: [10, 10, 2, 0], 19: [10, 5, 1, 1],  20: [10, 10, 2, 0],
    21: [10, 10, 0, 1], 22: [11, 10, 1, 1], 23: [12, 10, 3, 0], 24: [12, 5, 1, 1],
    25: [13, 10, 3, 0], 26: [14, 10, 2, 0], 27: [14, 10, 1, 1], 28: [15, 5, 2, 1],
    29: [17, 10, 1, 0], 30: [20, 5, 2, 0],  31: [20, 10, 3, 2], 32: [22, 10, 2, 0],
    33: [24, 10, 1, 1]
};

function getEnemigo(n) {
    var s = STATS_ENEMIGOS[n] || [1, 0, 0, 0];
    return { numero: n, nivel: s[0], dano: s[1], botin: s[2], potenciadores: s[3] };
}

function textoRecompensa(e) {
    var partes = [];
    if (e.botin > 0) partes.push(e.botin + (e.botin === 1 ? ' Carta Botin' : ' Cartas Botin'));
    if (e.potenciadores > 0) partes.push(e.potenciadores + (e.potenciadores === 1 ? ' Potenciador' : ' Potenciadores'));
    return partes.length ? partes.join(', ') : 'Sin recompensa';
}

// ===== JEFES: Jefe_N.png -> [cartas de botin, potenciadores]; dano 10; nivel "elige tu enemigo" =====
var TOTAL_JEFES = 15;
var DANO_JEFE = 10;
var DATOS_JEFES = {
    1: [2, 1], 2: [1, 1], 3: [1, 1], 4: [1, 1], 5: [3, 1], 6: [1, 1], 7: [2, 1], 8: [2, 1],
    9: [2, 1], 10: [1, 1], 11: [2, 1], 12: [1, 1], 13: [1, 1], 14: [1, 1], 15: [2, 1]
};

// ===== GUARDIAN DE LA BEBIDA =====
var GUARDIAN_POT_REQUERIDOS = 3;
var GUARDIAN_NIVEL = 15;
var GUARDIAN_DANO = 10;

// ===== HEXAGONOS DE RECOMPENSA (numero = tipo) =====
var RECOMPENSAS_HEX = {
    1: { botin: 1, potenciadores: 0, imagen: 'imagenes/hexagonos/HBotin_1.png' },
    2: { botin: 2, potenciadores: 0, imagen: 'imagenes/hexagonos/HBotin_2.png' },
    3: { botin: 0, potenciadores: 1, imagen: 'imagenes/hexagonos/HPotenciador_1.png' }
};
// Cartas existentes: 4 de tipo 1, 3 de tipo 2 y 6 de tipo 3 (se sortean 9 para el tablero)
var POOL_RECOMPENSAS = [1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3];
var IMAGEN_PORTAL_HEX = 'imagenes/hexagonos/HPortal_2.png';

function getImagenJefe(n) { return 'imagenes/enemigos/Jefe_' + n + '.png'; }
var IMAGEN_GUARDIAN = 'imagenes/enemigos/Guardian_1.png';

// Describe lo que hay dentro de un hexagono del calabozo.
//  combate: true -> al entrar hay que elegir Atacar / Retirada.
//  overlay: true -> se dibuja la imagen encima del hexagono de piedra.
//  tile: imagen que reemplaza al hexagono de piedra al descubrirlo (recompensa / portal).
function getContenidoHex(hex) {
    var clase = hex.clase || 'monstruo';
    var n = hex.numero || hex.monstruo;
    if (clase === 'jefe') {
        var jd = DATOS_JEFES[n] || [1, 1];
        return { clase: clase, numero: n, combate: true, overlay: true, imagen: getImagenJefe(n),
            titulo: 'Jefe #' + n, nivelTxt: 'Elige tu enemigo', dano: DANO_JEFE, botin: jd[0], potenciadores: jd[1] };
    }
    if (clase === 'guardian') {
        return { clase: clase, numero: 1, combate: true, overlay: true, imagen: IMAGEN_GUARDIAN,
            titulo: 'Guardi\u00e1n de la Bebida', nivelTxt: String(GUARDIAN_NIVEL), nivel: GUARDIAN_NIVEL,
            dano: GUARDIAN_DANO, botin: 0, potenciadores: 0, requierePot: GUARDIAN_POT_REQUERIDOS };
    }
    if (clase === 'recompensa') {
        var r = RECOMPENSAS_HEX[n] || RECOMPENSAS_HEX[1];
        return { clase: clase, numero: n, combate: false, overlay: false, imagen: r.imagen, tile: r.imagen,
            titulo: 'Recompensa', botin: r.botin, potenciadores: r.potenciadores, dano: 0 };
    }
    if (clase === 'portal') {
        return { clase: clase, numero: n, combate: false, overlay: false, imagen: IMAGEN_PORTAL_HEX, tile: IMAGEN_PORTAL_HEX,
            titulo: 'Portal', botin: 0, potenciadores: 0, dano: 0 };
    }
    var e = getEnemigo(n);
    return { clase: 'monstruo', numero: n, combate: true, overlay: true, imagen: getImagenMonstruo(n),
        titulo: 'Monstruo #' + n, nivelTxt: String(e.nivel), nivel: e.nivel, dano: e.dano,
        botin: e.botin, potenciadores: e.potenciadores };
}

window.getContenidoHex = getContenidoHex;
window.getEnemigo = getEnemigo;
window.textoRecompensa = textoRecompensa;
