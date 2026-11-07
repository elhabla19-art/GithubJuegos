// juego.js
// ===== ESTADO DE LA PARTIDA =====
// Todo lo que cambia durante el juego vive en "partida" y lleva un numero de
// version. Cada accion (iniciar, mover, pasar turno...) sube la version, y los
// demas clientes solo aceptan datos con version mayor. Asi nunca se pisa un
// estado nuevo con uno viejo (por ejemplo un "sync" retenido que llega tarde).
//
// partida = {
//   version, iniciada,
//   hexes: [{ id, q, r, tipo, clase, numero, desbloqueado, despejado, duenoId }],
//          clase (solo calabozo): monstruo | recompensa | portal | jefe | guardian
//   jugadores: { idJugador: { heroe: 1..8, posicion: idHexagono } },
//   orden: [idJugador...],  // orden de turnos
//   turnoIdx, ronda,
//   pasos,  // hexagonos libres recorridos en este turno (max MAX_PASOS)
//   movido, // ya entro a un hexagono sin explorar (termina el movimiento)
//   ganador: null | idJugador  // quien derroto al Guardian
//   combate: null | { pid, hexId, origenId } // enemigo revelado esperando Atacar/Retirada
// }
// jugadores[id] = { heroe, posicion, vida, manoBotin: [n...], manoPot: [n...] }
// mazos = { botin, potenciadores, reglas } -> listas de numeros de carta (tope = indice 0)
// reglasActivas = [n...] reglas ya reveladas
// descarteBotin = [n...] Botin usado; descartePot = [n...] Potenciadores abandonados en la mazmorra
// registro = [texto...] anuncios de lo que se va usando; pasosExtra, luchoEnTurno = banderas del turno
// jugadores[id].usos = { h3, h5 } (habilidades de una vez); .usadas = { clave: turno } (una vez por turno)
function nuevaPartidaVacia(version) {
    return {
        version: version || 0,
        iniciada: false,
        hexes: [],
        jugadores: {},
        orden: [],
        turnoIdx: 0,
        ronda: 1,
        movido: false,
        pasos: 0,
        combate: null,
        ganador: null,
        mazos: { botin: [], potenciadores: [], reglas: [] },
        reglasActivas: [],
        descarteBotin: [],
        descartePot: [],
        registro: [],
        pasosExtra: 0,
        luchoEnTurno: false
    };
}
var partida = nuevaPartidaVacia();

function siguienteVersion() {
    return Math.max((partida.version || 0) + 1, Date.now());
}

function aplicarPartida(p) {
    partida = p || nuevaPartidaVacia();
    // Compatibilidad con partidas guardadas antes de existir los mazos
    if (!partida.mazos) partida.mazos = { botin: [], potenciadores: [], reglas: [] };
    if (!partida.reglasActivas) partida.reglasActivas = [];
    if (!partida.descarteBotin) partida.descarteBotin = [];
    if (!partida.descartePot) partida.descartePot = [];
    if (!partida.registro) partida.registro = [];
    for (var pid in partida.jugadores) {
        var jj = partida.jugadores[pid];
        if (!jj.manoBotin) jj.manoBotin = [];
        if (!jj.manoPot) jj.manoPot = [];
        if (!jj.usos) jj.usos = {};
        if (!jj.usadas) jj.usadas = {};
    }
    gameStarted = !!partida.iniciada;
}

function tengoProgreso() {
    return !!(partida && partida.jugadores && partida.jugadores[myId]);
}
window.tengoProgreso = tengoProgreso;

function soyAnfitrionOLocal() {
    return !currentRoom || hostId === myId;
}

function turnoActualId() {
    if (!partida.iniciada || !partida.orden.length) return null;
    return partida.orden[partida.turnoIdx % partida.orden.length];
}
function esMiTurno() { return turnoActualId() === myId; }

function jugadoresVisibles() {
    return Object.keys(playersData).filter(function(id) {
        return !(typeof isJoiningHidden === 'function' && isJoiningHidden(id));
    });
}

// ===== INICIAR PARTIDA: asigna heroes y coloca el tablero (solo anfitrion) =====
function iniciarJuego() {
    if (currentRoom && hostId !== myId) {
        showNotice(hostId ? 'Solo el anfitrion de la sala puede repartir los heroes.' : 'Todavia no hay un anfitrion asignado en la sala. Espera un momento e intenta de nuevo.');
        return;
    }
    if (partida.iniciada) {
        showNotice('La partida ya esta en curso. Usa "Reiniciar Todo" para empezar otra.');
        return;
    }
    var ids = jugadoresVisibles();
    if (ids.length === 0) {
        showNotice('No hay jugadores en la sala. Espera a que alguien se una.');
        return;
    }
    if (ids.length > MAX_JUGADORES) {
        showNotice('El tablero admite maximo ' + MAX_JUGADORES + ' jugadores (uno por lado del hexagono central). Hay ' + ids.length + ' en la sala.');
        return;
    }

    var orden = mezclar(ids);
    var heroes = mezclar(rangoNumeros(TOTAL_HEROES));
    var hexes = generarTablero(orden);

    var jugadores = {};
    for (var i = 0; i < orden.length; i++) {
        var inicio = null;
        for (var h = 0; h < hexes.length; h++) {
            if (hexes[h].tipo === 'inicio' && hexes[h].duenoId === orden[i]) { inicio = hexes[h]; break; }
        }
        jugadores[orden[i]] = {
            heroe: heroes[i], posicion: inicio ? inicio.id : hexId(0, 0),
            vida: VIDA_INICIAL_HEROE, manoBotin: [], manoPot: [], usos: {}, usadas: {}
        };
    }

    aplicarPartida({
        version: siguienteVersion(),
        iniciada: true,
        hexes: hexes,
        jugadores: jugadores,
        orden: orden,
        turnoIdx: 0,
        ronda: 1,
        movido: false,
        pasos: 0,
        combate: null,
        ganador: null,
        mazos: construirMazos(),
        reglasActivas: [],
        descarteBotin: [],
        descartePot: [],
        registro: [],
        pasosExtra: 0,
        luchoEnTurno: false
    });
    gameInitiator = myId;

    broadcastStart(partida);
    actualizarUI();
    saveSession();
}
window.iniciarJuego = iniciarJuego;

// ===== MOVIMIENTO =====
// Fase 1: caminar hasta MAX_PASOS hexagonos libres. Fase 2: "Entrar" a un
// hexagono adyacente sin explorar (revela el enemigo y abre el combate).
function aplicarMovimiento(pid, hexIdDestino, costo, version) {
    var hex = buscarHex(hexIdDestino);
    var j = partida.jugadores[pid];
    if (!hex || !j) return false;
    j.posicion = hex.id;
    partida.pasos = (partida.pasos || 0) + (costo || 1);
    if (version) partida.version = version;
    return true;
}

function robarRecompensa(j, nBotin, nPot) {
    var cb = partida.mazos.botin.splice(0, nBotin);
    var cp = partida.mazos.potenciadores.splice(0, nPot);
    j.manoBotin = (j.manoBotin || []).concat(cb);
    j.manoPot = (j.manoPot || []).concat(cp);
    return { botin: cb, potenciadores: cp };
}

// Entrar a un hexagono sin explorar. Si hay enemigo, queda un combate pendiente;
// si es una recompensa o un portal, se resuelve al instante.
function aplicarEntrar(pid, hexIdDestino, version) {
    var hex = buscarHex(hexIdDestino);
    var j = partida.jugadores[pid];
    if (!hex || !j) return false;
    var cont = getContenidoHex(hex);
    var origenId = j.posicion;
    hex.desbloqueado = true;
    j.posicion = hex.id;
    partida.movido = true;
    var cartas = { botin: [], potenciadores: [] };
    if (cont.combate) {
        partida.combate = { pid: pid, hexId: hex.id, origenId: origenId, nivelMod: 0 };
        partida.luchoEnTurno = true;
    } else {
        hex.despejado = true;
        cartas = robarRecompensa(j, cont.botin, cont.potenciadores);
        partida.combate = null;
    }
    if (version) partida.version = version;
    return { contenido: cont, combate: cont.combate, botin: cartas.botin, potenciadores: cartas.potenciadores };
}

function validarMiTurno() {
    if (!partida.iniciada) return false;
    if (partida.ganador) { showNotice('La partida ya termino.'); return false; }
    if (!esMiTurno()) { showNotice('No es tu turno.'); return false; }
    if (partida.combate) { showNotice('Primero elige Atacar o Retirada.'); return false; }
    if (partida.movido) { showNotice('Ya entraste a un hexagono. Pasa turno cuando termines.'); return false; }
    return true;
}

function moverJugador(hexIdDestino) {
    if (!validarMiTurno()) return;
    var costo = calcularOpciones(myId).mover[hexIdDestino];
    if (!costo) { showNotice('Solo puedes moverte a hexagonos libres, hasta ' + maxPasosTurno() + ' pasos por turno.'); return; }
    aplicarMovimiento(myId, hexIdDestino, costo, siguienteVersion());
    broadcastMover(hexIdDestino, costo, partida.version);
    actualizarUI();
    saveSession();
}
window.moverJugador = moverJugador;

function entrarHex(hexIdDestino) {
    if (!validarMiTurno()) return;
    if (!calcularOpciones(myId).entrar[hexIdDestino]) {
        showNotice('Solo puedes entrar a un hexagono sin explorar que sea adyacente a donde estas.');
        return;
    }
    var r = aplicarEntrar(myId, hexIdDestino, siguienteVersion());
    broadcastEntrar(hexIdDestino, partida.version);
    actualizarUI();   // si hay enemigo, abre el combate
    saveSession();
    if (r && !r.combate) {
        abrirRecompensa({ enemigo: r.contenido, botin: r.botin, potenciadores: r.potenciadores, titulo: r.contenido.titulo });
    }
}
window.entrarHex = entrarHex;

// ===== TURNOS =====
function aplicarPasarTurno(version) {
    if (!partida.iniciada || !partida.orden.length) return false;
    efectosFinTurno(turnoActualId());
    partida.turnoIdx = (partida.turnoIdx + 1) % partida.orden.length;
    if (partida.turnoIdx === 0) partida.ronda++;
    partida.movido = false;
    partida.pasos = 0;
    partida.pasosExtra = 0;
    partida.luchoEnTurno = false;
    efectosInicioTurno(turnoActualId());
    if (version) partida.version = version;
    return true;
}

function pasarTurno() {
    if (!partida.iniciada) return;
    if (partida.ganador) { showNotice('La partida ya termino.'); return; }
    var c = partida.combate;
    if (c && c.pid === myId) {
        showNotice('Primero elige Atacar o Retirada.');
        return;
    }
    if (!esMiTurno() && !soyAnfitrionOLocal()) {
        showNotice('Solo puedes pasar tu propio turno.');
        return;
    }
    if (c) {
        // El jugador en combate no responde (p. ej. desconectado): el anfitrion lo retira.
        aplicarRetirada(siguienteVersion());
        broadcastRetirada(partida.version);
    } else {
        aplicarPasarTurno(siguienteVersion());
        broadcastPasar(partida.version);
    }
    actualizarUI();
    saveSession();
}
window.pasarTurno = pasarTurno;

// ===== COMBATE =====
function aplicarAtacar(version) {
    var c = partida.combate;
    if (!c) return false;
    var hex = buscarHex(c.hexId);
    var j = partida.jugadores[c.pid];
    if (!hex || !j) { partida.combate = null; return false; }
    var cont = getContenidoHex(hex);
    hex.despejado = true;
    var cartas = robarRecompensa(j, cont.botin, cont.potenciadores);
    if (cont.clase === 'guardian') partida.ganador = c.pid;   // vencer al Guardian gana el juego
    partida.combate = null;
    if (version) partida.version = version;
    return { enemigo: cont, botin: cartas.botin, potenciadores: cartas.potenciadores, ganoJuego: cont.clase === 'guardian' };
}

function aplicarRetirada(version) {
    var c = partida.combate;
    if (!c) return false;
    var hex = buscarHex(c.hexId);
    var j = partida.jugadores[c.pid];
    var dano = 0;
    if (hex) {
        var cont = getContenidoHex(hex);
        dano = cont.dano;
        // Potenciador 1: el dano recibido en batalla contra un Jefe se reduce en 5
        if (cont.clase === 'jefe' && j && tienePot(j, 1)) dano = Math.max(0, dano - 5);
        hex.desbloqueado = false;   // el hexagono vuelve a ocultarse
        hex.despejado = false;
    }
    if (j) {
        aplicarDano(c.pid, dano);
        j.posicion = buscarHex(c.origenId) ? c.origenId : hexId(0, 0);
    }
    partida.combate = null;
    aplicarPasarTurno(version);
    return { dano: dano };
}

function getVida(j) {
    return (j && j.vida !== undefined) ? j.vida : VIDA_INICIAL_HEROE;
}
window.getVida = getVida;

function atacar() {
    var c = partida.combate;
    if (!c || c.pid !== myId) return;
    var hex = buscarHex(c.hexId);
    var j = partida.jugadores[myId];
    if (!hex || !j) return;
    var cont = getContenidoHex(hex);
    if (cont.requierePot && (j.manoPot || []).length < cont.requierePot) {
        showNotice('Necesitas ' + cont.requierePot + ' Potenciadores en tu mano para luchar contra el Guardian (tienes ' + (j.manoPot || []).length + ').');
        return;
    }
    var r = aplicarAtacar(siguienteVersion());
    broadcastAtacar(partida.version);
    cerrarZoom();
    actualizarUI();   // si gano el juego, muestra el aviso de victoria
    saveSession();
    if (r && !r.ganoJuego) abrirRecompensa(r);
}
window.atacar = atacar;

function retirarse() {
    var c = partida.combate;
    if (!c || c.pid !== myId) return;
    var r = aplicarRetirada(siguienteVersion());
    broadcastRetirada(partida.version);
    cerrarZoom();
    actualizarUI();
    saveSession();
    if (r) {
        showNotice('Te retiraste y recibiste ' + r.dano + ' de dano. Vuelves a tu ultimo hexagono libre y pasa el turno.', 'Retirada');
    }
}
window.atacar = atacar;
window.retirarse = retirarse;

// ===== REGLAS (solo anfitrion): revela la siguiente carta del mazo de Reglas =====
function aplicarSacarRegla(version) {
    var r = partida.mazos.reglas.shift();
    if (r === undefined) return false;
    partida.reglasActivas.push(r);
    if (version) partida.version = version;
    return r;
}

function sacarRegla() {
    if (!partida.iniciada || !soyAnfitrionOLocal()) return;
    if (!partida.mazos.reglas.length) { showNotice('No quedan cartas en el mazo de Reglas.'); return; }
    aplicarSacarRegla(siguienteVersion());
    broadcastRegla(partida.version);
    actualizarUI();
    saveSession();
    abrirReglas();
}
window.sacarRegla = sacarRegla;

// ===== JUGADOR ELIMINADO O QUE SALE =====
// Determinista: cada cliente lo aplica por su cuenta al recibir "remove".
function quitarJugadorDeJuego(pid) {
    if (!partida.jugadores[pid]) return;
    if (partida.combate && partida.combate.pid === pid) {
        var hc = buscarHex(partida.combate.hexId);
        if (hc) { hc.desbloqueado = false; hc.despejado = false; }
        partida.combate = null;
    }
    var idx = partida.orden.indexOf(pid);
    // Sus cartas vuelven al fondo de los mazos
    var jq = partida.jugadores[pid];
    partida.mazos.botin = partida.mazos.botin.concat(jq.manoBotin || []);
    partida.mazos.potenciadores = partida.mazos.potenciadores.concat(jq.manoPot || []);
    delete partida.jugadores[pid];
    if (idx !== -1) {
        partida.orden.splice(idx, 1);
        if (idx < partida.turnoIdx) {
            partida.turnoIdx--;
        } else if (idx === partida.turnoIdx) {
            partida.movido = false; // le toca al siguiente, que entra en el mismo indice
            partida.pasos = 0;
        }
        if (partida.orden.length) {
            if (partida.turnoIdx >= partida.orden.length) { partida.turnoIdx = 0; partida.ronda++; }
        } else {
            partida.turnoIdx = 0;
        }
    }
}
window.quitarJugadorDeJuego = quitarJugadorDeJuego;

// ===== UI GENERAL =====
function actualizarUI() {
    var startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        startBtn.disabled = !!partida.iniciada;
        startBtn.textContent = partida.iniciada ? 'Partida en curso' : 'Heroes';
        startBtn.style.display = soyAnfitrionOLocal() ? '' : 'none';
    }
    var passBtn = document.getElementById('passTurnBtn');
    if (passBtn) {
        var combateMio = !!(partida.combate && partida.combate.pid === myId);
        var puedePasar = partida.iniciada && !partida.ganador && !combateMio &&
            (esMiTurno() || (soyAnfitrionOLocal() && !!turnoActualId()));
        passBtn.style.display = partida.iniciada ? '' : 'none';
        passBtn.disabled = !puedePasar;
        passBtn.textContent = (esMiTurno() || !puedePasar) ? 'Pasar turno' : 'Pasar turno (anfitrion)';
    }
    var reglasBtn = document.getElementById('reglasBtn');
    if (reglasBtn) {
        reglasBtn.style.display = partida.iniciada ? '' : 'none';
        reglasBtn.textContent = 'Reglas (' + partida.reglasActivas.length + ')';
    }
    var accBtn = document.getElementById('accionesBtn');
    if (accBtn) accBtn.style.display = (partida.iniciada && tengoProgreso()) ? '' : 'none';
    var resetBtn = document.getElementById('resetGameBtn');
    if (resetBtn) resetBtn.style.display = (hostId === myId) ? '' : 'none';

    renderizarTablero();
    renderizarMiHeroe();
    renderizarMisCartas();
    renderLeaderboard();
    if (typeof renderRegistro === 'function') renderRegistro();
    if (typeof sincronizarModalCombate === 'function') sincronizarModalCombate();
    if (typeof sincronizarVictoria === 'function') sincronizarVictoria();
    if (typeof sincronizarDescarte === 'function') sincronizarDescarte();
}
window.actualizarUI = actualizarUI;

function resetLocalGame(version) {
    aplicarPartida(nuevaPartidaVacia(version || siguienteVersion()));
    gameInitiator = null;
    if (typeof cerrarZoom === 'function') cerrarZoom();
    actualizarUI();
    saveSession();
}
window.resetLocalGame = resetLocalGame;
