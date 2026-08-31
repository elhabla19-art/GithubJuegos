// roles.js - EcoTrole
// Aqui viven los roles, sus particularidades y las condiciones de victoria.
// El estado de "cruzar el tablero" ocurre fuera de la pagina; el anfitrion
// es quien reporta ese resultado mediante el modal de "Decision".

var ROLES = {
    PASAJERO: 'pasajero',
    LADRON: 'ladron',
    ESTORBO: 'estorbo'
};

// Estado de cada jugador dentro de la partida (no confundir con "rol")
var ESTADO_JUGADOR = {
    ACTIVO: 'activo',       // aun en juego, rol oculto para los demas
    META: 'meta',           // cruzo el tablero, rol revelado
    EXPULSADO: 'expulsado'  // fue expulsado, rol revelado
};

// Metadatos e informacion de cada rol (nombre visible, clase css, condicion de victoria)
var ROLES_INFO = {
    pasajero: {
        nombre: 'Pasajero',
        emoji: '🚶',
        condicion: 'Cruzar el tablero con 2 pasajeros, o expulsar a todos los ladrones.'
    },
    ladron: {
        nombre: 'Ladron',
        emoji: '🥷',
        condicion: 'Robar 8 objetos entre todos los ladrones, o cruzar el tablero con 1 ladron.'
    },
    estorbo: {
        nombre: 'Estorbo',
        emoji: '🚧',
        condicion: 'Cruzar el tablero con TODOS los estorbos.'
    }
};

// --- Parametros de las condiciones de victoria ---
var META_PASAJEROS_REQUERIDA = 2;
var META_LADRONES_REQUERIDA = 1;
var OBJETOS_ROBADOS_REQUERIDOS = 8; // pendiente: la mecanica de robo aun no esta implementada

// --- Estado global de la partida (victoria) ---
var juegoTerminado = false;
var equipoGanador = null;
var motivoVictoria = '';
var victoriaNotificada = false;

function contarPorRolYEstado(rol, estado) {
    var count = 0;
    for (var id in playersData) {
        var p = playersData[id];
        if (!p || p.rol !== rol) continue;
        if (estado === undefined || p.estadoJuego === estado) {
            count++;
        }
    }
    return count;
}

function contarPorRol(rol) {
    return contarPorRolYEstado(rol);
}

// Revisa las 3 condiciones de victoria descritas por el usuario.
// Devuelve { ganador, motivo } si alguien gano, o null si el juego sigue.
function evaluarCondicionesVictoria() {
    // --- a) Pasajeros ---
    var pasajerosEnMeta = contarPorRolYEstado(ROLES.PASAJERO, ESTADO_JUGADOR.META);
    if (pasajerosEnMeta >= META_PASAJEROS_REQUERIDA) {
        return {
            ganador: ROLES.PASAJERO,
            motivo: pasajerosEnMeta + ' pasajeros cruzaron el tablero.'
        };
    }

    var ladronesTotal = contarPorRol(ROLES.LADRON);
    var ladronesExpulsados = contarPorRolYEstado(ROLES.LADRON, ESTADO_JUGADOR.EXPULSADO);
    if (ladronesTotal > 0 && ladronesExpulsados === ladronesTotal) {
        return {
            ganador: ROLES.PASAJERO,
            motivo: 'Todos los ladrones (' + ladronesTotal + ') fueron expulsados.'
        };
    }

    // --- b) Ladrones ---
    var ladronesEnMeta = contarPorRolYEstado(ROLES.LADRON, ESTADO_JUGADOR.META);
    if (ladronesEnMeta >= META_LADRONES_REQUERIDA) {
        return {
            ganador: ROLES.LADRON,
            motivo: ladronesEnMeta + ' ladron(es) cruzaron el tablero.'
        };
    }
    // (Robo de OBJETOS_ROBADOS_REQUERIDOS objetos: pendiente, aun no hay mecanica de robo)

    // --- c) Estorbos ---
    var estorbosTotal = contarPorRol(ROLES.ESTORBO);
    var estorbosEnMeta = contarPorRolYEstado(ROLES.ESTORBO, ESTADO_JUGADOR.META);
    if (estorbosTotal > 0 && estorbosEnMeta === estorbosTotal) {
        return {
            ganador: ROLES.ESTORBO,
            motivo: 'Todos los estorbos (' + estorbosTotal + ') cruzaron el tablero.'
        };
    }

    return null;
}

function actualizarBannerVictoria() {
    var banner = document.getElementById('victoryBanner');
    if (!banner) return;
    if (juegoTerminado && equipoGanador) {
        var info = ROLES_INFO[equipoGanador];
        var nombreRol = info ? info.nombre : equipoGanador;
        var emoji = info ? info.emoji : '🏆';
        banner.textContent = '🏆 Ganaron los ' + nombreRol + ' ' + emoji +
            (motivoVictoria ? ' — ' + motivoVictoria : '');
        banner.className = 'victory-banner visible rol-' + equipoGanador;
    } else {
        banner.textContent = '';
        banner.className = 'victory-banner';
    }
}

function notificarVictoriaSiCorresponde() {
    if (!juegoTerminado || victoriaNotificada) return;
    victoriaNotificada = true;
    var info = ROLES_INFO[equipoGanador];
    var nombreRol = info ? info.nombre : equipoGanador;
    if (typeof showNotice === 'function') {
        showNotice(motivoVictoria, '¡Ganaron los ' + nombreRol + '!');
    }
}

// Se llama despues de cada decision (Meta/Expulsar) para ver si alguien ya gano.
function revisarVictoria() {
    if (juegoTerminado) return;
    var resultado = evaluarCondicionesVictoria();
    if (resultado) {
        juegoTerminado = true;
        equipoGanador = resultado.ganador;
        motivoVictoria = resultado.motivo;
        actualizarBannerVictoria();
        notificarVictoriaSiCorresponde();
        if (typeof saveSession === 'function') saveSession();
    }
}

function resetVictoria() {
    juegoTerminado = false;
    equipoGanador = null;
    motivoVictoria = '';
    victoriaNotificada = false;
    actualizarBannerVictoria();
}

// --- Decisiones del anfitrion (Meta / Expulsar) ---

// El anfitrion marca que un jugador cruzo el tablero.
function decisionMeta(targetId) {
    if (hostId !== myId) {
        showNotice('Solo el anfitrion puede tomar decisiones sobre los jugadores.');
        return;
    }
    var p = playersData[targetId];
    if (!p || !p.rol) return;
    if (p.estadoJuego && p.estadoJuego !== ESTADO_JUGADOR.ACTIVO) return; // ya resuelto

    aplicarDecision(targetId, 'meta');
    broadcastDecision(targetId, 'meta');
}

// El anfitrion marca que un jugador fue expulsado. Si era Pasajero, se
// convierte en Estorbo. Un Estorbo no puede ser expulsado nuevamente.
function decisionExpulsar(targetId) {
    if (hostId !== myId) {
        showNotice('Solo el anfitrion puede tomar decisiones sobre los jugadores.');
        return;
    }
    var p = playersData[targetId];
    if (!p || !p.rol) return;
    if (p.rol === ROLES.ESTORBO) {
        showNotice('Los estorbos no pueden ser expulsados.');
        return;
    }
    if (p.estadoJuego && p.estadoJuego !== ESTADO_JUGADOR.ACTIVO) return; // ya resuelto

    aplicarDecision(targetId, 'expulsar');
    broadcastDecision(targetId, 'expulsar');
}

// Aplica la decision al estado local. La llaman tanto quien la genera (el
// anfitrion) como quien la recibe por MQTT (todos los demas jugadores).
function aplicarDecision(targetId, subAccion) {
    var p = playersData[targetId];
    if (!p) return;

    if (subAccion === 'meta') {
        p.estadoJuego = ESTADO_JUGADOR.META;
    } else if (subAccion === 'expulsar') {
        if (p.rol === ROLES.PASAJERO) {
            p.rol = ROLES.ESTORBO;
        }
        p.estadoJuego = ESTADO_JUGADOR.EXPULSADO;
    }

    if (targetId === myId) {
        miRol = p.rol;
    }

    if (typeof renderLeaderboard === 'function') renderLeaderboard();
    if (typeof actualizarUI === 'function') actualizarUI();
    if (typeof renderizarDecisionModal === 'function') renderizarDecisionModal();
    if (typeof saveSession === 'function') saveSession();

    revisarVictoria();
}

function broadcastDecision(targetId, subAccion) {
    if (mqttClient && currentRoom) {
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'decision',
            id: myId,
            name: myName,
            targetId: targetId,
            subAccion: subAccion,
            timestamp: Date.now()
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

window.ROLES = ROLES;
window.ESTADO_JUGADOR = ESTADO_JUGADOR;
window.ROLES_INFO = ROLES_INFO;
window.evaluarCondicionesVictoria = evaluarCondicionesVictoria;
window.contarPorRol = contarPorRol;
window.contarPorRolYEstado = contarPorRolYEstado;
window.actualizarBannerVictoria = actualizarBannerVictoria;
window.notificarVictoriaSiCorresponde = notificarVictoriaSiCorresponde;
window.revisarVictoria = revisarVictoria;
window.resetVictoria = resetVictoria;
window.decisionMeta = decisionMeta;
window.decisionExpulsar = decisionExpulsar;
window.aplicarDecision = aplicarDecision;
window.broadcastDecision = broadcastDecision;