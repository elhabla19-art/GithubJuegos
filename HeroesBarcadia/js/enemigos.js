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

window.getEnemigo = getEnemigo;
window.textoRecompensa = textoRecompensa;
