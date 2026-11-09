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

var TOTAL_HEX_CALABOZO = 35;
// Contenido del calabozo: 15 monstruos + 9 recompensas + 1 portal + 9 jefes + 1 guardian = 35
var CANT_MONSTRUOS_TABLERO = 15;
var CANT_RECOMPENSAS_TABLERO = 9;
var CANT_JEFES_TABLERO = 9;
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
// Imagen del hexagono segun su estado: la piedra mientras esta oculto; al
// descubrirlo, recompensas y portales muestran su propio hexagono.
function getImagenTile(hex) {
    if (hex.tipo === 'calabozo' && hex.desbloqueado) {
        var c = getContenidoHex(hex);
        if (c.tile) return c.tile;
    }
    return getImagenHexagono(hex.tipo);
}
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
    hexes.push({ id: hexId(0, 0), q: 0, r: 0, tipo: 'centro', desbloqueado: true, despejado: true, duenoId: null });

    var ocupados = {};
    for (var s = 0; s < slots.length; s++) {
        var c = anillo1[slots[s]];
        ocupados[hexId(c.q, c.r)] = true;
        hexes.push({ id: hexId(c.q, c.r), q: c.q, r: c.r, tipo: 'inicio', desbloqueado: true, despejado: true, duenoId: ordenIds[s] });
    }

    // Celdas del calabozo: anillo 1 libre y luego anillos completos (2, 3...);
    // el ultimo anillo se rellena al azar hasta llegar a TOTAL_HEX_CALABOZO.
    var celdas = anillo1.filter(function(c) { return !ocupados[hexId(c.q, c.r)]; });
    for (var k = 2; celdas.length < TOTAL_HEX_CALABOZO; k++) {
        var anillo = hexAnillo(k);
        var falta = TOTAL_HEX_CALABOZO - celdas.length;
        celdas = celdas.concat(anillo.length <= falta ? anillo : mezclar(anillo).slice(0, falta));
    }

    var contenidos = generarContenidos();
    for (var m = 0; m < celdas.length; m++) {
        hexes.push({
            id: hexId(celdas[m].q, celdas[m].r), q: celdas[m].q, r: celdas[m].r,
            tipo: 'calabozo', clase: contenidos[m].clase, numero: contenidos[m].numero,
            desbloqueado: false, despejado: false, duenoId: null
        });
    }
    return hexes;
}

// Sortea que hay en cada hexagono del calabozo (en orden aleatorio)
function generarContenidos() {
    var lista = [];
    mezclar(rangoNumeros(TOTAL_MONSTRUOS)).slice(0, CANT_MONSTRUOS_TABLERO).forEach(function(n) {
        lista.push({ clase: 'monstruo', numero: n });
    });
    mezclar(POOL_RECOMPENSAS).slice(0, CANT_RECOMPENSAS_TABLERO).forEach(function(n) {
        lista.push({ clase: 'recompensa', numero: n });
    });
    lista.push({ clase: 'portal', numero: 1 });
    mezclar(rangoNumeros(TOTAL_JEFES)).slice(0, CANT_JEFES_TABLERO).forEach(function(n) {
        lista.push({ clase: 'jefe', numero: n });
    });
    lista.push({ clase: 'guardian', numero: 1 });
    return mezclar(lista);
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
// Un hexagono "revelado" se puede pisar sin entrar: ya se descubrio (aunque tenga un
// enemigo sin vencer). Los hexagonos ocultos solo se pueden Entrar.
function hexRevelado(hex) {
    return hex.tipo !== 'calabozo' || !!hex.desbloqueado;
}

// Fija la posicion de un jugador y recuerda el ultimo hexagono libre (completado)
// que ocupo, al que vuelve si se retira de un combate.
function salirDeHex(j, nuevoId) {
    var viejo = buscarHex(j.posicion);
    // Botin 26: al salir de la habitacion donde se entro sin pelear, se vuelve a voltear boca abajo
    if (viejo && viejo.ocultarAlSalir && viejo.id !== nuevoId) {
        viejo.desbloqueado = false;
        viejo.despejado = false;
        viejo.ocultarAlSalir = false;
    }
}
function fijarPosicion(j, hexIdNuevo) {
    salirDeHex(j, hexIdNuevo);
    j.posicion = hexIdNuevo;
    var h = buscarHex(hexIdNuevo);
    if (h && hexLibre(h)) j.ultimoLibre = hexIdNuevo;
}

function hexLibre(hex) {
    return !!(hex.desbloqueado && hex.despejado);
}

// Opciones del jugador en su turno (caminar, retar y entrar se pueden hacer en cualquier orden):
//  - mover:  { hexId: pasos } hexagonos LIBRES (desbloqueados y despejados) a los
//            que puede caminar, pasando solo por hexagonos libres, con los pasos
//            que le queden (maximo MAX_PASOS por turno).
//  - entrar: { hexId: true } hexagonos sin explorar ADYACENTES a donde esta parado.
//            Entrar revela el enemigo y termina el movimiento del turno.
var MAX_PASOS = 2;
// Con el Potenciador 38 (u otros efectos) se permiten pasos extra en el turno
function maxPasosTurno() {
    var base = MAX_PASOS + (partida.pasosExtra || 0);
    var tid = turnoActualId();
    var j = tid ? partida.jugadores[tid] : null;
    if (j && tienePot(j, 38)) base += 1;   // Potenciador 38 (pasivo): un hexagono adicional
    return base;
}

function calcularOpciones(pid) {
    var res = { mover: {}, entrar: {}, previo: {}, rival: {} };
    var j = partida.jugadores[pid];
    if (!j || !partida.iniciada || partida.combate || partida.ganador) return res;
    var origen = buscarHex(j.posicion);
    if (!origen) return res;

    var ocupante = {};
    for (var op in partida.jugadores) {
        if (op !== pid) ocupante[partida.jugadores[op].posicion] = op;
    }

    // Caminar: por hexagonos revelados (aunque no esten completados), hasta los pasos que
    // queden. Un hexagono ocupado solo se puede alcanzar retando a su ocupante, y uno con
    // trampa solo se puede elegir como destino; ninguno de los dos se atraviesa.
    var restantes = maxPasosTurno() - (partida.pasos || 0);
    if (restantes > 0) {
        var dist = {};
        dist[origen.id] = 0;
        var cola = [origen];
        while (cola.length) {
            var cur = cola.shift();
            var d = dist[cur.id];
            if (d >= restantes) continue;
            vecinosDe(cur).forEach(function(v) {
                if (dist[v.id] === undefined && hexRevelado(v)) {
                    dist[v.id] = d + 1;
                    res.previo[v.id] = cur.id;
                    if (ocupante[v.id]) res.rival[v.id] = { pid: ocupante[v.id], costo: d + 1 };
                    else if (!(v.trampas > 0)) cola.push(v);
                }
            });
        }
        // Potenciador 17 (pasivo): saltar sobre una habitacion adyacente (aunque este oculta,
        // ocupada o con trampa) hasta una revelada. Cuesta los 2 pasos.
        if (tienePot(j, 17) && restantes >= 2) {
            vecinosDe(origen).forEach(function(v1) {
                vecinosDe(v1).forEach(function(v2) {
                    if (v2.id === origen.id || dist[v2.id] !== undefined) return;
                    if (!hexRevelado(v2) || v2.clase === 'guardian') return;
                    dist[v2.id] = 2;
                    res.previo[v2.id] = v1.id;
                    if (ocupante[v2.id]) res.rival[v2.id] = { pid: ocupante[v2.id], costo: 2 };
                });
            });
        }
        for (var id in dist) {
            if (id !== origen.id && !res.rival[id]) res.mover[id] = dist[id];
        }
    }

    // Entrar (una vez por turno, antes o despues de caminar): un hexagono oculto o
    // revelado-sin-completar que este junto a ti, o el hexagono revelado donde ya estas.
    if (!partida.movido) {
        vecinosDe(origen).concat([origen]).forEach(function(v) {
            if (v.tipo !== 'calabozo' || v.despejado || ocupante[v.id]) return;
            res.entrar[v.id] = true;
        });
    }
    return res;
}

window.calcularOpciones = calcularOpciones;
window.buscarHex = buscarHex;
