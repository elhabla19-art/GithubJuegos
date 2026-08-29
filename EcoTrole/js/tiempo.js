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

// DOM elements
var timerDisplay = null;
var timerStatus = null;

function initTimerElements() {
    timerDisplay = document.getElementById('timerDisplay');
    timerStatus = document.getElementById('timerStatus');
}

function formatearTiempo(segundos) {
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
    // Remover todas las clases de estado
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
            timerStatus.textContent = 'Tiempo en marcha...';
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

function iniciarTemporizador() {
    if (temporizadorActivo) return;
    if (tiempoRestante <= 0) {
        tiempoRestante = TIEMPO_TOTAL_SEGUNDOS;
    }
    
    temporizadorActivo = true;
    estadoActual = ESTADO_TEMPORIZADOR.CORRIENDO;
    tiempoInicio = Date.now() - (TIEMPO_TOTAL_SEGUNDOS - tiempoRestante) * 1000;
    tiempoPausadoEn = null;
    
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
                // Notificar que el tiempo terminó
                broadcastTiempoTerminado();
            }
        }
    }, 100);
    
    // Broadcast del inicio del temporizador
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
}

function reiniciarTemporizador() {
    detenerTemporizador(false);
    tiempoRestante = TIEMPO_TOTAL_SEGUNDOS;
    estadoActual = ESTADO_TEMPORIZADOR.DETENIDO;
    actualizarDisplay();
}

// ===== FUNCIONES DE BROADCAST =====
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

// ===== FUNCIONES PARA RECIBIR EVENTOS =====
function recibirTiempoInicio(data) {
    if (data.id === myId) return;
    // Si el tiempo ya está corriendo, ignorar
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
    // Solo sincronizar si no estamos en medio de una accion local
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

// ===== INICIALIZACION =====
document.addEventListener('DOMContentLoaded', function() {
    initTimerElements();
    actualizarDisplay();
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

window.tiempoRestante = function() { return tiempoRestante; };
window.estadoActualTiempo = function() { return estadoActual; };
window.temporizadorActivoFlag = function() { return temporizadorActivo; };