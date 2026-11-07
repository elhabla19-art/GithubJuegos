// tablero.js
// ===== GEOMETRIA Y GENERACION DEL TABLERO HEXAGONAL =====
// Coordenadas axiales (q, r). El hexagono central es (0,0). Los hexagonos de
// inicio de cada jugador son vecinos directos del central (anillo 1). El
// calabozo son 30 hexagonos repartidos en los anillos 1 (los que sobren),
// 2 y 3.

// 'flat' = lado plano arriba/abajo y puntas a los lados (⬣). 'pointy' = punta arriba (⬢).
// Si tus PNG de hexagono se ven girados, cambia este valor.
var HEX_ORIENTACION = 'flat';
// Escala de la imagen del hexagono respecto a su celda (1 = justo encaja).
// Subelo un poco (1.02-1.05) si quedan rendijas entre hexagonos.
var HEX_ESCALA_IMG = 1.0;
var HEX_SIZE = 50; // radio del hexagono en unidades del SVG

var TOTAL_HEX_CALABOZO = 30;
var MAX_JUGADORES = 6;       // el central solo tiene 6 vecinos
var TOTAL_HEROES = 8;        // Heroes_1.jpg ... Heroes_8.jpg
var TOTAL_MONSTRUOS = 33;    // Monstruo_1.png ... Monstruo_33.png

var HEX_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

// ===== IMAGENES =====
function getImagenHexagono(tipo) {
    if (tipo === 'centro') return 'imagenes/hexagonos/HPortal_1.png';
    if (tipo === 'inicio') return 'imagenes/hexagonos/HMadera_1.png';
    return 'imagenes/hexagonos/HPiedra_1.png';
}
function getImagenHeroe(n) { return 'imagenes/heroes/Heroes_' + n + '.jpg'; }
function getImagenMonstruo(n) { return 'imagenes/enemigos/Monstruo_' + n + '.png'; }
function getNombreHeroe(n) { return 'Heroe #' + n; }

// ===== GEOMETRIA =====
function hexId(q, r) { return q + '_' + r; }

function hexAPixel(q, r) {
    var s = HEX_SIZE, k = Math.sqrt(3);
    if (HEX_ORIENTACION === 'flat') {
        return { x: s * 1.5 * q, y: s * (k / 2 * q + k * r) };
    }
    return { x: s * (k * q + k / 2 * r), y: s * 1.5 * r };
}

// Ancho y alto de la celda hexagonal
function hexDimensiones() {
    var k = Math.sqrt(3);
    return HEX_ORIENTACION === 'flat'
        ? { w: 2 * HEX_SIZE, h: k * HEX_SIZE }
        : { w: k * HEX_SIZE, h: 2 * HEX_SIZE };
}

function hexPuntos(cx, cy) {
    var pts = [];
    var offset = HEX_ORIENTACION === 'flat' ? 0 : -30;
    for (var i = 0; i < 6; i++) {
        var a = (60 * i + offset) * Math.PI / 180;
        pts.push((cx + HEX_SIZE * Math.cos(a)).toFixed(2) + ',' + (cy + HEX_SIZE * Math.sin(a)).toFixed(2));
    }
    return pts.join(' ');
}

// Celdas del anillo k, en orden alrededor del centro
function hexAnillo(k) {
    var out = [];
    var q = -k, r = k;
    for (var i = 0; i < 6; i++) {
        for (var j = 0; j < k; j++) {
            out.push({ q: q, r: r });
            q += HEX_DIRS[i][0];
            r += HEX_DIRS[i][1];
        }
    }
    return out;
}

function mezclar(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
}

function rangoNumeros(n) {
    var a = [];
    for (var i = 1; i <= n; i++) a.push(i);
    return a;
}

// ===== GENERACION =====
// Devuelve la lista de hexagonos. ordenIds = jugadores (uno por hexagono de inicio).
function generarTablero(ordenIds) {
    var n = ordenIds.length;
    var anillo1 = hexAnillo(1);

    // Hexagonos de inicio repartidos de forma pareja en el anillo 1
    var slots = [];
    for (var i = 0; i < n; i++) slots.push(Math.round(i * 6 / n) % 6);

    var hexes = [];
    hexes.push({ id: hexId(0, 0), q: 0, r: 0, tipo: 'centro', monstruo: null, desbloqueado: true, despejado: true, duenoId: null });

    var ocupados = {};
    for (var s = 0; s < slots.length; s++) {
        var c = anillo1[slots[s]];
        ocupados[hexId(c.q, c.r)] = true;
        hexes.push({ id: hexId(c.q, c.r), q: c.q, r: c.r, tipo: 'inicio', monstruo: null, desbloqueado: true, despejado: true, duenoId: ordenIds[s] });
    }

    // Celdas del calabozo: anillo 1 libre + anillo 2 completo + parte del anillo 3
    var celdas = anillo1.filter(function(c) { return !ocupados[hexId(c.q, c.r)]; });
    celdas = celdas.concat(hexAnillo(2));
    var faltan = TOTAL_HEX_CALABOZO - celdas.length;
    if (faltan > 0) celdas = celdas.concat(mezclar(hexAnillo(3)).slice(0, faltan));
    celdas = celdas.slice(0, TOTAL_HEX_CALABOZO);

    var monstruos = mezclar(rangoNumeros(TOTAL_MONSTRUOS));
    for (var m = 0; m < celdas.length; m++) {
        hexes.push({
            id: hexId(celdas[m].q, celdas[m].r), q: celdas[m].q, r: celdas[m].r,
            tipo: 'calabozo', monstruo: monstruos[m],
            desbloqueado: false, despejado: false, duenoId: null
        });
    }
    return hexes;
}

// ===== CONSULTAS =====
function buscarHex(id) {
    if (!partida || !partida.hexes) return null;
    for (var i = 0; i < partida.hexes.length; i++) {
        if (partida.hexes[i].id === id) return partida.hexes[i];
    }
    return null;
}

function vecinosDe(hex) {
    var out = [];
    for (var d = 0; d < 6; d++) {
        var v = buscarHex(hexId(hex.q + HEX_DIRS[d][0], hex.r + HEX_DIRS[d][1]));
        if (v) out.push(v);
    }
    return out;
}

// Un hexagono "libre" se puede atravesar para avanzar 2 casillas:
// ya fue desbloqueado y no tiene monstruo activo.
function hexLibre(hex) {
    return !!(hex.desbloqueado && hex.despejado);
}

// Hexagonos a los que puede ir un jugador en su turno: { hexId: pasos }
//  - 1 paso: cualquier vecino.
//  - 2 pasos: a traves de un vecino desbloqueado y despejado.
function calcularAlcance(pid) {
    var res = {};
    var j = partida.jugadores[pid];
    if (!j) return res;
    var origen = buscarHex(j.posicion);
    if (!origen) return res;
    var v1 = vecinosDe(origen);
    v1.forEach(function(h) { res[h.id] = 1; });
    v1.forEach(function(h) {
        if (!hexLibre(h)) return;
        vecinosDe(h).forEach(function(h2) {
            if (h2.id !== origen.id && !res[h2.id]) res[h2.id] = 2;
        });
    });
    return res;
}

window.calcularAlcance = calcularAlcance;
window.buscarHex = buscarHex;
