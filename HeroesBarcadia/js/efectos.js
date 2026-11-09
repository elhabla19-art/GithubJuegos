// efectos.js
// ===== USO DE CARTAS DE BOTIN, POTENCIADORES (EQUIPO) Y HABILIDADES DE HEROES =====
// Los dados, los gritos, las canciones, etc. ocurren FUERA de la pagina. La pagina
// lleva el estado: salud, manos, mazos, descartes, posiciones y niveles de combate.
// Los efectos que cambian ese estado se aplican solos; el resto se anuncia en el
// Registro (la carta igual se descarta) y los jugadores lo resuelven en la mesa.
//
// Toda la aleatoriedad (carta robada al azar, etc.) la decide quien juega la carta
// y viaja en "params", asi todos los clientes llegan al mismo resultado.

var MAX_POTENCIADORES = 3;
var MAX_REGISTRO = 40;

var DATOS_HEROES = {
    1: 'Entre turnos, puedes intercambiar uno de tus Potenciadores por un Potenciador abandonado en la mazmorra.',
    2: 'Cuando tu salud restante sea de 20 puntos o menos, recibes +2 de ataque contra Monstruos.',
    3: 'Una vez durante el juego, si tu salud llega a cero, puedes tirar el dado. Si sacas un numero par, no mueres y recuperas 10 puntos de salud.',
    4: '+2 de ataque en Duelos, siempre que grites "Hurra" antes de tirar.',
    5: 'Una vez durante el juego, en tu turno, puedes teletransportarte de regreso al punto inicial sin importar donde estes en la mazmorra.',
    6: 'Cuando desarmas una trampa, con exito o sin exito, puedes recogerla y colocarla en una habitacion desocupada de la mazmorra.',
    7: 'Cuando un oponente usa una Carta botin para curarse, puedes tirar el dado. Si sacas un numero par, puedes sanarte 5 puntos.',
    8: 'Una vez durante tu turno, puedes cantar una cancion a un Monstruo con el que vas a luchar. Si lo haces, el Monstruo recibe una reduccion de -1 Nivel solo para esa batalla.'
};

// ===== POTENCIADORES: PASIVOS Y MANUALES =====
// Pasivos: funcionan siempre (bono de ataque, maximo, curaciones...). Manuales: se activan
// con un boton. Los de POT_SIN_LIMITE no tienen limite por turno; los de POT_FUERA_DE_TURNO
// se pueden activar aunque no sea tu turno. El resto: una vez por turno, en tu turno.
// El #5 es pasivo pero aparece como opcion "Potenciador" al elegir un hexagono oculto.
var POT_USABLES = [2, 8, 10, 11, 12, 13, 14, 15, 21, 22, 23, 24, 32, 35, 37, 39, 40, 41, 43, 45, 48, 50, 54, 55, 56, 57, 58, 60];
var POT_SIN_LIMITE = [8, 10, 21, 56];
var POT_FUERA_DE_TURNO = [8, 10, 21];
var POT_AUTO = [2, 5, 8, 12, 10, 11, 13, 14, 15, 21, 22, 23, 24, 32, 35, 37, 39, 40, 41, 43, 45, 48, 50, 54, 55, 56, 57, 58, 60];
// Botin que la pagina resuelve sola (el resto se anuncia y se resuelve en la mesa)
// (todos menos el 32, que mueve habitaciones a una ubicacion nueva)
var BOTIN_AUTO = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33];

// ===== AYUDAS =====
function nom(pid) { return playersData[pid] ? playersData[pid].name : '---'; }
function logReg(txt) {
    partida.registro.push(txt);
    while (partida.registro.length > MAX_REGISTRO) partida.registro.shift();
}
// Un Potenciador volteado (Potenciador 50) no cuenta ni se puede usar
// (Dado del Caos 19: sin Potenciadores hasta tu siguiente turno)
function tienePot(j, n) {
    return !!j && (j.manoPot || []).indexOf(n) !== -1 && !(j.volteados && j.volteados[n]) && !j.sinPot;
}
function maxPot(j) { return (j && (j.manoPot || []).indexOf(4) !== -1) ? 4 : MAX_POTENCIADORES; }
function claveTurno() { return partida.ronda + ':' + partida.turnoIdx; }
function yaUsadoTurno(j, clave) { return !!(j.usadas && j.usadas[clave] === claveTurno()); }
function marcarUsadoTurno(j, clave) { j.usadas = j.usadas || {}; j.usadas[clave] = claveTurno(); }
function quitarCarta(lista, n) {
    var i = lista.indexOf(n);
    if (i === -1) return false;
    lista.splice(i, 1);
    return true;
}
function mismoConjunto(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var x = a.slice().sort(function(p, q) { return p - q; }).join(',');
    var y = b.slice().sort(function(p, q) { return p - q; }).join(',');
    return x === y;
}
// "Barajar" una carta en un mazo de forma determinista (igual en todos los clientes)
function mazoInsertar(lista, n) {
    var pos = (lista.length * 7 + n * 13 + partida.ronda * 3) % (lista.length + 1);
    lista.splice(pos, 0, n);
}
function robarBotin(j, k) {
    var c = partida.mazos.botin.splice(0, k);
    j.manoBotin = (j.manoBotin || []).concat(c);
    return c.length;
}
// Todo Potenciador que entra a una mano pasa por aqui (el #52 vuelve al mazo y se roba otro)
function recibirPot(j, n) {
    j.manoPot.push(n);
    if (n === 52) resolver52(j);
}
function pidDe(j) {
    for (var p in partida.jugadores) if (partida.jugadores[p] === j) return p;
    return null;
}
function resolver52(j) {
    quitarCarta(j.manoPot, 52);
    mazoInsertar(partida.mazos.potenciadores, 52);
    var mz = partida.mazos.potenciadores;
    var idx = -1;
    for (var i = 0; i < mz.length; i++) { if (mz[i] !== 52) { idx = i; break; } }
    var pid = pidDe(j);
    logReg('Potenciador #52: ' + nom(pid) + ' debe tirar el Dado del Caos. La carta vuelve al mazo y se roba un Potenciador nuevo.');
    if (idx >= 0) j.manoPot.push(mz.splice(idx, 1)[0]);
    if (pid) partida.pendientes.push({ pid: pid, tipo: 'caos' });
}

// Potenciadores abandonados en la mazmorra (con la habitacion donde quedaron)
function abandonarPot(n, hexIdDonde) {
    partida.descartePot.push(n);
    partida.potUbic = partida.potUbic || {};
    partida.potUbic[n] = hexIdDonde || null;
}

// Posicion en el orden de turnos: -1 = izquierda, +1 = derecha
function vecinoOrden(pid, d) {
    var i = partida.orden.indexOf(pid);
    if (i < 0 || partida.orden.length < 2) return null;
    return partida.orden[(i + d + partida.orden.length) % partida.orden.length];
}
function distanciaHex(a, b) {
    var dq = a.q - b.q, dr = a.r - b.r;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
function hexOcupadoPorAlguien(id) { return !!hexesOcupados()[id]; }

// ===== REUBICAR HABITACIONES (Botin 32, Dado del Caos 12): sin islas =====
// Celdas libres donde se puede colocar la habitacion hexId, junto a otra habitacion y
// sin que ninguna quede aislada del resto.
function celdasReubicacion(idHab) {
    var resto = partida.hexes.filter(function(h) { return h.id !== idHab; });
    var mapa = {};
    resto.forEach(function(h) { mapa[h.id] = h; });
    var cand = {};
    resto.forEach(function(h) {
        HEX_DIRS.forEach(function(d) {
            var q = h.q + d[0], r = h.r + d[1];
            var nid = hexId(q, r);
            if (!mapa[nid] && nid !== idHab) cand[nid] = { q: q, r: r, id: nid };
        });
    });
    function conectado(extra) {
        var todos = resto.concat(extra ? [extra] : []);
        if (!todos.length) return true;
        var set = {};
        todos.forEach(function(h) { set[hexId(h.q, h.r)] = true; });
        var visto = {}, cola = [todos[0]];
        visto[hexId(todos[0].q, todos[0].r)] = true;
        while (cola.length) {
            var cur = cola.shift();
            HEX_DIRS.forEach(function(d) {
                var nid = hexId(cur.q + d[0], cur.r + d[1]);
                if (set[nid] && !visto[nid]) { visto[nid] = true; cola.push({ q: cur.q + d[0], r: cur.r + d[1] }); }
            });
        }
        return Object.keys(visto).length === todos.length;
    }
    var res = [];
    for (var k in cand) { if (conectado(cand[k])) res.push(cand[k]); }
    return res;
}
// Habitaciones que se pueden reubicar: desocupadas, del calabozo y que no sean el Guardian
function habitacionesReubicables() {
    var oc = hexesOcupados();
    return partida.hexes.filter(function(h) {
        return h.tipo === 'calabozo' && h.clase !== 'guardian' && !oc[h.id] && celdasReubicacion(h.id).length > 0;
    });
}
function reubicarHab(idHab, q, r) {
    var h = buscarHex(idHab);
    if (!h || h.tipo !== 'calabozo' || h.clase === 'guardian' || hexOcupadoPorAlguien(idHab)) return false;
    var ok = celdasReubicacion(idHab).some(function(c) { return c.q === q && c.r === r; });
    if (!ok) return false;
    var nuevo = hexId(q, r);
    for (var p in partida.jugadores) {
        if (partida.jugadores[p].ultimoLibre === idHab) partida.jugadores[p].ultimoLibre = nuevo;
    }
    for (var n in partida.potUbic) { if (partida.potUbic[n] === idHab) partida.potUbic[n] = nuevo; }
    h.q = q; h.r = r; h.id = nuevo;
    return true;
}

// Salud
function aplicarDano(pid, cant) {
    var j = partida.jugadores[pid];
    if (!j || cant <= 0) return;
    if (j.inmune) {   // Dado del Caos 6
        logReg(nom(pid) + ' es inmune al dano hasta el inicio de su siguiente turno.');
        return;
    }
    j.vida = Math.max(0, getVida(j) - cant);
    if (j.vida === 0) {
        if (tienePot(j, 47)) {   // Potenciador 47: vuelve al mazo y recuperas 20
            quitarCarta(j.manoPot, 47);
            mazoInsertar(partida.mazos.potenciadores, 47);
            j.vida = 20;
            logReg(nom(pid) + ' llego a 0 de salud: el Potenciador #47 lo salva (20 de salud).');
        } else {
            var h3 = j.heroe === 3 && !(j.usos && j.usos.h3);
            logReg(nom(pid) + ' llego a 0 de salud' + (h3 ? ' (puede usar la habilidad de su heroe).' : '.'));
        }
    }
}
// conBonus: el Potenciador 16 suma 5 a las curaciones de Botin o Potenciador
function curar(pid, cant, conBonus) {
    var j = partida.jugadores[pid];
    if (!j) return;
    var extra = (conBonus && tienePot(j, 16)) ? 5 : 0;
    j.vida = Math.min(VIDA_INICIAL_HEROE, getVida(j) + cant + extra);
}

// Un jugador le roba una carta a otro: el Potenciador 51 de la victima le hace 5 de dano
function robo51(ladronId, victimaId) {
    if (tienePot(partida.jugadores[victimaId], 51)) {
        aplicarDano(ladronId, 5);
        logReg('El Potenciador #51 de ' + nom(victimaId) + ' hiere a ' + nom(ladronId) + ' (-5).');
    }
}

// Estado de un Potenciador para mostrarlo: 'activo' (pasivo), 'usable', 'usado' (este turno) o 'volteado'
function estadoPot(j, n) {
    if (j.sinPot || (j.volteados && j.volteados[n])) return 'volteado';
    if (POT_USABLES.indexOf(n) === -1) return 'activo';
    if (POT_SIN_LIMITE.indexOf(n) !== -1) return 'usable';
    return yaUsadoTurno(j, 'p' + n) ? 'usado' : 'usable';
}

// Un Portal Magico es un hexagono portal o el central. Condicion del Potenciador 37:
// estar en un portal o en una habitacion adyacente a uno.
function cercaDePortal(pid) {
    var j = partida.jugadores[pid];
    var h = j ? buscarHex(j.posicion) : null;
    if (!h) return false;
    function esPortal(x) { return x.tipo === 'centro' || (x.clase === 'portal' && x.desbloqueado); }
    if (esPortal(h)) return true;
    return vecinosDe(h).some(esPortal);
}

function hexesOcupadosPorOtros(pid) {
    var o = {};
    for (var p in partida.jugadores) if (p !== pid) o[partida.jugadores[p].posicion] = true;
    return o;
}
function hexesOcupados() {
    var o = {};
    for (var pid in partida.jugadores) o[partida.jugadores[pid].posicion] = true;
    return o;
}

// Trampas: Potenciador 53 (los oponentes no pueden colocar trampas junto a ti)
function bloqueadoPor53(hexId, pid) {
    for (var o in partida.jugadores) {
        if (o === pid) continue;
        var oj = partida.jugadores[o];
        if (!tienePot(oj, 53)) continue;
        var oh = buscarHex(oj.posicion);
        if (oh && vecinosDe(oh).some(function(v) { return v.id === hexId; })) return true;
    }
    return false;
}
// Se puede poner una trampa en cualquier habitacion revelada que no ocupe otro jugador
// (ni la de inicio, ni el central, ni el Deposito de Bebidas = el Guardian).
function puedeTrampa(h, pid) {
    return !!h && h.tipo === 'calabozo' && h.desbloqueado && h.clase !== 'guardian' && (h.trampas || 0) < 3 &&
        !bloqueadoPor53(h.id, pid) && !hexesOcupadosPorOtros(pid)[h.id];
}

function intercambiarContenido(idA, idB) {
    var a = buscarHex(idA), b = buscarHex(idB);
    if (!a || !b) return false;
    ['clase', 'numero', 'desbloqueado', 'despejado'].forEach(function(k) {
        var t = a[k]; a[k] = b[k]; b[k] = t;
    });
    return true;
}

// ===== EFECTOS AL INICIAR / TERMINAR TURNO =====
function efectosFinTurno(pid) {
    var j = partida.jugadores[pid];
    if (!j) return;
    // Potenciador 18 (pasivo): si no luchaste en tu turno, te curas 5
    if (tienePot(j, 18) && !partida.luchoEnTurno && !partida.combate) {
        curar(pid, 5, true);
        logReg(nom(pid) + ' no lucho este turno: Potenciador #18 (+5 salud).');
    }
    // Potenciador 50: al terminar su siguiente turno, la carta vuelve a ponerse boca arriba
    for (var n in (j.volteados || {})) {
        if (j.volteados[n] === 'enTurno') delete j.volteados[n];
    }
    if (j.bloqueoBotin === 'enTurno') delete j.bloqueoBotin;
}
function efectosInicioTurno(pid) {
    var j = partida.jugadores[pid];
    if (!j) return;
    delete j.inmune;     // Dado del Caos 6
    delete j.sinPot;     // Dado del Caos 19
    for (var n in (j.volteados || {})) {
        if (j.volteados[n] === 'pendiente') j.volteados[n] = 'enTurno';
    }
    if (j.bloqueoBotin === 'pendiente') j.bloqueoBotin = 'enTurno';
    if (tienePot(j, 28)) {   // Potenciador 28 (pasivo): robas hasta tener 3 Cartas botin
        var falta = 3 - (j.manoBotin || []).length;
        if (falta > 0) {
            var rob = robarBotin(j, falta);
            if (rob) logReg('Inicio del turno de ' + nom(pid) + ': Potenciador #28 roba ' + rob + ' Carta(s) botin.');
        }
    }
    if (tienePot(j, 29)) {   // Potenciador 29 (pasivo): robas una Carta botin de un oponente adyacente
        var h = buscarHex(j.posicion);
        var ady = h ? vecinosDe(h).map(function(x) { return x.id; }) : [];
        var cand = partida.orden.filter(function(o) {
            var oj = partida.jugadores[o];
            return o !== pid && oj && ady.indexOf(oj.posicion) !== -1 && (oj.manoBotin || []).length;
        });
        if (cand.length) {
            var oj2 = partida.jugadores[cand[0]];
            var k = (partida.ronda * 5 + partida.turnoIdx * 3) % oj2.manoBotin.length;
            j.manoBotin.push(oj2.manoBotin.splice(k, 1)[0]);
            robo51(pid, cand[0]);
            logReg('Inicio del turno de ' + nom(pid) + ': Potenciador #29 le roba una Carta botin a ' + nom(cand[0]) + '.');
        }
    }
}

// ===== BONO DE ATAQUE (equipo + habilidades pasivas) =====
// Es lo que se suma al dado (que se tira fuera de la pagina).
function calcularBonoAtaque(pid, ct) {
    var j = partida.jugadores[pid];
    var res = { total: 0, fuentes: [] };
    if (!j) return res;
    var esMon = ct.clase === 'monstruo', esJefe = ct.clase === 'jefe', esDuelo = ct.clase === 'duelo';
    var nivel = (ct.nivel || 0) + (partida.combate ? (partida.combate.nivelMod || 0) : 0);
    (j.manoPot || []).forEach(function(n) {
        if (!tienePot(j, n)) return;
        var v = 0;
        if (esMon) {
            if ([19, 25, 26, 27, 20].indexOf(n) !== -1) v = 1;
            if ([2, 34, 49, 7].indexOf(n) !== -1) v = 2;
            if (n === 13 && yaUsadoTurno(j, 'p13')) v = 3;   // manual: activado este turno
            if (n === 61 && nivel >= 10) v = 3;
            if (n === 58) v = -1;
            if (n === 63) v = ((j.manoBotin || []).length === 3) ? 3 : 1;
        } else if (esDuelo) {
            if (n === 7) v = 2;
            if (n === 20) v = 1;
            if (n === 30) v = 5;
        } else if (esJefe) {
            if ([20, 62].indexOf(n) !== -1) v = 1;
            if ([3, 6].indexOf(n) !== -1) v = 2;
            if (n === 13 && yaUsadoTurno(j, 'p13')) v = 3;
        }
        if (v) { res.total += v; res.fuentes.push('Potenciador #' + n + ' (' + (v > 0 ? '+' : '') + v + ')'); }
    });
    // Bonos manuales de este turno: #22 (antes de un Monstruo) y #32 (Monstruo o Jefe)
    var b = j.bonos || {};
    if (esMon && b.p22 && b.p22.clave === claveTurno()) { res.total += b.p22.val; res.fuentes.push('Potenciador #22 (+' + b.p22.val + ')'); }
    if ((esMon || esJefe) && b.p32 && b.p32.clave === claveTurno()) { res.total += b.p32.val; res.fuentes.push('Potenciador #32 (+' + b.p32.val + ')'); }
    if (j.heroe === 4 && esDuelo) { res.total += 2; res.fuentes.push('Heroe 4 (+2, gritando Hurra)'); }
    if (j.heroe === 2 && esMon && getVida(j) <= 20) { res.total += 2; res.fuentes.push('Heroe 2 (+2)'); }
    return res;
}

// ===== BOTIN =====
function aplicarUsarBotin(pid, n, p, version) {
    var j = partida.jugadores[pid];
    if (!j || !DATOS_BOTIN[n]) return false;
    if (!quitarCarta(j.manoBotin || [], n)) return false;
    partida.descarteBotin.push(n);
    p = p || {};
    var detalle;
    if (n === 20 && p.copia) {
        // Botin 20: resuelve el efecto de la ultima carta jugada por un oponente como si la hubieras jugado tu
        detalle = 'copia el Botin #' + p.copia + ' \u2192 ' + efectoBotin(pid, j, p.copia, p.p || {});
    } else {
        detalle = efectoBotin(pid, j, n, p);
        if (n !== 20) partida.ultimoBotin = { pid: pid, n: n, params: p };
    }
    var auto = BOTIN_AUTO.indexOf(n) !== -1;
    logReg(nom(pid) + ' uso Botin #' + n + ': ' + DATOS_BOTIN[n][1] + '.' +
        (detalle ? ' \u2192 ' + detalle : '') + (auto ? '' : ' (se resuelve en la mesa)'));
    // Potenciador 46 (pasivo): si un oponente juega una carta con "Nivel", recuperas 5
    if (DATOS_BOTIN[n][1].indexOf('Nivel') !== -1) {
        for (var o in partida.jugadores) {
            if (o !== pid && tienePot(partida.jugadores[o], 46)) {
                curar(o, 5, true);
                logReg(nom(o) + ' recupera 5 de salud (Potenciador #46).');
            }
        }
    }
    if (version) partida.version = version;
    return true;
}

function avisoHeroe7(pid) {
    for (var o in partida.jugadores) {
        if (o !== pid && partida.jugadores[o].heroe === 7) return ' ' + nom(o) + ' (Heroe 7) puede tirar el dado para sanarse 5.';
    }
    return '';
}

function efectoBotin(pid, j, n, p) {
    var c = partida.combate;
    var o = p.objetivo ? partida.jugadores[p.objetivo] : null;
    switch (n) {
        case 1: case 16:
            if (c) { c.nivelMod = (c.nivelMod || 0) + (n === 1 ? 4 : 2); return 'el monstruo gana +' + (n === 1 ? 4 : 2) + ' de Nivel en esta batalla'; }
            return 'no habia combate';
        case 9:
            if (c) { c.nivelMod = (c.nivelMod || 0) - 4; return 'el monstruo pierde 4 de Nivel en esta batalla'; }
            return 'no habia combate';
        case 4:
            // La primera trampa va donde elijas (habitacion revelada y no ocupada por otro jugador);
            // con el Potenciador 33 se colocan 2 mas en habitaciones distintas adyacentes a la primera.
            var h4 = buscarHex(p.hex || j.posicion);
            var colocadas = 0;
            if (puedeTrampa(h4, pid)) { h4.trampas = (h4.trampas || 0) + 1; colocadas++; }
            if (h4 && tienePot(j, 33)) {
                (p.extra || []).forEach(function(id) {
                    var hx = buscarHex(id);
                    if (hx && hx.id !== h4.id && puedeTrampa(hx, pid)) { hx.trampas = (hx.trampas || 0) + 1; colocadas++; }
                });
            }
            return colocadas ? colocadas + ' trampa(s) colocada(s)' : 'no se pudo colocar la trampa';
        case 10:
            var h10 = buscarHex(p.hex);
            if (!h10 || h10.desbloqueado) return 'sin efecto';
            if (h10.clase === 'guardian') {   // no se puede pelear con el Guardian
                h10.desbloqueado = true;
                partida.movido = true;
                return 'se revela el Deposito de Bebidas (no se puede pelear con el)';
            }
            var r10 = aplicarEntrar(pid, p.hex, null);
            if (r10 && !r10.combate) {
                partida.ultimaEntrada = { pid: pid, enemigo: r10.contenido, botin: r10.botin, potenciadores: r10.potenciadores, titulo: r10.contenido.titulo };
            }
            return nom(pid) + ' revela una habitacion y se mueve hacia ella (cuenta como accion)';
        case 11:
            var sn = partida.ultimaRetirada;
            if (sn && sn.pid === pid && partida.jugadores[sn.danado]) {
                partida.jugadores[sn.danado].vida = sn.vidaDanado;
                j.ultimoLibre = sn.ultimoLibre;
                j.posicion = sn.pos;
                partida.pendientes = partida.pendientes.filter(function(q) { return !(q.pid === pid && (q.tipo === 'p42' || q.tipo === 'p59')); });
                partida.turnoIdx = sn.turnoIdx; partida.ronda = sn.ronda;
                partida.pasos = sn.pasos; partida.movido = true; partida.luchoEnTurno = true;
                partida.combate = { pid: pid, hexId: sn.hexId, origenId: sn.origenId, nivelMod: sn.nivelMod, ventaja: sn.ventaja, desventaja: sn.desventaja };
                partida.ultimaRetirada = null;
                return 'se ignora el resultado: los que participaron vuelven a tirar (la batalla se repite)';
            }
            return 'no habia una batalla perdida';
        case 19:
            j.mirada = true;
            return 'el primer oponente que haga contacto visual con ' + nom(pid) + ' recibe 10 de dano (queda armada hasta que se inflija)';
        case 21:
            if (c) { c.ventaja = true; c.desventaja = false; return 'tira el dado dos veces y usa el mas alto (niega Desventaja)'; }
            return 'no habia combate';
        case 22:
            if (c) { c.desventaja = true; c.ventaja = false; return 'el oponente tira el dado dos veces y usa el mas bajo (niega Ventaja)'; }
            return 'no habia combate';
        case 24:
            var botin24 = [];
            partida.orden.forEach(function(x) {
                var xj = partida.jugadores[x];
                if (x === pid || !xj || !xj.manoBotin.length) return;
                var k = ((p.rnd && p.rnd[x]) || 0) % xj.manoBotin.length;
                botin24.push(xj.manoBotin.splice(k, 1)[0]);
            });
            var gj = partida.jugadores[p.ganador];
            if (gj) { gj.manoBotin = gj.manoBotin.concat(botin24); return nom(p.ganador) + ' saco el numero mas alto y se queda con ' + botin24.length + ' carta(s)'; }
            return 'sin efecto';
        case 25:
            if (o && p.monto > 0) {
                curar(pid, p.monto, false);
                aplicarDano(p.objetivo, p.monto);
                return nom(p.objetivo) + ' recibe en su lugar ' + p.monto + ' de dano';
            }
            return 'sin efecto';
        case 26:
            if (c && c.pid === pid && c.tipo !== 'duelo') {
                var h26 = buscarHex(c.hexId);
                if (h26) h26.ocultarAlSalir = true;   // al salir se vuelve a voltear boca abajo
                partida.combate = null;
                return nom(pid) + ' entra en la habitacion sin pelear ni recibir recompensas';
            }
            return 'sin efecto';
        case 30:
            if (o) { aplicarDano(p.objetivo, 10); return nom(p.objetivo) + ' recibe 10 de dano'; }
            return 'sin efecto';
        case 31:
            var s31 = (p.objetivos || [])[0];
            if (s31 && partida.jugadores[s31]) { aplicarDano(s31, 10); return nom(s31) + ' sonrio primero y recibe 10 de dano'; }
            return 'nadie sonrio';
        case 32:
            return reubicarHab(p.hex, p.q, p.r) ? 'una habitacion se coloca en otra ubicacion (sin islas)' : 'sin efecto';
        case 33:
            if (c && c.pid === pid && c.tipo !== 'duelo' && o) {
                if (p.gano) {
                    var ra = aplicarAtacar(null);
                    if (ra && !ra.duelo) partida.ultimaEntrada = { pid: pid, enemigo: ra.enemigo, botin: ra.botin, potenciadores: ra.potenciadores, titulo: 'Victoria' };
                    return nom(p.objetivo) + ' gano la batalla: ' + nom(pid) + ' recibe la recompensa y ocupa la habitacion';
                }
                aplicarRetirada(null, p.objetivo);
                return nom(p.objetivo) + ' perdio la batalla y recibe el dano en lugar de ' + nom(pid);
            }
            return 'sin efecto';
        case 2:
            partida.pasos = 0; partida.movido = false;
            return nom(pid) + ' puede mover y entrar de nuevo';
        case 3:
            aplicarDano(p.objetivo, 10);
            return nom(p.objetivo) + ' recibe 10 de dano';
        case 5: case 6:
            curar(pid, n === 5 ? 10 : 20, true);
            return nom(pid) + ' recupera ' + (n === 5 ? 10 : 20) + ' de salud.' + avisoHeroe7(pid);
        case 8:
            partida.orden.forEach(function(x) { if (x !== pid) aplicarDano(x, 5); });
            return 'todos los oponentes reciben 5 de dano';
        case 12:
            if (o && quitarCarta(o.manoPot, p.pot)) {
                recibirPot(j, p.pot);
                robo51(pid, p.objetivo);
                return 'roba el Potenciador #' + p.pot + ' de ' + nom(p.objetivo);
            }
            return 'sin efecto';
        case 14:
            if (o && o.manoBotin.length) {
                var carta = o.manoBotin.splice(p.idx % o.manoBotin.length, 1)[0];
                j.manoBotin.push(carta);
                robo51(pid, p.objetivo);
                return 'roba una Carta botin de ' + nom(p.objetivo);
            }
            return 'sin efecto';
        case 23:
            var cnt = 0;
            (p.objetivos || []).forEach(function(x) { if (partida.jugadores[x]) { curar(x, 5, true); cnt++; } });
            curar(pid, 5 * cnt, true);
            return 'cura 5 a ' + cnt + ' oponente(s) y ' + (5 * cnt) + ' a si mismo.' + avisoHeroe7(pid);
        case 27:
            (p.descartar || []).forEach(function(x) { if (quitarCarta(j.manoBotin, x)) partida.descarteBotin.push(x); });
            var rob = partida.mazos.potenciadores.splice(0, 1);
            if (rob.length) recibirPot(j, rob[0]);
            return rob.length ? 'roba un Potenciador del mazo' : 'no quedan Potenciadores en el mazo';
        case 28:
            if (o) {
                var tmp = j.manoBotin; j.manoBotin = o.manoBotin; o.manoBotin = tmp;
                return 'intercambia su mano de Botin con ' + nom(p.objetivo);
            }
            return 'sin efecto';
        case 29:
            // Cada oponente pasa 1 Potenciador (o 1 Botin si no tiene) al jugador de su derecha
            // (el siguiente en el orden de turnos). Primero se calculan los pases y luego se aplican.
            var pases = [];
            partida.orden.forEach(function(x, i) {
                if (x === pid) return;
                var oj = partida.jugadores[x];
                var der = partida.orden[(i + 1) % partida.orden.length];
                var r = (p.rnd && p.rnd[x]) || 0;
                if (oj.manoPot.length) pases.push({ de: x, a: der, lista: 'manoPot', k: r % oj.manoPot.length });
                else if (oj.manoBotin.length) pases.push({ de: x, a: der, lista: 'manoBotin', k: r % oj.manoBotin.length });
            });
            var movidas = pases.map(function(q) {
                return { a: q.a, lista: q.lista, carta: partida.jugadores[q.de][q.lista].splice(q.k, 1)[0] };
            });
            movidas.forEach(function(q) { partida.jugadores[q.a][q.lista].push(q.carta); });
            return pases.length + ' carta(s) pasan al jugador de la derecha';
        case 13:
            if (o && buscarHex(p.hex)) { fijarPosicion(o, p.hex); return nom(p.objetivo) + ' es movido a otra habitacion'; }
            return 'sin efecto';
        case 17:
            if (buscarHex(p.hex)) { fijarPosicion(j, p.hex); return nom(pid) + ' se mueve a una habitacion revelada'; }
            return 'sin efecto';
        case 18:
            var h18 = buscarHex(p.hex);
            if (h18) { h18.desbloqueado = false; h18.despejado = false; return 'un enemigo derrotado vuelve a activarse (habitacion boca abajo)'; }
            return 'sin efecto';
        case 15:
            return nom(pid) + ' echa un vistazo a una habitacion oculta';
        case 7:
            return intercambiarContenido(p.a, p.b) ? 'dos habitaciones intercambian su contenido' : 'sin efecto';
    }
    return '';
}

// ===== POTENCIADORES (EQUIPO) =====
// p = { nums: [...], forzado: bool }. Con el #9 (pasivo), cada Potenciador que sobra se
// baraja de vuelta al mazo y robas 2 Cartas botin por cada uno.
function aplicarDescartarPot(pid, p, version) {
    var j = partida.jugadores[pid];
    if (!j) return false;
    p = p || {};
    var tenia9 = tienePot(j, 9);
    var hechos = [], extra = 0;
    (p.nums || []).forEach(function(n) {
        if (quitarCarta(j.manoPot, n)) {
            if (p.forzado && tenia9) { mazoInsertar(partida.mazos.potenciadores, n); extra++; }
            else abandonarPot(n, j.posicion);
            hechos.push('#' + n);
        }
    });
    if (!hechos.length) return false;
    if (extra) robarBotin(j, 2 * extra);
    logReg(nom(pid) + ' descarta Potenciador ' + hechos.join(', ') +
        (extra ? ' (Potenciador #9: vuelven al mazo y roba ' + (2 * extra) + ' Carta(s) botin).' : ' (queda abandonado en la mazmorra).'));
    if (version) partida.version = version;
    return true;
}

function aplicarUsarPot(pid, n, p, version) {
    var j = partida.jugadores[pid];
    if (!j || !tienePot(j, n)) return false;
    if (POT_USABLES.indexOf(n) === -1 && n !== 5) return false;
    p = p || {};
    var detalle = '';
    var o = p.objetivo ? partida.jugadores[p.objetivo] : null;
    if (POT_SIN_LIMITE.indexOf(n) === -1) marcarUsadoTurno(j, 'p' + n);
    switch (n) {
        case 2:
            if (o && quitarCarta(o.manoPot, p.pot)) {
                quitarCarta(j.manoPot, 2);
                recibirPot(j, p.pot);
                o.manoPot.push(2);
                detalle = 'intercambia el #2 por el #' + p.pot + ' de ' + nom(p.objetivo);
            }
            break;
        case 5:
            detalle = nom(pid) + ' mira en secreto una habitacion oculta'; break;
        case 8:
            var nOps = partida.orden.filter(function(x) { return x !== pid && partida.jugadores[x]; }).length;
            detalle = 'los oponentes sacaron 1: roba ' + robarBotin(j, 3 * nOps) + ' Carta(s) botin'; break;
        case 10:
            var mz = partida.mazos.potenciadores;
            if (mz.indexOf(p.pot) !== -1) {
                quitarCarta(mz, p.pot);
                quitarCarta(j.manoPot, 10);
                mz.push(10);   // El Topo vuelve al mazo (no se descarta) y el mazo se baraja
                if (p.nuevoMazo && mismoConjunto(p.nuevoMazo, mz)) partida.mazos.potenciadores = p.nuevoMazo.slice();
                recibirPot(j, p.pot);
                detalle = 'toma el Potenciador #' + p.pot + ' del mazo; El Topo vuelve al mazo y se baraja';
            }
            break;
        case 11:
            detalle = 'roba ' + robarBotin(j, 2) + ' Carta(s) botin'; break;
        case 13:
            aplicarDano(pid, 5); detalle = nom(pid) + ' pierde 5 de salud y tiene +3 contra Jefes y Monstruos este turno'; break;
        case 12:
            if (p.par && o) {
                o.bloqueoBotin = 'pendiente';
                detalle = 'salio par: ' + nom(p.objetivo) + ' no podra jugar Cartas botin durante su proximo turno';
            } else detalle = 'salio impar: sin efecto';
            break;
        case 14: case 45:
            (p.objetivos || []).forEach(function(x) { aplicarDano(x, 5); });
            detalle = (p.objetivos || []).length ? (p.objetivos || []).map(nom).join(', ') + ' recibe(n) 5 de dano' : 'todos lo hicieron';
            break;
        case 15:
            aplicarDano(pid, 5); detalle = nom(pid) + ' bebe 5 de salud y repite su tirada'; break;
        case 21:
            aplicarDano(p.objetivo, 10); detalle = nom(p.objetivo) + ' recibe 10 de dano'; break;
        case 22:
            // Le das una Carta botin tuya a un oponente; el tira el dado: par +4 de ataque, impar +1
            if (o && quitarCarta(j.manoBotin, p.carta)) {
                o.manoBotin.push(p.carta);
                j.bonos = j.bonos || {};
                j.bonos.p22 = { clave: claveTurno(), val: p.par ? 4 : 1 };
                detalle = 'da el Botin #' + p.carta + ' a ' + nom(p.objetivo) + '; salio ' + (p.par ? 'par: +4' : 'impar: +1') + ' de ataque contra el Monstruo';
            }
            break;
        case 23:
            var a = p.devolver && p.devolver[0], b = p.devolver && p.devolver[1];
            var tengoAmbas = (a === b) ? j.manoBotin.filter(function(x) { return x === a; }).length >= 2 : (j.manoBotin.indexOf(a) !== -1 && j.manoBotin.indexOf(b) !== -1);
            if (tengoAmbas) {
                quitarCarta(j.manoBotin, a); quitarCarta(j.manoBotin, b);
                var mzb = partida.mazos.botin.concat([a, b]);
                if (p.nuevoMazo && mismoConjunto(p.nuevoMazo, mzb)) mzb = p.nuevoMazo.slice();
                partida.mazos.botin = mzb;
                detalle = 'devuelve 2 Cartas botin al mazo y roba ' + robarBotin(j, 2);
            }
            break;
        case 24: case 37:
            if (buscarHex(p.hex)) {
                fijarPosicion(j, p.hex);
                detalle = nom(pid) + ' se teletransporta a una habitacion revelada';
            }
            break;
        case 32:
            aplicarDano(pid, 5);
            j.bonos = j.bonos || {};
            j.bonos.p32 = { clave: claveTurno(), val: 5 };
            detalle = nom(pid) + ' bebe 5 de salud y suma +5 a su tirada';
            break;
        case 35:
            detalle = nom(pid) + ' mira en secreto una habitacion adyacente'; break;
        case 39:
            aplicarDano(p.objetivo, 5); detalle = nom(p.objetivo) + ' recibe 5 de dano'; break;
        case 40:
            aplicarDano(pid, 5);
            detalle = nom(pid) + ' bebe 5 de salud y roba ' + robarBotin(j, 2) + ' Carta(s) botin';
            break;
        case 41:
            detalle = p.par ? 'salio par: roba ' + robarBotin(j, 1) + ' Carta botin extra' : 'salio impar: sin efecto';
            break;
        case 43:
            detalle = intercambiarContenido(p.a, p.b) ? 'dos habitaciones intercambian su contenido' : '';
            break;
        case 48:
            if (o && o.manoBotin.length) {
                j.manoBotin.push(o.manoBotin.splice(p.idx % o.manoBotin.length, 1)[0]);
                robo51(pid, p.objetivo);
                detalle = 'recibe una Carta botin de ' + nom(p.objetivo);
            }
            break;
        case 50:
            if (p.par && o && (o.manoPot || []).indexOf(p.pot) !== -1) {
                o.volteados = o.volteados || {};
                o.volteados[p.pot] = 'pendiente';
                detalle = 'salio par: el Potenciador #' + p.pot + ' de ' + nom(p.objetivo) + ' queda boca abajo hasta que termine su siguiente turno';
            } else detalle = 'salio impar: sin efecto';
            break;
        case 54:
            var top = partida.mazos.botin.slice(0, 5);
            if (p.orden && mismoConjunto(p.orden, top)) {
                for (var i = 0; i < p.orden.length; i++) partida.mazos.botin[i] = p.orden[i];
                detalle = nom(pid) + ' mira y reordena las primeras 5 Cartas botin del mazo';
            }
            break;
        case 55:
            if (p.par && o) {
                var trampas = o.manoBotin.filter(function(x) { return x === 4; });
                o.manoBotin = o.manoBotin.filter(function(x) { return x !== 4; });
                j.manoBotin = j.manoBotin.concat(trampas);
                if (trampas.length) robo51(pid, p.objetivo);
                detalle = 'salio par: roba ' + trampas.length + ' carta(s) Trampa de ' + nom(p.objetivo);
            } else detalle = 'salio impar: sin efecto';
            break;
        case 56:
            quitarCarta(j.manoPot, 56);
            mazoInsertar(partida.mazos.potenciadores, 56);   // regresa al mazo, no se descarta
            curar(pid, 25, true);
            detalle = nom(pid) + ' devuelve la carta al mazo y recupera 25 de salud.' + avisoHeroe7(pid);
            break;
        case 57:
            if (p.par && o) {
                var mia = j.posicion, suya = o.posicion;
                fijarPosicion(j, suya); fijarPosicion(o, mia);
                detalle = 'salio par: intercambia lugar con ' + nom(p.objetivo);
            } else detalle = 'salio impar: sin efecto';
            break;
        case 58:
            detalle = 'roba ' + robarBotin(j, 1) + ' Carta botin'; break;
        case 60:
            if (partida.combate && quitarCarta(j.manoBotin, p.descartar)) {
                partida.descarteBotin.push(p.descartar);
                partida.combate.nivelMod = (partida.combate.nivelMod || 0) - 3;
                detalle = 'descarta el Botin #' + p.descartar + ': el monstruo pierde 3 de Nivel en esta batalla';
            }
            break;
    }
    var auto = POT_AUTO.indexOf(n) !== -1;
    logReg(nom(pid) + ' uso Potenciador #' + n + (detalle ? ' \u2192 ' + detalle : '') + (auto ? '' : ' (se resuelve en la mesa)') + '.');
    if (version) partida.version = version;
    return true;
}

// ===== RESPUESTAS PENDIENTES (Potenciadores 42 y 59, tras perder contra un Monstruo) =====
function aplicarPendiente(pid, clave, p, version) {
    p = p || {};
    if (clave === 'saltar') {   // el anfitrion salta una respuesta pendiente de un jugador que no responde
        var saltada = partida.pendientes.shift();
        if (saltada) logReg('Se salta la respuesta pendiente de ' + nom(saltada.pid) + '.');
        if (version) partida.version = version;
        return !!saltada;
    }
    var idx = -1;
    for (var i = 0; i < partida.pendientes.length; i++) {
        if (partida.pendientes[i].pid === pid && partida.pendientes[i].tipo === clave) { idx = i; break; }
    }
    if (idx === -1) return false;
    var entrada = partida.pendientes[idx];
    partida.pendientes.splice(idx, 1);
    var j = partida.jugadores[pid];
    if (j && clave === 'p42') {
        if (p.modo === 'par' && partida.jugadores[p.objetivo]) {
            curar(pid, 5, false);   // en lugar de perder 10, pierde 5
            aplicarDano(p.objetivo, 5);
            logReg(nom(pid) + ' (Potenciador #42) saco par: el dano se reparte, ' + nom(p.objetivo) + ' recibe 5 y ' + nom(pid) + ' recupera 5.');
        } else logReg(nom(pid) + ' no uso el Potenciador #42.');
    } else if (j && clave === 'p59') {
        if (p.modo === 'par') logReg(nom(pid) + ' (Potenciador #59) saco par: roba ' + robarBotin(j, 1) + ' Carta botin.');
        else logReg(nom(pid) + ' no obtuvo carta con el Potenciador #59.');
    }
    else if (j && clave === 'caos') {
        var v = Number(p.valor);
        logReg(nom(pid) + ' tira el Dado del Caos: ' + v + ' \u2192 ' + efectoCaos(pid, j, v, p));
    } else if (clave === 'caos14') {
        var para = partida.jugadores[entrada.para], hx = buscarHex(p.hex);
        if (para && hx && hexRevelado(hx) && hx.clase !== 'guardian' && !(hx.trampas > 0) && !hexOcupadoPorAlguien(hx.id)) {
            fijarPosicion(para, hx.id);
            logReg(nom(pid) + ' mueve a ' + nom(entrada.para) + ' a otra habitacion (Dado del Caos 14).');
        } else logReg(nom(pid) + ' no mueve a ' + nom(entrada.para) + ' (Dado del Caos 14).');
    } else if (j && clave === 'caos17') {
        var cartas = entrada.cartas || [];
        (p.dist || []).forEach(function(dest, i) {
            var oj = partida.jugadores[dest];
            if (oj && i < cartas.length && quitarCarta(j.manoBotin, cartas[i])) oj.manoBotin.push(cartas[i]);
        });
        logReg(nom(pid) + ' reparte entre sus oponentes las Cartas botin robadas (Dado del Caos 17).');
    } else if (clave === 'caos12') {
        if (p.hex && reubicarHab(p.hex, p.q, p.r)) logReg(nom(pid) + ' coloca una habitacion en otra ubicacion (Dado del Caos 12).');
        else logReg(nom(pid) + ' no recoloca ninguna habitacion (Dado del Caos 12).');
    }
    if (version) partida.version = version;
    return true;
}


// ===== DADO DEL CAOS (d20: el jugador indica el numero que salio) =====
function efectoCaos(pid, j, v, p) {
    var oc = hexesOcupados();
    switch (v) {
        case 1:
            var falta = Math.max(0, 6 - (j.manoBotin || []).length);
            return 'roba ' + robarBotin(j, falta) + ' Carta(s) botin (hasta tener 6)';
        case 2:
            var h2 = buscarHex(p.hex);
            if (h2 && h2.tipo === 'calabozo' && !h2.desbloqueado && !oc[h2.id]) {
                var ct = getContenidoHex(h2);
                var rr = { botin: [], potenciadores: [] };
                if (ct.clase === 'monstruo') rr = robarRecompensa(j, ct.botin, ct.potenciadores);
                partida.ultimaEntrada = { pid: pid, enemigo: ct, botin: rr.botin, potenciadores: rr.potenciadores, titulo: 'Dado del Caos' };
                return 'revela ' + ct.titulo + (ct.clase === 'monstruo' ? ' y recoge ' + textoRecompensa(ct) : ' (no obtiene nada)') + '; la habitacion queda boca abajo';
            }
            return 'sin efecto';
        case 3:
            var g = null;
            partida.hexes.forEach(function(h) { if (h.clase === 'guardian') g = h; });
            var dest = buscarHex(p.hex);
            if (g && g.desbloqueado && !oc[g.id] && dest && dest.tipo === 'calabozo' && dest.clase !== 'guardian' && !oc[dest.id]) {
                intercambiarContenido(g.id, dest.id);
                return 'el Jefe Final cambia de lugar con otra habitacion';
            }
            return g && g.desbloqueado ? 'sin efecto' : 'el Jefe Final no ha sido revelado';
        case 4:
            var cura = 5 * (j.manoBotin || []).length;
            curar(pid, cura, false);
            return 'recupera ' + cura + ' de salud';
        case 5:
            var movidos = 0;
            (p.mov || []).forEach(function(m) {
                var ub = partida.potUbic[m.n];
                var desde = ub ? buscarHex(ub) : null, hasta = buscarHex(m.hex);
                if (desde && hasta && partida.descartePot.indexOf(m.n) !== -1 && !oc[hasta.id] && distanciaHex(desde, hasta) <= 3) {
                    partida.potUbic[m.n] = hasta.id; movidos++;
                }
            });
            return movidos + ' Potenciador(es) abandonado(s) cambian de habitacion';
        case 6:
            j.inmune = true;
            return 'no puede recibir dano hasta el inicio de su siguiente turno';
        case 7:
            var mt = 0;
            (p.mov || []).forEach(function(m) {
                var a = buscarHex(m.from), b = buscarHex(m.to);
                if (a && b && (a.trampas || 0) > 0 && (b.trampas || 0) < 3 && hexRevelado(b) && !oc[b.id]) {
                    a.trampas--; b.trampas = (b.trampas || 0) + 1; mt++;
                }
            });
            return mt + ' trampa(s) cambian de habitacion';
        case 8:
            var o8 = partida.jugadores[p.objetivo];
            if (o8) { var antes = getVida(j); j.vida = getVida(o8); return 'iguala su salud a la de ' + nom(p.objetivo) + ' (' + antes + ' \u2192 ' + j.vida + ')'; }
            return 'sin efecto';
        case 9:
            var todas = [];
            partida.orden.forEach(function(x) { var xj = partida.jugadores[x]; if (xj) { todas = todas.concat(xj.manoBotin || []); xj.manoBotin = []; } });
            var mazo = partida.mazos.botin.concat(todas);
            if (p.nuevoMazo && mismoConjunto(p.nuevoMazo, mazo)) mazo = p.nuevoMazo.slice();
            partida.mazos.botin = mazo;
            partida.orden.forEach(function(x) { var xj = partida.jugadores[x]; if (xj) robarBotin(xj, 3); });
            return 'todos devuelven sus Cartas botin y cada uno recibe 3';
        case 10:
            var rv = 0;
            (p.hexes || []).forEach(function(id) {
                var h = buscarHex(id);
                if (h && h.tipo === 'calabozo' && h.clase === 'monstruo' && h.desbloqueado && h.despejado && !oc[h.id]) {
                    h.desbloqueado = false; h.despejado = false; rv++;
                }
            });
            return rv + ' Monstruo(s) derrotado(s) vuelven a estar activos (boca abajo)';
        case 11:
            var izq = vecinoOrden(pid, -1);
            if (izq && izq !== pid) {
                var mia = j.posicion, suya = partida.jugadores[izq].posicion;
                fijarPosicion(j, suya); fijarPosicion(partida.jugadores[izq], mia);
                return 'intercambia su posicion con ' + nom(izq) + ' (a su izquierda)';
            }
            return 'sin efecto';
        case 12:
            partida.orden.forEach(function(x) { partida.pendientes.push({ pid: x, tipo: 'caos12' }); });
            return 'cada jugador elegira una habitacion para recolocarla (sin islas)';
        case 13:
            var d13 = 5 * (j.manoPot || []).length;
            aplicarDano(pid, d13);
            return 'recibe ' + d13 + ' de dano (5 por cada Potenciador)';
        case 14:
            var der = vecinoOrden(pid, 1);
            if (der && der !== pid) {
                partida.pendientes.push({ pid: der, tipo: 'caos14', para: pid });
                return nom(der) + ' (a su derecha) decidira a que habitacion lo mueve';
            }
            return 'sin efecto';
        case 15:
            var txt = [];
            partida.orden.forEach(function(x) {
                var r = (p.res || {})[x];
                if (r === 'par') { curar(x, 10, false); txt.push(nom(x) + ' +10'); }
                else if (r === 'impar') { aplicarDano(x, 10); txt.push(nom(x) + ' -10'); }
            });
            return txt.join(', ');
        case 16:
            var hp = buscarHex(p.hex), cen = buscarHex(hexId(0, 0));
            if (hp && cen && j.manoPot.indexOf(p.pot) !== -1 && vecinosDe(cen).some(function(x) { return x.id === hp.id; }) && !oc[hp.id]) {
                quitarCarta(j.manoPot, p.pot);
                abandonarPot(p.pot, hp.id);
                return 'deja el Potenciador #' + p.pot + ' en una habitacion junto al punto de partida';
            }
            return 'sin efecto';
        case 17:
            var k17 = partida.orden.filter(function(x) { return x !== pid && partida.jugadores[x]; }).length;
            var cartas17 = partida.mazos.botin.splice(0, k17);
            j.manoBotin = j.manoBotin.concat(cartas17);
            if (cartas17.length) partida.pendientes.push({ pid: pid, tipo: 'caos17', cartas: cartas17 });
            return 'roba ' + cartas17.length + ' Carta(s) botin para repartir entre sus oponentes';
        case 18:
            j.goblin = true;
            return 'se transforma en Goblin (habla Goblin; rompe la maldicion derrotando un Monstruo)';
        case 19:
            j.sinPot = true;
            return 'no puede usar sus Potenciadores hasta su siguiente turno';
        case 20:
            var mano = (j.manoBotin || []).slice();
            if (mano.length <= 1) return 'sin efecto';
            var keep = p.keep;
            if (!quitarCarta(mano, keep)) return 'sin efecto';
            (p.dist || []).forEach(function(dest, i) {
                var oj = partida.jugadores[dest];
                if (oj && i < mano.length) oj.manoBotin.push(mano[i]);
            });
            j.manoBotin = [keep];
            return 'reparte sus Cartas botin entre sus oponentes y se queda con 1';
    }
    return 'sin efecto';
}

// ===== HABILIDADES DE HEROE =====
function aplicarHabilidad(pid, clave, p, version) {
    var j = partida.jugadores[pid];
    if (!j) return false;
    p = p || {};
    j.usos = j.usos || {};
    switch (clave) {
        case 'h1':
            if (!quitarCarta(j.manoPot, p.mio) || !quitarCarta(partida.descartePot, p.ab)) return false;
            abandonarPot(p.mio, j.posicion);
            delete partida.potUbic[p.ab];
            recibirPot(j, p.ab);
            logReg(nom(pid) + ' (Heroe 1) cambia su Potenciador #' + p.mio + ' por el #' + p.ab + ' abandonado en la mazmorra.');
            break;
        case 'h3':
            if (j.usos.h3 || getVida(j) > 0) return false;
            j.usos.h3 = true;
            if (p.par) { j.vida = 10; logReg(nom(pid) + ' (Heroe 3) saco par: no muere y recupera 10 de salud.'); }
            else logReg(nom(pid) + ' (Heroe 3) saco impar: la habilidad se gasto.');
            break;
        case 'h5':
            if (j.usos.h5) return false;
            var ini = null;
            partida.hexes.forEach(function(h) { if (h.tipo === 'inicio' && h.duenoId === pid) ini = h; });
            if (!ini || hexesOcupadosPorOtros(pid)[ini.id]) return false;
            j.usos.h5 = true;
            fijarPosicion(j, ini.id);
            logReg(nom(pid) + ' (Heroe 5) se teletransporta a su punto inicial.');
            break;
        case 'h7':
            curar(pid, 5, false);
            logReg(nom(pid) + ' (Heroe 7) saco par y se sana 5 puntos.');
            break;
        case 'h8':
            if (!partida.combate || partida.combate.pid !== pid || yaUsadoTurno(j, 'h8')) return false;
            marcarUsadoTurno(j, 'h8');
            partida.combate.nivelMod = (partida.combate.nivelMod || 0) - 1;
            logReg(nom(pid) + ' (Heroe 8) canta al monstruo: -1 Nivel en esta batalla.');
            break;
        case 'goblin':
            var gj = partida.jugadores[p.objetivo];
            if (!gj || !gj.goblin) return false;
            aplicarDano(p.objetivo, 5);
            logReg(nom(pid) + ' descubre que ' + nom(p.objetivo) + ' no habla Goblin: recibe 5 de dano.');
            break;
        case 'mirada':
            if (!j.mirada || !partida.jugadores[p.objetivo]) return false;
            j.mirada = false;
            aplicarDano(p.objetivo, 10);
            logReg(nom(p.objetivo) + ' hizo contacto visual con ' + nom(pid) + ' (Botin #19) y recibe 10 de dano.');
            break;
        default:
            return false;
    }
    if (version) partida.version = version;
    return true;
}

// ===== DESPACHO DE ACCIONES (local y remotas) =====
// tipo: 'botin' | 'pot' | 'desc' | 'hab' | 'pend'
function aplicarAccion(tipo, pid, n, params, version) {
    if (tipo === 'botin') return aplicarUsarBotin(pid, n, params, version);
    if (tipo === 'pot') return aplicarUsarPot(pid, n, params, version);
    if (tipo === 'desc') return aplicarDescartarPot(pid, params, version);
    if (tipo === 'hab') return aplicarHabilidad(pid, n, params, version);
    if (tipo === 'pend') return aplicarPendiente(pid, n, params, version);
    return false;
}

window.aplicarAccion = aplicarAccion;
window.calcularBonoAtaque = calcularBonoAtaque;
