// juego.js - EcoTrole
var cartas = [];
var misCartas = [];
var ROLES = {
    PASAJERO: 'pasajero',
    LADRON: 'ladron'
};
var TOTAL_HABILIDADES = 12;
var TOTAL_OBJETOS = 54;
var juegoIniciado = false;
var juegoIniciador = null;
var rolesAsignados = false;

function getImagenHabilidad(numero) {
    return 'imagenes/Habilidad_' + numero + '.png';
}

function getImagenObjeto(numero) {
    return 'imagenes/Juego_' + numero + '.png';
}

function getTipoCarta(numero, tipo) {
    if (tipo === 'habilidad') return 'habilidad';
    if (tipo === 'objeto') return 'objeto';
    return 'desconocido';
}

function getPrefijoCarta(numero, tipo) {
    if (tipo === 'habilidad') return 'HAB';
    if (tipo === 'objeto') return 'OBJ';
    return '??';
}

function iniciarJuego() {
    var numJugadores = Object.keys(playersData).length;
    if (numJugadores === 0) {
        showNotice('No hay jugadores en la sala. Espera a que alguien se una.');
        return;
    }

    if (hostId !== myId) {
        showNotice('Solo el anfitrion puede repartir los roles.');
        return;
    }

    if (rolesAsignados) {
        showNotice('Los roles ya fueron asignados. Usa "Reiniciar" para volver a repartir.');
        return;
    }

    var mazoHabilidades = [];
    for (var i = 1; i <= TOTAL_HABILIDADES; i++) {
        mazoHabilidades.push(i);
    }
    for (var i = mazoHabilidades.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = mazoHabilidades[i];
        mazoHabilidades[i] = mazoHabilidades[j];
        mazoHabilidades[j] = temp;
    }

    var jugadores = Object.keys(playersData);
    var habilidadesPorJugador = {};

    var numLadrones = Math.max(1, Math.floor(jugadores.length / 3));
    if (numLadrones > jugadores.length - 1) numLadrones = jugadores.length - 1;
    
    var jugadoresMezclados = jugadores.slice();
    for (var i = jugadoresMezclados.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = jugadoresMezclados[i];
        jugadoresMezclados[i] = jugadoresMezclados[j];
        jugadoresMezclados[j] = temp;
    }

    var rolAsignado = {};
    var indiceHabilidad = 0;
    for (var i = 0; i < jugadoresMezclados.length; i++) {
        var id = jugadoresMezclados[i];
        if (i < numLadrones) {
            rolAsignado[id] = ROLES.LADRON;
        } else {
            rolAsignado[id] = ROLES.PASAJERO;
        }
        
        if (indiceHabilidad < mazoHabilidades.length) {
            var numHabilidad = mazoHabilidades[indiceHabilidad];
            habilidadesPorJugador[id] = {
                numero: numHabilidad,
                imagen: getImagenHabilidad(numHabilidad),
                tipo: 'habilidad'
            };
            indiceHabilidad++;
        }
    }

    var mazoObjetos = [];
    for (var i = 1; i <= TOTAL_OBJETOS; i++) {
        mazoObjetos.push(i);
    }
    for (var i = mazoObjetos.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = mazoObjetos[i];
        mazoObjetos[i] = mazoObjetos[j];
        mazoObjetos[j] = temp;
    }

    juegoIniciado = true;
    juegoIniciador = myId;
    rolesAsignados = true;
    mazoObjetosRestantes = mazoObjetos;
    objetosRestantes = mazoObjetos.length;

    broadcastStartGame(rolAsignado, habilidadesPorJugador, mazoObjetos);
    
    aplicarRolesLocales(rolAsignado, habilidadesPorJugador);
    
    if (typeof iniciarTemporizador === 'function') {
        iniciarTemporizador();
    }
    
    renderizarMisCartas();
    actualizarUI();
    saveSession();
}

var mazoObjetosRestantes = [];
var objetosRestantes = TOTAL_OBJETOS;

function aplicarRolesLocales(roles, habilidades) {
    for (var id in roles) {
        if (!playersData[id]) continue;
        playersData[id].rol = roles[id];
        playersData[id].habilidad = habilidades[id] || null;
        playersData[id].objetos = playersData[id].objetos || [];
        
        if (id === myId) {
            miRol = roles[id];
            miHabilidad = habilidades[id] || null;
            misCartas = [];
            if (miHabilidad) {
                misCartas.push({
                    id: 'hab-' + Date.now() + '-' + Math.random(),
                    numero: miHabilidad.numero,
                    imagen: miHabilidad.imagen,
                    tipo: 'habilidad',
                    esMia: true
                });
            }
        }
    }
    renderizarMisCartas();
    renderLeaderboard();
}

function obtenerObjeto() {
    if (!juegoIniciado) {
        showNotice('Primero debes repartir los roles con "Pasajeros".');
        return;
    }

    if (!playersData[myId] || !playersData[myId].rol) {
        showNotice('Aun no tienes un rol asignado.');
        return;
    }

    if (mazoObjetosRestantes.length === 0) {
        showNotice('No quedan objetos en el mazo.');
        return;
    }

    var numObjeto = mazoObjetosRestantes.shift();
    objetosRestantes = mazoObjetosRestantes.length;

    var cartaObjeto = {
        id: 'obj-' + Date.now() + '-' + Math.random(),
        numero: numObjeto,
        imagen: getImagenObjeto(numObjeto),
        tipo: 'objeto',
        esMia: true
    };

    misCartas.push(cartaObjeto);
    if (!playersData[myId].objetos) {
        playersData[myId].objetos = [];
    }
    playersData[myId].objetos.push(cartaObjeto.id);

    broadcastObjeto(cartaObjeto);

    renderizarMisCartas();
    actualizarUI();
    saveSession();
}

function apagon() {
    showNotice('Apagon - Funcionalidad en desarrollo.');
}

function resetLocalGame() {
    juegoIniciado = false;
    juegoIniciador = null;
    rolesAsignados = false;
    miRol = null;
    miHabilidad = null;
    misCartas = [];
    mazoObjetosRestantes = [];
    objetosRestantes = TOTAL_OBJETOS;
    
    if (typeof reiniciarTemporizador === 'function') {
        reiniciarTemporizador();
    }
    
    for (var id in playersData) {
        playersData[id].rol = null;
        playersData[id].habilidad = null;
        playersData[id].objetos = [];
    }
    
    renderizarMisCartas();
    actualizarUI();
    renderLeaderboard();
    saveSession();
}

function broadcastStartGame(roles, habilidades, mazoObjetos) {
    if (mqttClient && currentRoom) {
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'start_game',
            id: myId,
            name: myName,
            roles: roles,
            habilidades: habilidades,
            mazoObjetos: mazoObjetos,
            hostId: hostId,
            timestamp: Date.now()
        });
        mqttClient.publish(topic, payload, { qos: 1, retain: true });
    }
}

function broadcastObjeto(carta) {
    if (mqttClient && currentRoom) {
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'objeto',
            id: myId,
            name: myName,
            carta: carta,
            objetosRestantes: objetosRestantes
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastReset() {
    if (mqttClient && currentRoom) {
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'reset_all',
            id: myId,
            name: myName
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastState(action) {
    if (action === undefined) action = 'sync';
    if (mqttClient && currentRoom) {
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: action,
            id: myId,
            name: myName,
            playersData: playersData,
            juegoIniciado: juegoIniciado,
            rolesAsignados: rolesAsignados,
            mazoObjetosRestantes: mazoObjetosRestantes,
            objetosRestantes: objetosRestantes,
            hostId: hostId || null,
            updatedAt: Date.now()
        });
        var opts = { qos: 1 };
        if (action === 'sync') {
            opts.retain = true;
        }
        mqttClient.publish(topic, payload, opts);
    }
}

window.iniciarJuego = iniciarJuego;
window.obtenerObjeto = obtenerObjeto;
window.apagon = apagon;
window.resetLocalGame = resetLocalGame;
window.broadcastReset = broadcastReset;
window.broadcastState = broadcastState;
window.broadcastStartGame = broadcastStartGame;
window.broadcastObjeto = broadcastObjeto;