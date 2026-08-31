// tiempo.js - EcoTrole
// Temporizador de 4 minutos sincronizado para todos los jugadores

var TIEMPO_TOTAL_SEGUNDOS = 240; // 4 minutos
var tiempoRestante = TIEMPO_TOTAL_SEGUNDOS;
var temporizadorActivo = false;
var intervaloGlobal = null;
var tiempoInicio = null;
var tiempoPausadoEn = null;

// Estados del temporizador
var ESTADO_TEMPORIZADOR = {
    DETENIDO: 'detenido',
    CORRIENDO: 'corriendo',
    PAUSADO: 'pausado',
    TERMINADO: 'terminado'
};

var estadoActual = ESTADO_TEMPORIZADOR.DETENIDO;

// Puntos verdes (inicialmente 3)
var puntosVerdes = 3;

// DOM elements
var timerDisplay = null;
var timerStatus = null;
var puntosContainer = null;

function initTimerElements() {
    timerDisplay = document.getElementById('timerDisplay');
    timerStatus = document.getElementById('timerStatus');
    puntosContainer = document.getElementById('puntosContainer');
}

function formatearTiempo(segundos) {
    if (typeof segundos !== 'number' || isNaN(segundos) || !isFinite(segundos)) {
        segundos = 0;
    }
    if (segundos < 0) segundos = 0;
    var mins = Math.floor(segundos / 60);
    var secs = segundos % 60;
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

function actualizarDisplay() {
    if (!timerDisplay) initTimerElements();
    if (timerDisplay) {
        timerDisplay.textContent = formatearTiempo(tiempoRestante);
    }
    actualizarClasesDisplay();
}

function actualizarClasesDisplay() {
    if (!timerDisplay) return;
    timerDisplay.classList.remove('running', 'warning', 'danger', 'stopped');
    timerStatus.classList.remove('running', 'warning', 'danger', 'stopped');

    if (estadoActual === ESTADO_TEMPORIZADOR.CORRIENDO) {
        if (tiempoRestante <= 30) {
            timerDisplay.classList.add('danger');
            timerStatus.classList.add('danger');
            timerStatus.textContent = 'Tiempo casi agotado!';
        } else if (tiempoRestante <= 60) {
            timerDisplay.classList.add('warning');
            timerStatus.classList.add('warning');
            timerStatus.textContent = 'Ultimo minuto!';
        } else {
            timerDisplay.classList.add('running');
            timerStatus.classList.add('running');
            timerStatus.textContent = 'Para el siguiente APAGON';
        }
    } else if (estadoActual === ESTADO_TEMPORIZADOR.DETENIDO) {
        timerDisplay.classList.add('stopped');
        timerStatus.classList.add('stopped');
        if (tiempoRestante === TIEMPO_TOTAL_SEGUNDOS) {
            timerStatus.textContent = 'Esperando inicio...';
        } else {
            timerStatus.textContent = 'Detenido';
        }
    } else if (estadoActual === ESTADO_TEMPORIZADOR.PAUSADO) {
        timerDisplay.classList.add('stopped');
        timerStatus.classList.add('stopped');
        timerStatus.textContent = 'Pausado';
    } else if (estadoActual === ESTADO_TEMPORIZADOR.TERMINADO) {
        timerDisplay.classList.add('danger');
        timerStatus.classList.add('danger');
        timerStatus.textContent = 'Tiempo terminado!';
    }
}

// ===== PUNTOS =====
function actualizarPuntosUI() {
    if (!puntosContainer) initTimerElements();
    if (!puntosContainer) return;
    var puntos = puntosContainer.querySelectorAll('.punto');
    for (var i = 0; i < puntos.length; i++) {
        puntos[i].className = 'punto' + (i < puntosVerdes ? ' verde' : ' rojo');
    }
}

function consumirPunto() {
    if (puntosVerdes > 0) {
        puntosVerdes--;
        actualizarPuntosUI();
        broadcastPuntoConsumido(puntosVerdes);
        if (puntosVerdes === 0) {
            // Todos rojos -> terminar el tiempo para mi Y avisar a todos los demas
            detenerTemporizador(true);
            broadcastTiempoTerminado();
        }
    }
}

function resetearPuntos() {
    puntosVerdes = 3;
    actualizarPuntosUI();
    broadcastPuntosReset();
}

// ===== BROADCAST PUNTOS =====
function broadcastPuntoConsumido(valor) {
    if (mqttClient && currentRoom) {
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({ action: 'punto_consumido', id: myId, puntosVerdes: valor });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastPuntosReset() {
    if (mqttClient && currentRoom) {
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({ action: 'puntos_reset', id: myId });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

// ===== TEMPORIZADOR =====
function iniciarTemporizador() {
    if (typeof tiempoRestante !== 'number' || isNaN(tiempoRestante) || !isFinite(tiempoRestante)) {
        tiempoRestante = TIEMPO_TOTAL_SEGUNDOS;
    }
    if (temporizadorActivo) return;
    if (tiempoRestante <= 0) {
        tiempoRestante = TIEMPO_TOTAL_SEGUNDOS;
    }
    
    temporizadorActivo = true;
    estadoActual = ESTADO_TEMPORIZADOR.CORRIENDO;
    tiempoInicio = Date.now() - (TIEMPO_TOTAL_SEGUNDOS - tiempoRestante) * 1000;
    tiempoPausadoEn = null;

    // Arranca una ronda nueva del temporizador: le avisamos a robar.js para
    // que cada jugador libere su bloqueo de robo del Apagon anterior.
    if (typeof onNuevaRondaTemporizador === 'function') {
        onNuevaRondaTemporizador();
    }

    if (intervaloGlobal) {
        clearInterval(intervaloGlobal);
    }
    
    intervaloGlobal = setInterval(function() {
        if (estadoActual === ESTADO_TEMPORIZADOR.CORRIENDO && tiempoInicio) {
            var ahora = Date.now();
            var transcurrido = Math.floor((ahora - tiempoInicio) / 1000);
            tiempoRestante = Math.max(0, TIEMPO_TOTAL_SEGUNDOS - transcurrido);
            
            actualizarDisplay();
            
            if (tiempoRestante <= 0) {
                tiempoRestante = 0;
                detenerTemporizador(true);
                broadcastTiempoTerminado();
            }
        }
    }, 100);
    
    broadcastTiempoInicio(tiempoRestante);
    actualizarDisplay();
}

function pausarTemporizador() {
    if (estadoActual !== ESTADO_TEMPORIZADOR.CORRIENDO) return;
    estadoActual = ESTADO_TEMPORIZADOR.PAUSADO;
    tiempoPausadoEn = Date.now();
    temporizadorActivo = false;
    actualizarDisplay();
    broadcastTiempoPausa(tiempoRestante);
}

function reanudarTemporizador() {
    if (estadoActual !== ESTADO_TEMPORIZADOR.PAUSADO) return;
    if (tiempoPausadoEn) {
        var pausaDuracion = Date.now() - tiempoPausadoEn;
        if (tiempoInicio) {
            tiempoInicio += pausaDuracion;
        }
        tiempoPausadoEn = null;
    }
    estadoActual = ESTADO_TEMPORIZADOR.CORRIENDO;
    temporizadorActivo = true;
    actualizarDisplay();
    broadcastTiempoReanudar(tiempoRestante);
}

function detenerTemporizador(terminado) {
    if (intervaloGlobal) {
        clearInterval(intervaloGlobal);
        intervaloGlobal = null;
    }
    temporizadorActivo = false;
    tiempoInicio = null;
    tiempoPausadoEn = null;
    
    if (terminado) {
        estadoActual = ESTADO_TEMPORIZADOR.TERMINADO;
    } else {
        estadoActual = ESTADO_TEMPORIZADOR.DETENIDO;
    }
    
    actualizarDisplay();

    // El "Apagon" ocurrio de verdad (no una pausa): avisamos a robar.js para
    // que se haga definitiva cualquier pre-seleccion de robo pendiente.
    if (terminado && typeof onApagonOcurrido === 'function') {
        onApagonOcurrido();
    }
}

function reiniciarTemporizador() {
    detenerTemporizador(false);
    tiempoRestante = TIEMPO_TOTAL_SEGUNDOS;
    estadoActual = ESTADO_TEMPORIZADOR.DETENIDO;
    actualizarDisplay();
}

// ===== FUNCIONES DE BROADCAST (tiempo) =====
function broadcastTiempoInicio(tiempo) {
    if (mqttClient && currentRoom) {
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'tiempo_inicio',
            id: myId,
            tiempoRestante: tiempo,
            timestamp: Date.now()
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastTiempoPausa(tiempo) {
    if (mqttClient && currentRoom) {
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'tiempo_pausa',
            id: myId,
            tiempoRestante: tiempo
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastTiempoReanudar(tiempo) {
    if (mqttClient && currentRoom) {
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'tiempo_reanudar',
            id: myId,
            tiempoRestante: tiempo
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastTiempoTerminado() {
    if (mqttClient && currentRoom) {
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'tiempo_terminado',
            id: myId
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastSincronizarTiempo() {
    if (mqttClient && currentRoom) {
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'tiempo_sync',
            id: myId,
            estado: estadoActual,
            tiempoRestante: tiempoRestante,
            timestamp: Date.now()
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

// ===== FUNCIONES PARA RECIBIR EVENTOS (tiempo) =====
function recibirTiempoInicio(data) {
    if (data.id === myId) return;
    if (temporizadorActivo) return;
    tiempoRestante = data.tiempoRestante || TIEMPO_TOTAL_SEGUNDOS;
    iniciarTemporizador();
}

function recibirTiempoPausa(data) {
    if (data.id === myId) return;
    pausarTemporizador();
}

function recibirTiempoReanudar(data) {
    if (data.id === myId) return;
    reanudarTemporizador();
}

function recibirTiempoTerminado(data) {
    if (data.id === myId) return;
    tiempoRestante = 0;
    detenerTemporizador(true);
}

function recibirTiempoSync(data) {
    if (data.id === myId) return;
    if (temporizadorActivo) return;
    tiempoRestante = data.tiempoRestante || TIEMPO_TOTAL_SEGUNDOS;
    if (data.estado === ESTADO_TEMPORIZADOR.CORRIENDO) {
        iniciarTemporizador();
    } else if (data.estado === ESTADO_TEMPORIZADOR.PAUSADO) {
        estadoActual = ESTADO_TEMPORIZADOR.PAUSADO;
        actualizarDisplay();
    } else if (data.estado === ESTADO_TEMPORIZADOR.TERMINADO) {
        tiempoRestante = 0;
        detenerTemporizador(true);
    } else {
        detenerTemporizador(false);
    }
}

// ===== FUNCIONES PARA RECIBIR EVENTOS DE PUNTOS (se llaman desde mqtt.js) =====
function recibirPuntoConsumido(data) {
    if (data.id === myId) return;
    puntosVerdes = data.puntosVerdes;
    actualizarPuntosUI();
    // Respaldo por si el mensaje 'tiempo_terminado' se pierde: si llegan los 3 rojos, detener igual.
    if (puntosVerdes === 0) {
        detenerTemporizador(true);
    }
}

function recibirPuntosReset(data) {
    if (data.id === myId) return;
    puntosVerdes = 3;
    actualizarPuntosUI();
}

// ===== GETTERS =====
function getTiempoRestante() {
    return tiempoRestante;
}

function getEstadoActual() {
    return estadoActual;
}

function getTemporizadorActivo() {
    return temporizadorActivo;
}

function getPuntosVerdes() {
    return puntosVerdes;
}

// ===== INICIALIZACION =====
document.addEventListener('DOMContentLoaded', function() {
    initTimerElements();
    actualizarDisplay();
    actualizarPuntosUI();
});

// Exponer funciones globalmente
window.iniciarTemporizador = iniciarTemporizador;
window.pausarTemporizador = pausarTemporizador;
window.reanudarTemporizador = reanudarTemporizador;
window.detenerTemporizador = detenerTemporizador;
window.reiniciarTemporizador = reiniciarTemporizador;
window.broadcastSincronizarTiempo = broadcastSincronizarTiempo;
window.recibirTiempoInicio = recibirTiempoInicio;
window.recibirTiempoPausa = recibirTiempoPausa;
window.recibirTiempoReanudar = recibirTiempoReanudar;
window.recibirTiempoTerminado = recibirTiempoTerminado;
window.recibirTiempoSync = recibirTiempoSync;

// Exponer getters
window.getTiempoRestante = getTiempoRestante;
window.getEstadoActual = getEstadoActual;
window.getTemporizadorActivo = getTemporizadorActivo;
window.getPuntosVerdes = getPuntosVerdes;

// Exponer funciones de puntos
window.consumirPunto = consumirPunto;
window.resetearPuntos = resetearPuntos;
window.actualizarPuntosUI = actualizarPuntosUI;
window.recibirPuntoConsumido = recibirPuntoConsumido;
window.recibirPuntosReset = recibirPuntosReset;