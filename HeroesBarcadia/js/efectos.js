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

// Potenciadores con efecto "una vez durante tu turno" que tienen boton Usar
var POT_USABLES = [2, 5, 11, 12, 14, 15, 17, 23, 24, 32, 35, 38, 39, 40, 41, 43, 45, 48, 50, 54, 55, 56, 57, 58, 60];
// Botin que la pagina resuelve sola (el resto se anuncia y se resuelve en la mesa)
var BOTIN_AUTO = [1, 2, 3, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 17, 18, 23, 27, 28, 29];
var POT_AUTO = [2, 15, 32, 38, 39, 40, 48, 56, 58, 60];

// ===== AYUDAS =====
function nom(pid) { return playersData[pid] ? playersData[pid].name : '---'; }
function logReg(txt) {
    partida.registro.push(txt);
    while (partida.registro.length > MAX_REGISTRO) partida.registro.shift();
}
function tienePot(j, n) { return !!j && (j.manoPot || []).indexOf(n) !== -1; }
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
function robarBotin(j, k) {
    var c = partida.mazos.botin.splice(0, k);
    j.manoBotin = (j.manoBotin || []).concat(c);
    return c.length;
}

// Salud
function aplicarDano(pid, cant) {
    var j = partida.jugadores[pid];
    if (!j || cant <= 0) return;
    j.vida = Math.max(0, getVida(j) - cant);
    if (j.vida === 0) {
        if (tienePot(j, 47)) {   // Potenciador 47: vuelve al mazo y recuperas 20
            quitarCarta(j.manoPot, 47);
            partida.mazos.potenciadores.push(47);
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

function hexesOcupados() {
    var o = {};
    for (var pid in partida.jugadores) o[partida.jugadores[pid].posicion] = true;
    return o;
}

// ===== EFECTOS AL INICIAR / TERMINAR TURNO =====
function efectosFinTurno(pid) {
    var j = partida.jugadores[pid];
    if (!j) return;
    // Potenciador 18: si no luchaste en tu turno, te curas 5
    if (tienePot(j, 18) && !partida.luchoEnTurno && !partida.combate) {
        curar(pid, 5, true);
        logReg(nom(pid) + ' no lucho este turno: Potenciador #18 (+5 salud).');
    }
}
function efectosInicioTurno(pid) {
    var j = partida.jugadores[pid];
    if (!j) return;
    if (tienePot(j, 13)) {   // Potenciador 13: bebes 5 de salud
        aplicarDano(pid, 5);
        logReg('Inicio del turno de ' + nom(pid) + ': Potenciador #13 (-5 salud).');
    }
    if (tienePot(j, 28)) {   // Potenciador 28: robas hasta tener 3 Cartas botin
        var falta = 3 - (j.manoBotin || []).length;
        if (falta > 0) {
            var n = robarBotin(j, falta);
            if (n) logReg('Inicio del turno de ' + nom(pid) + ': Potenciador #28 roba ' + n + ' Carta(s) botin.');
        }
    }
}

// ===== BONO DE ATAQUE (equipo + habilidades pasivas) =====
function calcularBonoAtaque(pid, ct) {
    var j = partida.jugadores[pid];
    var res = { total: 0, fuentes: [] };
    if (!j) return res;
    var esMon = ct.clase === 'monstruo', esJefe = ct.clase === 'jefe';
    var nivel = (ct.nivel || 0) + (partida.combate ? (partida.combate.nivelMod || 0) : 0);
    (j.manoPot || []).forEach(function(n) {
        var v = 0;
        if (esMon) {
            if ([19, 25, 26, 27, 20].indexOf(n) !== -1) v = 1;
            if ([2, 34, 49, 7].indexOf(n) !== -1) v = 2;
            if (n === 13) v = 3;
            if (n === 61 && nivel >= 10) v = 3;
            if (n === 58) v = -1;
            if (n === 63) v = ((j.manoBotin || []).length === 3) ? 3 : 1;
        } else if (esJefe) {
            if ([20, 62].indexOf(n) !== -1) v = 1;
            if ([3, 6].indexOf(n) !== -1) v = 2;
            if (n === 13) v = 3;
        }
        if (v) { res.total += v; res.fuentes.push('Potenciador #' + n + ' (' + (v > 0 ? '+' : '') + v + ')'); }
    });
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
                j.manoPot.push(p.pot);
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
            j.manoPot = j.manoPot.concat(rob);
            return rob.length ? 'roba el Potenciador #' + rob[0] : 'no quedan Potenciadores en el mazo';
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
            if (o && buscarHex(p.hex)) { o.posicion = p.hex; return nom(p.objetivo) + ' es movido a otra habitacion'; }
            return 'sin efecto';
        case 17:
            if (buscarHex(p.hex)) { j.posicion = p.hex; return nom(pid) + ' se mueve a una habitacion revelada'; }
            return 'sin efecto';
        case 18:
            var h18 = buscarHex(p.hex);
            if (h18) { h18.desbloqueado = false; h18.despejado = false; return 'un enemigo derrotado vuelve a activarse (habitacion boca abajo)'; }
            return 'sin efecto';
        case 15:
            return nom(pid) + ' echa un vistazo a una habitacion oculta';
        case 7:
            var a = buscarHex(p.a), b = buscarHex(p.b);
            if (a && b) {
                ['clase', 'numero', 'desbloqueado', 'despejado'].forEach(function(k) {
                    var t = a[k]; a[k] = b[k]; b[k] = t;
                });
                return 'dos habitaciones intercambian su contenido';
            }
            return 'sin efecto';
    }
    return '';
}

// ===== POTENCIADORES (EQUIPO) =====
function aplicarDescartarPot(pid, nums, version) {
    var j = partida.jugadores[pid];
    if (!j) return false;
    var hechos = [];
    (nums || []).forEach(function(n) {
        if (quitarCarta(j.manoPot, n)) { partida.descartePot.push(n); hechos.push('#' + n); }
    });
    if (!hechos.length) return false;
    logReg(nom(pid) + ' descarta Potenciador ' + hechos.join(', ') + ' (queda abandonado en la mazmorra).');
    if (version) partida.version = version;
    return true;
}

function aplicarUsarPot(pid, n, p, version) {
    var j = partida.jugadores[pid];
    if (!j || !tienePot(j, n) || POT_USABLES.indexOf(n) === -1) return false;
    p = p || {};
    var detalle = '';
    var o = p.objetivo ? partida.jugadores[p.objetivo] : null;
    if (n !== 56) marcarUsadoTurno(j, 'p' + n);
    switch (n) {
        case 2:
            if (o && quitarCarta(o.manoPot, p.pot)) {
                quitarCarta(j.manoPot, 2);
                j.manoPot.push(p.pot);
                o.manoPot.push(2);
                detalle = 'intercambia el #2 por el #' + p.pot + ' de ' + nom(p.objetivo);
            }
            break;
        case 15: case 32:
            aplicarDano(pid, 5); detalle = nom(pid) + ' bebe 5 de salud'; break;
        case 38:
            partida.pasosExtra = (partida.pasosExtra || 0) + 1; detalle = 'puede moverse un hexagono libre adicional'; break;
        case 39:
            aplicarDano(p.objetivo, 5); detalle = nom(p.objetivo) + ' recibe 5 de dano'; break;
        case 40:
            aplicarDano(pid, 5);
            detalle = nom(pid) + ' bebe 5 de salud y roba ' + robarBotin(j, 2) + ' Carta(s) botin';
            break;
        case 48:
            if (o && o.manoBotin.length) {
                j.manoBotin.push(o.manoBotin.splice(p.idx % o.manoBotin.length, 1)[0]);
                robo51(pid, p.objetivo);
                detalle = 'recibe una Carta botin de ' + nom(p.objetivo);
            }
            break;
        case 56:
            quitarCarta(j.manoPot, 56);
            partida.mazos.potenciadores.push(56);
            curar(pid, 25, true);
            detalle = nom(pid) + ' devuelve la carta al mazo y recupera 25 de salud.' + avisoHeroe7(pid);
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
    logReg(nom(pid) + ' uso Potenciador #' + n + ': ' + DATOS_POTENCIADORES[n] + (detalle ? ' \u2192 ' + detalle : '') +
        (auto ? '' : ' (se resuelve en la mesa)'));
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
            j.manoPot.push(p.ab);
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
            if (!ini) return false;
            j.usos.h5 = true;
            j.posicion = ini.id;
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
// tipo: 'botin' | 'pot' | 'desc' | 'hab'
function aplicarAccion(tipo, pid, n, params, version) {
    if (tipo === 'botin') return aplicarUsarBotin(pid, n, params, version);
    if (tipo === 'pot') return aplicarUsarPot(pid, n, params, version);
    if (tipo === 'desc') return aplicarDescartarPot(pid, (params || {}).nums, version);
    if (tipo === 'hab') return aplicarHabilidad(pid, n, params, version);
    return false;
}

window.aplicarAccion = aplicarAccion;
window.calcularBonoAtaque = calcularBonoAtaque;
