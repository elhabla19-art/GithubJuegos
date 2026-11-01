// combate.js
// ===== PUNTOS DE CARTA Y ELIMINACIONES =====
// Las cartas tienen "Vida" y "Puntos" (datos de referencia del juego fisico).
// Los combates se resuelven FUERA del programa: el anfitrion registra quien
// elimino la carta de quien (boton "Eliminar carta") y el programa asigna los
// puntos de esa carta al jugador que dio el ultimo golpe.
//
// El puntaje NO se guarda aparte: se calcula sumando los puntos de las cartas
// que cada jugador elimino (recalcularPuntos). Asi nunca se desincroniza.

var puntosPorJugador = {};

// [vida, puntos] de cada carta, en el orden de imagenes/Tipo_1 ... Tipo_10
var STATS_POR_TIPO = {
    menta:     [[3,4],[4,5],[5,4],[4,3],[3,5],[3,3],[3,4],[3,2],[3,3],[4,2]],
    chocolate: [[4,4],[4,4],[3,3],[4,4],[4,5],[4,2],[3,5],[4,3],[3,5],[4,2]],
    caramelo:  [[4,2],[5,2],[5,2],[5,4],[3,5],[4,4],[3,2],[5,2],[4,3],[4,3]]
};

function getStatsCarta(numero) {
    var par = STATS_POR_TIPO[getTipoCarta(numero)][getNumeroEnTipo(numero) - 1];
    return { vida: par[0], puntos: par[1] };
}
function getVidaCarta(numero) { return getStatsCarta(numero).vida; }
function getPuntosCarta(numero) { return getStatsCarta(numero).puntos; }

function buscarCartaPorId(id) {
    for (var i = 0; i < cartas.length; i++) {
        if (cartas[i].id === id) return cartas[i];
    }
    return null;
}

// Saca una carta descartada de juego: la quita de la carta activa y de las
// selecciones de su dueno. Es idempotente.
// ===== ORDEN DE JUEGO =====
// Cada jugador elige UNA vez el orden en que jugara sus cartas
// (playersData[id].ordenCartas = ids en orden). La carta en uso siempre es la
// primera del orden que siga viva: al eliminarla, la siguiente pasa a ser la
// carta en uso sin que el jugador tenga que elegir de nuevo. Es deterministico,
// asi que todos los clientes llegan al mismo resultado.
function cartaVivaId(id) {
    var c = buscarCartaPorId(id);
    return !c || !c.descartada; // una carta que aun no conozco se asume viva
}

function asegurarActivaPorOrden(pid) {
    var d = playersData[pid];
    if (!d) return;
    d.ordenCartas = (d.ordenCartas || []).filter(cartaVivaId);
    if (d.activeCardId && cartaVivaId(d.activeCardId)) return;
    d.activeCardId = d.ordenCartas.length ? d.ordenCartas[0] : null;
}
window.asegurarActivaPorOrden = asegurarActivaPorOrden;

// Saca una carta descartada de juego (selecciones del dueno y carta en uso).
function limpiarDuenoDeCarta(carta) {
    var ownerId = carta.seleccionadoPorId;
    if (ownerId && playersData[ownerId]) {
        if (playersData[ownerId].selecciones) {
            playersData[ownerId].selecciones = playersData[ownerId].selecciones.filter(function(id) {
                return id !== carta.id;
            });
        }
    }
    if (ownerId && playersData[ownerId]) {
        // Si era su carta en uso, pasa automaticamente a la siguiente del orden
        // que ya habia elegido (o a ninguna si ya no le quedan).
        asegurarActivaPorOrden(ownerId);
    }
    if (ownerId === myId) {
        var idx = misSelecciones.indexOf(carta.id);
        if (idx !== -1) misSelecciones.splice(idx, 1);
        if (playersData[myId]) playersData[myId].selecciones = misSelecciones.slice();
    }
}

// Registra que "killerId" elimino la carta. Devuelve { carta, nueva } o null.
function aplicarEliminacion(cartaId, killerId, killerName) {
    var carta = buscarCartaPorId(cartaId);
    if (!carta) return null;
    if (carta.descartada && carta.eliminadaPorId) {
        return { carta: carta, nueva: false };
    }
    carta.eliminadaPorId = killerId;
    carta.eliminadaPor = killerName || null;
    carta.descartada = true;
    limpiarDuenoDeCarta(carta);
    return { carta: carta, nueva: true };
}

function recalcularPuntos() {
    var total = {};
    for (var id in playersData) total[id] = 0;
    for (var i = 0; i < cartas.length; i++) {
        var c = cartas[i];
        if (c.eliminadaPorId && total[c.eliminadaPorId] !== undefined) {
            total[c.eliminadaPorId] += getPuntosCarta(c.numero);
        }
    }
    for (var pid in puntosPorJugador) {
        if (total[pid] === undefined) delete puntosPorJugador[pid];
    }
    for (var tid in total) puntosPorJugador[tid] = total[tid];
}

window.getStatsCarta = getStatsCarta;
window.getVidaCarta = getVidaCarta;
window.getPuntosCarta = getPuntosCarta;
window.buscarCartaPorId = buscarCartaPorId;
window.limpiarDuenoDeCarta = limpiarDuenoDeCarta;
window.aplicarEliminacion = aplicarEliminacion;
window.recalcularPuntos = recalcularPuntos;
