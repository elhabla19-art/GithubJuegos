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
var POT_AUTO = [2, 5, 8, 10, 11, 13, 14, 15, 21, 22, 23, 24, 32, 35, 37, 39, 40, 41, 43, 45, 48, 50, 54, 55, 56, 57, 58, 60];
// Botin que la pagina resuelve sola (el resto se anuncia y se resuelve en la mesa)
var BOTIN_AUTO = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 17, 18, 23, 27, 28, 29];

// ===== AYUDAS =====
function nom(pid) { return playersData[pid] ? playersData[pid].name : '---'; }
function logReg(txt) {
    partida.registro.push(txt);
    while (partida.registro.length > MAX_REGISTRO) partida.registro.shift();
}
// Un Potenciador volteado (Potenciador 50) no cuenta ni se puede usar
function tienePot(j, n) {
    return !!j && (j.manoPot || []).indexOf(n) !== -1 && !(j.volteados && j.volteados[n]);
}
function maxPot(j) { return tienePot(j, 4) ? 4 : MAX_POTENCIADORES; }
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
function resolver52(j) {
    quitarCarta(j.manoPot, 52);
    mazoInsertar(partida.mazos.potenciadores, 52);
    var mz = partida.mazos.potenciadores;
    var idx = -1;
    for (var i = 0; i < mz.length; i++) { if (mz[i] !== 52) { idx = i; break; } }
    logReg('Potenciador #52: tira el Dado del Caos en la mesa. La carta vuelve al mazo y se roba un Potenciador nuevo.');
    if (idx >= 0) j.manoPot.push(mz.splice(idx, 1)[0]);
}

// Salud
function aplicarDano(pid, cant) {
    var j = partida.jugadores[pid];
    if (!j || cant <= 0) return;
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
    if (j.volteados && j.volteados[n]) return 'volteado';
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
function puedeTrampa(h, pid) {
    return !!h && h.tipo === 'calabozo' && h.desbloqueado && (h.trampas || 0) < 3 && !bloqueadoPor53(h.id, pid);
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
}
function efectosInicioTurno(pid) {
    var j = partida.jugadores[pid];
    if (!j) return;
    for (var n in (j.volteados || {})) {
        if (j.volteados[n] === 'pendiente') j.volteados[n] = 'enTurno';
    }
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
    var detalle = efectoBotin(pid, j, n, p);
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
            var h4 = buscarHex(j.posicion);
            var colocadas = 0;
            if (puedeTrampa(h4, pid)) { h4.trampas = (h4.trampas || 0) + 1; colocadas++; }
            // Potenciador 33: en lugar de 1 trampa se colocan 3, en habitaciones distintas junto a la primera
            if (tienePot(j, 33)) {
                (p.extra || []).forEach(function(id) {
                    var hx = buscarHex(id);
                    if (hx && hx.id !== (h4 && h4.id) && puedeTrampa(hx, pid)) { hx.trampas = (hx.trampas || 0) + 1; colocadas++; }
                });
            }
            return colocadas ? colocadas + ' trampa(s) colocada(s)' : 'no se pudo colocar la trampa';
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
            else partida.descartePot.push(n);
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
        case 14: case 45:
            (p.objetivos || []).forEach(function(x) { aplicarDano(x, 5); });
            detalle = (p.objetivos || []).length ? (p.objetivos || []).map(nom).join(', ') + ' recibe(n) 5 de dano' : 'todos lo hicieron';
            break;
        case 15:
            aplicarDano(pid, 5); detalle = nom(pid) + ' bebe 5 de salud y repite su tirada'; break;
        case 21:
            aplicarDano(p.objetivo, 10); detalle = nom(p.objetivo) + ' recibe 10 de dano'; break;
        case 22:
            j.bonos = j.bonos || {};
            j.bonos.p22 = { clave: claveTurno(), val: p.par ? 4 : 1 };
            detalle = 'salio ' + (p.par ? 'par: +4' : 'impar: +1') + ' de ataque contra el Monstruo';
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
    var idx = -1;
    for (var i = 0; i < partida.pendientes.length; i++) {
        if (partida.pendientes[i].pid === pid && partida.pendientes[i].tipo === clave) { idx = i; break; }
    }
    if (idx === -1) return false;
    partida.pendientes.splice(idx, 1);
    var j = partida.jugadores[pid];
    p = p || {};
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
    if (version) partida.version = version;
    return true;
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
            partida.descartePot.push(p.mio);
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
