// mqtt.js (se añade broadcastSetActive)
// ===== SISTEMA MULTIJUGADOR MQTT =====
var mqttClient = null;
var myId = Math.random().toString(36).substr(2, 9);
var currentRoom = null;
var playersData = {};
var myName = 'Jugador';
var claimResolved = false;

// ===== REGISTRO DE JUGADORES EXPULSADOS (para el reclamo "eres tu?") =====
// Cuando el anfitrion elimina a alguien, su entrada en playersData
// desaparece de la red (broadcastRemove) y su propia sesion local se borra
// (clearSession() en handleRemovedFromRoom). Eso significa que si vuelve a
// entrar, lo hace como jugador "nuevo" con un id al azar, y la deteccion
// normal de "nombre duplicado" (que solo compara contra playersData actual)
// ya no encuentra a nadie con quien compararlo, asi que nunca se le
// pregunta "eres tu?" y sus puntos/cartas quedan perdidos para siempre.
// Este registro es un respaldo, indexado por NOMBRE, que se llena en TODOS
// los clientes (no solo el anfitrion) al recibir el aviso de expulsion, y
// permite ofrecer el mismo reclamo de siempre cuando ese nombre vuelve a
// unirse, igual que si la desconexion hubiera sido por perder señal en vez
// de por una expulsion.
var removedPlayersRegistry = {};
var pendingClaim = null;

// ===== VENCIMIENTO DE SALAS ABANDONADAS =====
// Los mensajes "sync" y "start" se publican con retain:true en el broker
// MQTT para que quien se conecte reciba el ultimo estado conocido de
// inmediato, sin depender de que otro cliente le responda a tiempo. El
// problema es que un mensaje retenido NUNCA vence por si solo: si una sala
// se abandona y el mismo codigo (topic) se reutiliza dias despues, el
// broker sigue entregando ese snapshot viejo -jugadores, puntajes y
// cartas de la partida anterior- a cualquiera que entre de nuevo, como si
// la sala vieja nunca hubiera terminado. ROOM_STALE_MS define cuanto
// tiempo tiene que pasar desde el ultimo "sync"/"start" real para que ese
// snapshot se considere abandonado y se descarte (ver el chequeo en
// mqttClient.on('message', ...)).
var ROOM_STALE_MS = 12 * 60 * 60 * 1000; // 12 horas

// ===== OCULTAR JUGADORES RECIEN LLEGADOS HASTA CONFIRMAR QUE NO SON UN RECLAMO =====
// Cuando alguien se une con un nombre que ya existe en la sala (tipicamente porque
// se desconecto o volvio a entrar sin usar "Reconectar"), no lo mostramos en el
// leaderboard de inmediato: esperamos a que se resuelva el modal de reclamo
// (aceptar = se fusiona con su id anterior y el "fantasma" nunca llega a verse;
// rechazar = se revela como jugador nuevo). Si nadie ofrece un reclamo en un
// margen breve, asumimos que es un jugador nuevo de verdad y lo revelamos igual.
var hiddenJoiningIds = {};
var confirmedDuplicateIds = {};
var joinGraceTimers = {};

function hideJoiningId(id) {
    hiddenJoiningIds[id] = true;
}
function isJoiningHidden(id) {
    return !!hiddenJoiningIds[id];
}
function scheduleRevealIfNoClaim(id) {
    if (joinGraceTimers[id]) clearTimeout(joinGraceTimers[id]);
    joinGraceTimers[id] = setTimeout(function() {
        delete joinGraceTimers[id];
        if (!hiddenJoiningIds[id]) return;
        // Si es nuestro propio id y todavia tenemos un reclamo pendiente por
        // resolver, no lo revelamos: se espera a que el jugador conteste el modal.
        if (id === myId && pendingClaim) return;
        if (confirmedDuplicateIds[id]) return;
        // Ultima red de contencion: antes de revelarnos como "jugador nuevo",
        // una revision final del estado local por si en el margen de espera
        // igual aprendimos (por cualquier via) de un jugador con nuestro mismo
        // nombre que ninguna rama especifica llego a detectar a tiempo.
        if (id === myId && typeof verificarDuplicadoPropioLocal === 'function' && verificarDuplicadoPropioLocal()) {
            return;
        }
        revealJoiningId(id);
    }, 1800);
}
function revealJoiningId(id) {
    delete hiddenJoiningIds[id];
    delete confirmedDuplicateIds[id];
    if (joinGraceTimers[id]) { clearTimeout(joinGraceTimers[id]); delete joinGraceTimers[id]; }
    renderLeaderboard();
}
function forgetJoiningId(id) {
    delete hiddenJoiningIds[id];
    delete confirmedDuplicateIds[id];
    if (joinGraceTimers[id]) { clearTimeout(joinGraceTimers[id]); delete joinGraceTimers[id]; }
}
window.isJoiningHidden = isJoiningHidden;
var gameStarted = false;
var gameInitiator = null;
var hostId = null; // id del jugador anfitrion de la sala (unico que puede reiniciar)
var hostClaimTimer = null;
var hostHeartbeatInterval = null;
var presencePingInterval = null;

// ===== PRESENCIA (testamento MQTT + heartbeat ligero) =====
// Unica fuente de deteccion de "desconectado": el testamento MQTT (ver "will"
// en connectToRoom), que el broker publica solo el cuando la conexion de
// alguien se corta de forma abrupta (wifi inestable, celular apagado, etc.).
// Cualquier mensaje que llegue de un jugador (incluido un simple "ping") lo
// vuelve a marcar como presente. Es solo visual (etiqueta "Desconectado" +
// habilita el boton "Ser anfitrion"), nunca borra su progreso.
function marcarJugadorOffline(id, offline) {
    if (!playersData[id]) return;
    if (!!playersData[id].offline === !!offline) return;
    playersData[id].offline = !!offline;
    renderLeaderboard();
    if (typeof actualizarUI === 'function') actualizarUI();
}

function hostIsPresent() {
    return !!(hostId && playersData[hostId] && !playersData[hostId].offline);
}
window.hostIsPresent = hostIsPresent;

// BUG FIX (doble anfitrion): antes, el desempate de split-brain usaba
// "!hostIsPresent()" como excusa para adoptar CUALQUIER host_claim que
// llegara, sin comparar magnitud de id, en cuanto el anfitrion actual no
// figurara en NUESTRO playersData. El problema es que "no esta en mi
// playersData" significa dos cosas muy distintas que el codigo trataba
// igual: (a) el anfitrion se fue de verdad, o (b) yo recien me uni y
// todavia no me entero de que existe (muy comun cuando varios jugadores
// entran casi al mismo tiempo). En el caso (b), un cliente terminaba
// adoptando sin querer un host_claim de id "mas grande" (que no deberia
// ganar el desempate), mientras otros clientes -que si conocian al
// anfitrion legitimo- se quedaban con el id "mas chico" correcto. Eso
// producia dos pantallas distintas cada una convencida de tener SU propio
// anfitrion, en vez de converger todas al mismo.
// Esta funcion solo autoriza el override "sin comparar" cuando estamos
// SEGUROS de que el anfitrion se fue (lo conocemos y esta offline), no
// cuando simplemente no sabemos nada de el todavia.
function hostConfirmedAbsent() {
    return !!(hostId && playersData[hostId] && playersData[hostId].offline);
}
window.hostConfirmedAbsent = hostConfirmedAbsent;

// ===== RESPALDO ESTRUCTURAL DE DETECCION DE DUPLICADOS =====
// Toda la deteccion de arriba (claim_offer, escaneo de data.playersData en un
// sync, etc.) depende de que llegue un mensaje PUNTUAL que calce justo con
// una de esas ramas. Si nadie estaba conectado para reaccionar a nuestro
// 'join', o el mensaje que sí llego no encajaba con ninguna rama especifica,
// terminabamos "revelados" como jugador nuevo sin fusionarnos NI bloquearnos,
// dejando dos jugadores visibles con el mismo nombre (bug real observado).
// Este chequeo es la red de contencion: en vez de esperar un mensaje
// especifico, revisa el estado LOCAL ya acumulado (playersData), que para
// este punto ya pudo haberse actualizado por CUALQUIER tipo de mensaje
// (join, sync, start, select, puntaje_global, etc.), sin importar cual.
function verificarDuplicadoPropioLocal() {
    if (claimResolved) return false;
    if (misSelecciones.length !== 0) return false;
    if (!myName) return false;
    for (var id in playersData) {
        if (id !== myId && playersData[id] && playersData[id].name === myName) {
            claimResolved = true;
            confirmedDuplicateIds[myId] = true;
            hideJoiningId(myId);
            if (joinGraceTimers[myId]) {
                clearTimeout(joinGraceTimers[myId]);
                delete joinGraceTimers[myId];
            }
            pendingClaim = {
                oldId: id,
                name: myName,
                selecciones: playersData[id].selecciones || [],
                cartasGanadoras: playersData[id].cartasGanadoras || [],
                puntos: puntosPorJugador[id] || 0
            };
            showClaimModal(pendingClaim);
            return true;
        }
    }
    return false;
}

// ===== RESPALDO DE PRESENCIA (el Last Will de MQTT no siempre alcanza) =====
// El testamento MQTT solo se dispara cuando el broker detecta un corte
// "sucio" de la conexion. Cerrar la pestaña normalmente, minimizar la app en
// el celular, o quedarse sin señal sin que el broker se entere a tiempo,
// puede dejar a un jugador marcado "conectado" para siempre (justo lo
// reportado: "aunque me desconecte, siempre les aparezco conectado"). Se
// agregan dos respaldos independientes del Last Will:
// 1) Al salir/cerrar la pestaña, intentamos avisar explicitamente (best-effort).
// 2) Si dejamos de recibir CUALQUIER mensaje (incluido el ping cada 20s) de un
//    jugador por mas de PRESENCE_TIMEOUT_MS, lo marcamos offline localmente,
//    sin depender de que el broker haya notado el corte.
var lastSeenAt = {};
var PRESENCE_TIMEOUT_MS = 50000; // ~2.5x el intervalo de ping (20s)
var presenceCheckInterval = null;

function marcarVisto(id) {
    if (!id || id === myId) return;
    lastSeenAt[id] = Date.now();
}

function chequearPresenciaStale() {
    var now = Date.now();
    for (var id in playersData) {
        if (id === myId) continue;
        if (isJoiningHidden(id)) continue;
        var visto = lastSeenAt[id];
        if (visto === undefined) continue; // aun no le vimos ningun mensaje directo; no asumimos nada
        if (!playersData[id].offline && (now - visto) > PRESENCE_TIMEOUT_MS) {
            marcarJugadorOffline(id, true);
        }
    }
}

// Reclamo manual de anfitrion (boton "Ser anfitrion"), con un margen
// aleatorio para reducir la chance de que dos jugadores se autoproclamen
// anfitrion al mismo tiempo si presionan el boton casi simultaneamente.
function claimHost() {
    var jitter = 200 + Math.random() * 600;
    setTimeout(function() {
        // Defensa adicional (ver el mismo freno en connectToRoom): si por
        // alguna razon todavia estamos ocultos, no nos autoproclamamos.
        if (isJoiningHidden(myId)) return;
        if (hostId && hostId !== myId && hostIsPresent()) {
            // Alguien mas ya es anfitrion valido (se reconecto justo antes).
            renderLeaderboard();
            return;
        }
        hostId = myId;
        if (hostClaimTimer) {
            clearTimeout(hostClaimTimer);
            hostClaimTimer = null;
        }
        broadcastHostClaim();
        broadcastState('sync');
        if (typeof actualizarUI === 'function') actualizarUI();
        renderLeaderboard();
        saveSession();
    }, jitter);
}
window.claimHost = claimHost;

// Fusiona el arreglo de cartas recibido por red con el que tenemos localmente,
// en vez de reemplazarlo por completo. Esto evita que un mensaje "sync" que
// llegue tarde o desordenado (la red MQTT no garantiza orden) "resucite" una
// carta que ya sabiamos que estaba descartada. Los campos criticos
// (descartada, esGanadora) son monotonos: una vez true, se quedan en true
// sin importar lo que diga el mensaje entrante.
function mergeCartas(incomingCartas) {
    if (!incomingCartas || !incomingCartas.length) return;
    var localById = {};
    for (var i = 0; i < cartas.length; i++) {
        localById[cartas[i].id] = cartas[i];
    }
    var merged = [];
    for (var j = 0; j < incomingCartas.length; j++) {
        var inc = incomingCartas[j];
        var loc = localById[inc.id];
        if (!loc) {
            merged.push(inc);
            continue;
        }
        merged.push({
            id: inc.id,
            numero: inc.numero,
            imagen: inc.imagen,
            tanda: inc.tanda !== undefined ? inc.tanda : loc.tanda,
            descartada: !!(loc.descartada || inc.descartada),
            esGanadora: !!(loc.esGanadora || inc.esGanadora),
            // BUG FIX: este merge reconstruia cada carta con una lista fija
            // de campos, asi que cualquier campo nuevo (como nombreGanador,
            // usado para mostrar el "Dueno" real en Cartas Ganadoras) se
            // perdia en cada sync -aunque se hubiera guardado correctamente
            // un instante antes-. Ahora se preserva igual que los demas.
            nombreGanador: loc.nombreGanador || inc.nombreGanador || null,
            seleccionadoPor: loc.seleccionadoPor || inc.seleccionadoPor || null,
            seleccionadoPorId: loc.seleccionadoPorId || inc.seleccionadoPorId || null
        });
    }
    cartas = merged;
}
window.mergeCartas = mergeCartas;

// Si el activeCardId que llega por red apunta a una carta que en nuestro
// estado actual ya esta descartada (o que no existe), lo ignoramos. Esto
// evita que un jugador que se reconecta con datos atrasados (por ejemplo,
// porque cerro la pagina antes de enterarse de que su carta fue descartada)
// "resucite" esa carta como si siguiera activa en la ronda.
function activeCardIdSaneado(id) {
    if (!id) return null;
    for (var i = 0; i < cartas.length; i++) {
        if (cartas[i].id === id) {
            return cartas[i].descartada ? null : id;
        }
    }
    return id; // si no la conocemos aun (p.ej. cartas todavia no ha llegado), la dejamos pasar
}
window.activeCardIdSaneado = activeCardIdSaneado;

// Corrige NUESTRA PROPIA carta activa cuando una sincronizacion nos informa
// que esa carta ya fue descartada (o ya no existe) mientras estabamos
// desconectados. Es el complemento necesario de activeCardIdSaneado: el
// merge de "sync" nunca toca nuestra propia entrada en playersData (para no
// pisar una accion que estemos haciendo en vivo), asi que si nos
// desconectamos justo cuando nos tocaba perder la carta activa (alguien
// hizo "2°" y nos descarto junto con el resto), volvemos con activeCardId
// apuntando a una carta invisible/descartada para siempre: el boton "Usar"
// queda bloqueado en todas nuestras otras cartas y nadie mas puede
// corregirlo, porque la sincronizacion normal jamas toca nuestros propios
// datos. Esta funcion se llama cada vez que aprendemos algo nuevo sobre el
// estado de las cartas (sync, start) y se auto-corrige si hace falta.
function sanearMiActivaLocal() {
    if (!playersData[myId]) return;
    var actual = playersData[myId].activeCardId;
    if (!actual) return;
    var saneado = activeCardIdSaneado(actual);
    if (saneado !== actual) {
        playersData[myId].activeCardId = saneado;
        broadcastSetActive(myId, saneado);
        renderizarMisCorredores();
        if (typeof actualizarUI === 'function') actualizarUI();
        saveSession();
    }
}
window.sanearMiActivaLocal = sanearMiActivaLocal;

function connectToRoom(code, isReconnect) {
    if (isReconnect === undefined) isReconnect = false;

    // Igual que en Yatzy: al reconectar con "Reconectar" (retomando tu propio
    // id ya conocido), no hace falta pasar por el flujo de "eres tu?" porque
    // ya sabemos que eres tu. Al entrar de cero (isReconnect=false), se deja
    // en false para que la deteccion de nombre duplicado pueda dispararse.
    // Se resetea en CADA llamada a connectToRoom (antes solo se inicializaba
    // una vez al cargar el script), para que reintentos/reconexiones no
    // arrastren un claimResolved=true de una conexion anterior.
    claimResolved = isReconnect;
    pendingClaim = null;

    if (!isReconnect) {
        playersData = {};
        puntosPorJugador = {};
        estadoRonda = { usado3: false, usado2: false, ganadorCartaId: null, jugadorGanador: null };
        cartas = [];
        misSelecciones = [];
        cartaActivaId = null;
        tandaActual = -1;
        cicloTandaInicio = 0;
        mazoRestante = [];
        copiasVisuales = {};
        gruposExpansion31 = {};
        gameStarted = false;
        gameInitiator = null;
        hostId = null;
    }

    if (hostClaimTimer) {
        clearTimeout(hostClaimTimer);
        hostClaimTimer = null;
    }
    if (hostHeartbeatInterval) {
        clearInterval(hostHeartbeatInterval);
        hostHeartbeatInterval = null;
    }
    if (presencePingInterval) {
        clearInterval(presencePingInterval);
        presencePingInterval = null;
    }
    if (presenceCheckInterval) {
        clearInterval(presenceCheckInterval);
        presenceCheckInterval = null;
    }
    lastSeenAt = {};

    showLoading(isReconnect ? 'Reconectando a la sala...' : 'Conectando con la sala...');
    claimResolved = isReconnect;
    pendingClaim = null;

    var roomTopic = 'magical_athlete/room/' + code;
    var hasConnectedOnce = false;

    mqttClient = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', {
        // Testamento MQTT: si nuestra conexion se corta de forma abrupta
        // (wifi inestable, celular apagado/bloqueado, se cierra la app),
        // el broker publica esto por nosotros. Es la unica fuente de
        // deteccion de "desconectado" para los demas jugadores.
        will: {
            topic: roomTopic,
            payload: JSON.stringify({ action: 'presence_lost', id: myId }),
            qos: 0,
            retain: false
        }
    });

    mqttClient.on('connect', function() {
        currentRoom = code;
        var topic = roomTopic;
        mqttClient.subscribe(topic);
        var isSilentReconnect = hasConnectedOnce;
        hasConnectedOnce = true;

        if (playersData[myId]) {
            playersData[myId].offline = false;
        }

        if (!playersData[myId]) {
            playersData[myId] = { 
                name: myName, 
                selecciones: misSelecciones || [],
                cartasGanadoras: [],
                activeCardId: null,
                offline: false
            };
        } else {
            playersData[myId].name = myName;
            playersData[myId].selecciones = misSelecciones || [];
            if (playersData[myId].activeCardId === undefined) {
                playersData[myId].activeCardId = null;
            }
        }

        if (!isReconnect && !isSilentReconnect) {
            // Puede que ya haya un jugador con este nombre en la sala (volvimos
            // a entrar sin usar "Reconectar"). Nos ocultamos hasta saber si
            // corresponde fusionarnos con ese jugador anterior.
            hideJoiningId(myId);
            scheduleRevealIfNoClaim(myId);
        }
        
        joinSuccess(code);
        broadcastState('join');

        // Siempre pedimos el estado actual a los demas: esto es clave para que
        // alguien que se desconecto (celular apagado, salio de la pagina, etc.)
        // reciba el estado real y actualizado al reconectar, en vez de quedarse
        // con su copia local desactualizada.
        broadcastRequestState();

        // Determinar anfitrion: si no hay anfitrion conocido, o el que
        // teniamos guardado localmente resulta estar desconectado (p.ej.
        // volvimos de una reconexion con datos viejos y el anfitrion de
        // entonces ya no esta), este jugador se autoproclama anfitrion tras
        // un margen (con jitter) para dar tiempo a que alguien mas
        // presente responda primero.
        if (hostClaimTimer) {
            clearTimeout(hostClaimTimer);
            hostClaimTimer = null;
        }
        if (!hostId || !hostIsPresent()) {
            hostClaimTimer = setTimeout(function intentarAutoreclamoHost() {
                // No autoproclamarse anfitrion mientras todavia estamos ocultos
                // esperando resolver si somos un duplicado de un jugador que ya
                // estaba en la sala (ver hideJoiningId/scheduleRevealIfNoClaim).
                // Sin este freno, un dispositivo podia convertirse en "anfitrion
                // fantasma" -- invisible en el leaderboard de todos (porque sigue
                // oculto) pero con hostId === su propio id, lo que rompia los
                // controles de anfitrion en su propia pantalla (botones de
                // eliminar/reiniciar aparecian donde no debian porque el
                // dispositivo se creia anfitrion sin que nadie mas lo supiera).
                // En vez de perder el intento, se reintenta un poco despues.
                if (isJoiningHidden(myId)) {
                    hostClaimTimer = setTimeout(intentarAutoreclamoHost, 700);
                    return;
                }
                if (!hostId || !hostIsPresent()) {
                    hostId = myId;
                    broadcastHostClaim();
                    broadcastState('sync');
                    actualizarUI();
                    renderLeaderboard();
                    saveSession();
                }
            }, 1800 + Math.random() * 900);
        }

        // El anfitrion reenvia el estado completo cada cierto tiempo para
        // autocorregir a cualquier cliente que haya perdido mensajes por la
        // red (MQTT publica sin garantia de entrega).
        if (hostHeartbeatInterval) clearInterval(hostHeartbeatInterval);
        hostHeartbeatInterval = setInterval(function() {
            if (hostId === myId && currentRoom) {
                broadcastState('sync');
            }
        }, 15000);

        // Heartbeat ligero de presencia (TODOS los jugadores, no solo el
        // anfitrion): mantiene fresca nuestra "presencia" para el resto,
        // incluso si no estamos haciendo ninguna accion en el juego
        // (esperando a que reparta el anfitrion, etc.). El testamento MQTT
        // detecta desconexiones abruptas, pero este ping evita falsos
        // "Desconectado" prolongados en escenarios raros de red.
        if (presencePingInterval) clearInterval(presencePingInterval);
        presencePingInterval = setInterval(function() {
            if (mqttClient && currentRoom) {
                mqttClient.publish('magical_athlete/room/' + currentRoom, JSON.stringify({ action: 'ping', id: myId }));
            }
        }, 20000);

        // Respaldo del Last Will: si dejamos de recibir mensajes de alguien
        // por mas de PRESENCE_TIMEOUT_MS (sin importar la razon: Will que no
        // se disparo, cierre "prolijo" de la pestaña, red que se corto sin
        // avisar), lo marcamos offline nosotros mismos.
        if (presenceCheckInterval) clearInterval(presenceCheckInterval);
        presenceCheckInterval = setInterval(chequearPresenciaStale, 10000);

        saveSession();
    });

    mqttClient.on('message', function(topic, message) {
        try {
            var data = JSON.parse(message.toString());

            // BUG FIX: sala abandonada que "resucita" al reusar el mismo
            // codigo dias despues (ver el comentario de ROOM_STALE_MS mas
            // arriba). Si el "sync"/"start" trae timestamp y ya vencio -o ni
            // siquiera trae timestamp, lo cual solo puede pasar con un
            // mensaje retenido de ANTES de este arreglo, ya viejo de por
            // si-, lo ignoramos por completo (como si la sala estuviera
            // vacia) y de paso limpiamos el mensaje retenido del broker
            // (publicando un payload vacio con retain:true) para que nadie
            // mas lo reciba tampoco.
            if (data.action === 'sync' || data.action === 'start') {
                var antiguedadMs = data.updatedAt ? (Date.now() - data.updatedAt) : Infinity;
                if (antiguedadMs > ROOM_STALE_MS) {
                    try {
                        if (mqttClient) {
                            mqttClient.publish(topic, '', { qos: 1, retain: true });
                        }
                    } catch (e) {}
                    return;
                }
            }

            if (data.action === 'presence_lost') {
                if (data.id !== myId) {
                    marcarJugadorOffline(data.id, true);
                    delete lastSeenAt[data.id];
                }
                return;
            }

            // Cualquier otro mensaje de un jugador (incluido un simple
            // "ping") confirma que sigue presente: si lo teniamos marcado
            // como desconectado, lo revelamos de nuevo, y refrescamos su
            // "ultima vez visto" para el timeout de respaldo.
            if (data.id) marcarVisto(data.id);
            if (data.id && data.id !== myId && playersData[data.id] && playersData[data.id].offline) {
                marcarJugadorOffline(data.id, false);
            }

            if (data.action === 'ping') return;

            // BUG FIX: en 'remove', data.id es el id del jugador ELIMINADO, no
            // el del que envia el mensaje (a diferencia de casi todos los
            // demas mensajes). El filtro generico de abajo ("if (data.id ===
            // myId) return") esta pensado para descartar nuestros propios
            // broadcasts que nos rebotan, pero para 'remove' hacia que el
            // jugador expulsado SIEMPRE descartara su propio aviso de
            // expulsion antes de llegar a handleRemovedFromRoom() -- nunca se
            // enteraba de que lo sacaron. Por eso este bloque va ANTES del
            // filtro generico (igual que en Yatzy, donde si funciona).
            if (data.action === 'remove') {
                if (data.id === myId) {
                    handleRemovedFromRoom();
                    return;
                }
                // Guardamos un respaldo por nombre ANTES de borrar, para
                // poder ofrecerle el reclamo "eres tu?" si ese nombre
                // vuelve a entrar mas tarde (ver removedPlayersRegistry).
                if (data.removedName) {
                    removedPlayersRegistry[data.removedName] = {
                        oldId: data.id,
                        selecciones: data.removedSelecciones || [],
                        cartasGanadoras: data.removedCartasGanadoras || [],
                        puntos: data.removedPuntos || 0
                    };
                }
                delete playersData[data.id];
                delete puntosPorJugador[data.id];
                forgetJoiningId(data.id);
                if (hostId === data.id) {
                    // El anfitrion fue eliminado: queda libre para que
                    // alguien mas lo reclame (boton "Ser anfitrion" o el
                    // auto-reclamo tras el margen de espera).
                    hostId = null;
                }
                renderLeaderboard();
                actualizarUI();
                saveSession();
                return;
            }

            if (data.id === myId) return;

            if (data.action === 'claim_offer') {
                // Se confirma que el que se acaba de unir es (probablemente)
                // alguien que ya estaba en la sala: se mantiene oculto en TODAS
                // las pantallas hasta que se resuelva el reclamo.
                if (data.targetId) {
                    confirmedDuplicateIds[data.targetId] = true;
                    hideJoiningId(data.targetId);
                    if (joinGraceTimers[data.targetId]) {
                        clearTimeout(joinGraceTimers[data.targetId]);
                        delete joinGraceTimers[data.targetId];
                    }
                    renderLeaderboard();
                }
                // No exigimos que el jugador viejo tenga progreso (selecciones,
                // cartas ganadoras o puntos): en este juego dos jugadores NUNCA
                // pueden compartir nombre, asi que cualquier coincidencia debe
                // disparar el reclamo, incluso si el jugador viejo todavia no
                // habia hecho nada (p.ej. se conecta desde el celular, no elige
                // nada, y abre el juego desde otro dispositivo con el mismo
                // nombre antes de elegir su primera carta).
                if (data.targetId === myId && !claimResolved && misSelecciones.length === 0) {
                    claimResolved = true;
                    pendingClaim = { 
                        oldId: data.offeredId, 
                        name: data.name, 
                        selecciones: data.selecciones || [],
                        cartasGanadoras: data.cartasGanadoras || [],
                        puntos: data.puntos || 0
                    };
                    showClaimModal(pendingClaim);
                }
                return;
            }

            if (data.action === 'claim_declined') {
                // El jugador que se unio confirmo que es una persona distinta:
                // ahora si se muestra como jugador nuevo normal.
                revealJoiningId(data.id);
                return;
            }

            // Deteccion de nombre duplicado: antes solo mirabamos quien
            // PUBLICO el mensaje (data.name/data.id). El problema es que el
            // ultimo 'sync' RETENIDO en el broker (lo primero que recibe
            // alguien que se reconecta) puede haberlo publicado cualquier
            // OTRO jugador (p.ej. su propio heartbeat de anfitrion), no el
            // jugador con el que en realidad coincidimos en nombre -- ese
            // jugador viejo viaja adentro de data.playersData, no en el nivel
            // superior del mensaje. Sin este segundo chequeo, reconectarse
            // como "Isaiah" nunca disparaba el reclamo si el ultimo sync lo
            // habia publicado "IsaiahGuh", aunque el "Isaiah" viejo (con sus
            // puntos y su anfitrionazgo) estuviera ahi adentro.
            var duplicadoId = null;
            var duplicadoInfo = null;
            if (data.name === myName && data.id && data.id !== myId) {
                duplicadoId = data.id;
                duplicadoInfo = {
                    selecciones: data.selecciones || [],
                    cartasGanadoras: data.cartasGanadoras || [],
                    puntos: (data.puntosPorJugador && data.puntosPorJugador[data.id]) || data.puntos || 0
                };
            } else if (data.playersData) {
                for (var pidDup in data.playersData) {
                    if (pidDup !== myId && data.playersData[pidDup] && data.playersData[pidDup].name === myName) {
                        duplicadoId = pidDup;
                        duplicadoInfo = {
                            selecciones: data.playersData[pidDup].selecciones || [],
                            cartasGanadoras: data.playersData[pidDup].cartasGanadoras || [],
                            puntos: (data.puntosPorJugador && data.puntosPorJugador[pidDup]) || 0
                        };
                        break;
                    }
                }
            }
            // Tampoco exigimos progreso (selecciones/cartas/puntos): dos
            // jugadores nunca pueden compartir nombre en este juego, asi que
            // cualquier coincidencia debe disparar el reclamo.
            if (!claimResolved && duplicadoId && misSelecciones.length === 0) {
                claimResolved = true;
                confirmedDuplicateIds[myId] = true;
                hideJoiningId(myId);
                if (joinGraceTimers[myId]) {
                    clearTimeout(joinGraceTimers[myId]);
                    delete joinGraceTimers[myId];
                }
                pendingClaim = { 
                    oldId: duplicadoId, 
                    name: myName, 
                    selecciones: duplicadoInfo.selecciones,
                    cartasGanadoras: duplicadoInfo.cartasGanadoras,
                    puntos: duplicadoInfo.puntos || (puntosPorJugador[duplicadoId]) || 0
                };
                showClaimModal(pendingClaim);
                return;
            }

            if (data.id && data.name && data.action !== 'request_state' && data.action !== 'remove' && data.action !== 'sync' && data.action !== 'set_active') {
                if (!playersData[data.id]) {
                    playersData[data.id] = { name: data.name, selecciones: [], cartasGanadoras: [], activeCardId: null };
                }
                playersData[data.id].name = data.name;
                if (data.selecciones) {
                    playersData[data.id].selecciones = data.selecciones;
                }
                if (data.cartasGanadoras) {
                    playersData[data.id].cartasGanadoras = data.cartasGanadoras;
                }
                renderLeaderboard();
            }

            if (data.action === 'reset_all') {
                var seenNames = {};
                var toRemove = [];
                for (var id in playersData) {
                    var name = playersData[id].name;
                    if (seenNames[name] !== undefined) {
                        toRemove.push(id);
                    } else {
                        seenNames[name] = id;
                    }
                }
                for (var i = 0; i < toRemove.length; i++) {
                    delete playersData[toRemove[i]];
                    delete puntosPorJugador[toRemove[i]];
                }
                resetLocalGame();
                return;
            }

            if (data.action === 'host_claim') {
                // Adoptamos el anfitrion que llega si no tenemos uno, o si
                // el que teniamos esta CONFIRMADO como desconectado (no
                // basta con "no lo conozco todavia", ver hostConfirmedAbsent).
                if (!hostId || hostConfirmedAbsent()) {
                    hostId = data.id;
                    if (hostClaimTimer) {
                        clearTimeout(hostClaimTimer);
                        hostClaimTimer = null;
                    }
                    actualizarUI();
                    renderLeaderboard();
                    saveSession();
                } else if (data.id !== hostId && data.id < hostId) {
                    // EMPATE (split-brain): dos dispositivos se autoproclamaron
                    // anfitrion casi al mismo tiempo, cada uno antes de enterarse
                    // del otro. El chequeo de "presente" de arriba no alcanza
                    // para desempatar aca, porque cada dispositivo SIEMPRE se ve
                    // a si mismo como presente. Sin esto, ninguno de los dos
                    // cede jamas y ambas pantallas quedan creyendose "el"
                    // anfitrion (esto es justo lo reportado: dos jugadores
                    // viendo cada uno su propio tag "Anfitrion").
                    // Se resuelve de forma deterministica y sin coordinacion:
                    // todos los dispositivos, de forma independiente, calculan
                    // el mismo resultado (gana el id menor en orden alfabetico),
                    // asi que convergen al mismo anfitrion sin importar quien
                    // reclamo primero.
                    hostId = data.id;
                    if (hostClaimTimer) {
                        clearTimeout(hostClaimTimer);
                        hostClaimTimer = null;
                    }
                    if (hostHeartbeatInterval && hostId !== myId) {
                        clearInterval(hostHeartbeatInterval);
                        hostHeartbeatInterval = null;
                    }
                    actualizarUI();
                    renderLeaderboard();
                    saveSession();
                }
                return;
            }

            if (data.hostId && data.hostId !== hostId) {
                if (!hostId || hostConfirmedAbsent() || data.hostId < hostId) {
                    // El ultimo caso (data.hostId < hostId) es el mismo
                    // desempate deterministico de split-brain que en
                    // 'host_claim', aplicado tambien a los demas mensajes que
                    // llevan el hostId "de paso" (join/sync/etc).
                    hostId = data.hostId;
                    if (hostClaimTimer) {
                        clearTimeout(hostClaimTimer);
                        hostClaimTimer = null;
                    }
                    if (hostHeartbeatInterval && hostId !== myId) {
                        clearInterval(hostHeartbeatInterval);
                        hostHeartbeatInterval = null;
                    }
                }
            }

            if (data.action === 'start') {
                gameStarted = true;
                gameInitiator = data.id;
                cartas = data.cartas || [];
                tandaActual = data.tandaActual !== undefined ? data.tandaActual : 0;
                mazoRestante = data.mazoRestante || [];
                if (data.nuevoCiclo) {
                    // Este lote es el primero de un ciclo nuevo (los dos
                    // lotes que se reparten automaticamente por cada
                    // "Corredores").
                    cicloTandaInicio = tandaActual;
                }
                if (data.id !== myId && data.esPrimerLote) {
                    // Solo reiniciamos nuestro estado local si es el PRIMER
                    // lote de una partida nueva; si es un lote adicional
                    // (continuacion de la misma partida), conservamos
                    // nuestros puntos y demas datos actuales.
                    misSelecciones = [];
                    puntosPorJugador = {};
                    cartaActivaId = null;
                    copiasVisuales = {};
                    gruposExpansion31 = {};
                    if (playersData[myId]) playersData[myId].activeCardId = null;
                }
                estadoRonda = { usado3: false, usado2: false, ganadorCartaId: null, jugadorGanador: null };
                for (var pid in playersData) {
                    if (!puntosPorJugador[pid]) {
                        puntosPorJugador[pid] = 0;
                    }
                    if (playersData[pid] && playersData[pid].activeCardId === undefined) {
                        playersData[pid].activeCardId = null;
                    }
                }
                // Por si veniamos de una reconexion y nuestra carta activa
                // quedaba apuntando a algo que ya no cuadra con este lote.
                sanearMiActivaLocal();
                renderizarCartas();
                renderizarMisCorredores();
                actualizarUI();
                saveSession();
            }

            if (data.action === 'puntaje_global') {
                var jugadorId = data.id;
                var tipo = data.tipo;
                var nuevosPuntos = data.puntos;
                if (jugadorId === myId) {
                    puntosPorJugador[myId] = nuevosPuntos;
                } else {
                    if (!puntosPorJugador[jugadorId]) {
                        puntosPorJugador[jugadorId] = 0;
                    }
                    puntosPorJugador[jugadorId] = nuevosPuntos;
                }
                if (tipo === '+3' || tipo === '+2') {
                    estadoRonda.usado3 = (tipo === '+3');
                    estadoRonda.usado2 = (tipo === '+2');
                    if (tipo === '+3') {
                        estadoRonda.ganadorCartaId = data.cartaId || null;
                        estadoRonda.jugadorGanador = data.id;
                        for (var i = 0; i < cartas.length; i++) {
                            if (cartas[i].id === data.cartaId) {
                                cartas[i].esGanadora = true;
                                // Ver el comentario en puntaje.js: el dueno
                                // se guarda directo en la carta (no solo en
                                // playersData) para que sobreviva
                                // expulsiones/recargas.
                                cartas[i].nombreGanador = data.name || null;
                                break;
                            }
                        }
                        if (playersData[jugadorId]) {
                            if (!playersData[jugadorId].cartasGanadoras) {
                                playersData[jugadorId].cartasGanadoras = [];
                            }
                            if (playersData[jugadorId].cartasGanadoras.indexOf(data.cartaId) === -1) {
                                playersData[jugadorId].cartasGanadoras.push(data.cartaId);
                            }
                        }
                    }
                    if (tipo === '+2') {
                        // Cada jugador aplica el descarte en su propio
                        // dispositivo (en vez de esperar a que le llegue el
                        // "sync" de quien presiono el boton). Esto es lo que
                        // hace que la carta ganadora SI desaparezca de "Mis
                        // Corredores" en la pantalla del ganador, y que su
                        // activeCardId quede libre para la siguiente ronda.
                        if (typeof window.aplicarDescarteActivas === 'function') {
                            window.aplicarDescarteActivas(estadoRonda.jugadorGanador);
                        }
                        setTimeout(function() {
                            reiniciarRonda();
                        }, 500);
                    }
                }
                actualizarUI();
                saveSession();
            }

            if (data.action === 'estado_ronda') {
                estadoRonda = data.estado;
                actualizarUI();
                saveSession();
            }

            if (data.action === 'set_active') {
                var jugadorId = data.id;
                var activeCardId = data.activeCardId;
                if (playersData[jugadorId]) {
                    playersData[jugadorId].activeCardId = activeCardId;
                } else {
                    playersData[jugadorId] = { name: data.name || jugadorId, selecciones: [], cartasGanadoras: [], activeCardId: activeCardId };
                }
                renderizarMisCorredores();
                actualizarUI();
                saveSession();
            }

            if (data.action === 'select') {
                var cartaId = data.cartaId;
                var jugadorNombre = data.name;
                var jugadorId = data.id;
                var selecciones = data.selecciones || [];
                var tandaSelect = data.tandaActual !== undefined ? data.tandaActual : 0;
                
                for (var i = 0; i < cartas.length; i++) {
                    if (cartas[i].id === cartaId) {
                        cartas[i].seleccionadoPor = jugadorNombre;
                        cartas[i].seleccionadoPorId = jugadorId;
                        break;
                    }
                }
                
                if (playersData[jugadorId]) {
                    playersData[jugadorId].selecciones = selecciones;
                }
                
                if (jugadorId === myId) {
                    misSelecciones = selecciones.slice();
                }
                
                renderizarCartas();
                renderizarMisCorredores();
                renderLeaderboard();
                actualizarUI();
                saveSession();
                if (typeof window.verificarSiguienteLote === 'function') {
                    window.verificarSiguienteLote();
                }
            }

            if (data.action === 'sync') {
                if (data.cartas) {
                    mergeCartas(data.cartas);
                    renderizarCartas();
                }
                if (data.tandaActual !== undefined) {
                    tandaActual = data.tandaActual;
                }
                if (data.cicloTandaInicio !== undefined) {
                    cicloTandaInicio = data.cicloTandaInicio;
                }
                if (data.mazoRestante !== undefined) {
                    mazoRestante = data.mazoRestante;
                }
                if (data.gameStarted !== undefined) {
                    gameStarted = data.gameStarted;
                }
                if (data.gameInitiator) {
                    gameInitiator = data.gameInitiator;
                }
                if (data.playersData) {
                    for (var pid in data.playersData) {
                        if (pid !== myId) {
                            if (!playersData[pid]) {
                                playersData[pid] = { name: data.playersData[pid].name, selecciones: [], cartasGanadoras: [], activeCardId: null };
                            }
                            playersData[pid].name = data.playersData[pid].name;
                            playersData[pid].selecciones = data.playersData[pid].selecciones || [];
                            playersData[pid].cartasGanadoras = data.playersData[pid].cartasGanadoras || [];
                            // --- FIX: Solo actualizar si el mensaje incluye activeCardId ---
                            if (data.playersData[pid].activeCardId !== undefined) {
                                playersData[pid].activeCardId = activeCardIdSaneado(data.playersData[pid].activeCardId);
                            }
                        }
                    }
                }
                if (data.puntosPorJugador) {
                    for (var pid in data.puntosPorJugador) {
                        if (pid !== myId) {
                            puntosPorJugador[pid] = data.puntosPorJugador[pid];
                        }
                    }
                }
                if (data.estadoRonda) {
                    estadoRonda = data.estadoRonda;
                }
                // Ahora que ya sabemos el estado real de las cartas y de la
                // ronda, corregimos nuestra propia carta activa si quedo
                // apuntando a algo que ya no es valido (ver comentario en
                // sanearMiActivaLocal). Esto es lo que resuelve el caso de
                // "me desconecte, marcaron 1er/2do lugar sin mi, y al
                // volver no me deja usar ninguna carta".
                sanearMiActivaLocal();
                actualizarUI();
                saveSession();
            }

            if (data.action === 'request_state') {
                broadcastState('sync');
            }

            if (data.action === 'join' || data.action === 'sync') {
                var isNewJoin = data.action === 'join' && !playersData[data.id];
                if (!playersData[data.id]) {
                    playersData[data.id] = {
                        name: data.name,
                        selecciones: data.selecciones || [],
                        cartasGanadoras: data.cartasGanadoras || [],
                        activeCardId: data.activeCardId !== undefined ? activeCardIdSaneado(data.activeCardId) : null
                    };
                } else {
                    playersData[data.id].name = data.name;
                    playersData[data.id].selecciones = data.selecciones || [];
                    playersData[data.id].cartasGanadoras = data.cartasGanadoras || [];
                    // Solo actualizar si el mensaje incluye activeCardId
                    if (data.activeCardId !== undefined) {
                        playersData[data.id].activeCardId = activeCardIdSaneado(data.activeCardId);
                    }
                    // Si no viene, conservamos el valor que ya tenía
                }

                if (isNewJoin) {
                    // Ocultamos al recien llegado hasta saber si corresponde a un
                    // jugador que ya estaba en la sala (reclamo) o si es de verdad nuevo.
                    hideJoiningId(data.id);
                    scheduleRevealIfNoClaim(data.id);
                }

                renderLeaderboard();

                var cachedMatch = null;
                if (data.action === 'join') {
                    for (var id in playersData) {
                        if (id !== data.id && playersData[id].name === data.name) {
                            cachedMatch = id;
                            break;
                        }
                    }
                    if (cachedMatch) {
                        broadcastClaimOffer(data.id, cachedMatch);
                    } else if (removedPlayersRegistry[data.name]) {
                        // No hay coincidencia entre los jugadores actuales,
                        // pero este nombre corresponde a alguien que fue
                        // expulsado antes: le ofrecemos el mismo reclamo
                        // "eres tu?" para que recupere sus puntos y cartas
                        // (la carta ganadora/usada ya quedo descartada, asi
                        // que no vuelve a aparecer).
                        var respaldo = removedPlayersRegistry[data.name];
                        broadcastClaimOffer(data.id, respaldo.oldId, {
                            name: data.name,
                            selecciones: respaldo.selecciones,
                            cartasGanadoras: respaldo.cartasGanadoras,
                            puntos: respaldo.puntos
                        });
                    }
                }
            }

            // Red de contencion final: sin importar que tipo de mensaje haya
            // sido (join, sync, start, select, puntaje_global...), si acabamos
            // de aprender sobre otro jugador con nuestro mismo nombre y todavia
            // no se resolvio ningun reclamo, lo detectamos aca mismo.
            verificarDuplicadoPropioLocal();

        } catch(e) { 
            console.error('Mensaje invalido', e); 
        }
    });

    mqttClient.on('error', function(err) {
        hideLoading();
        showNotice('Error de red. Revisa tu internet.', 'Sin conexion');
    });
}

// Aviso explicito al cerrar la pestaña, cambiar de app, o navegar fuera: el
// Last Will de MQTT solo cubre cortes "sucios" de la conexion, no un cierre
// normal (el navegador puede desconectar el WebSocket de forma prolija sin
// que el broker lo interprete como una caida). Publicamos el mismo mensaje
// que publicaria el Will, de forma best-effort (no siempre llega a tiempo si
// el navegador mata la pagina de inmediato, por eso sigue existiendo el
// timeout de chequearPresenciaStale() como segunda red de contencion).
function avisarSalidaExplicita() {
    try {
        if (mqttClient && currentRoom && myId) {
            mqttClient.publish(
                'magical_athlete/room/' + currentRoom,
                JSON.stringify({ action: 'presence_lost', id: myId }),
                { qos: 0 }
            );
        }
    } catch (e) {}
}
window.addEventListener('pagehide', avisarSalidaExplicita);
window.addEventListener('beforeunload', avisarSalidaExplicita);

function broadcastState(action) {
    if (action === undefined) action = 'sync';
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: action,
            id: myId,
            name: myName,
            selecciones: misSelecciones || [],
            cartas: cartas || [],
            tandaActual: tandaActual,
            cicloTandaInicio: cicloTandaInicio,
            mazoRestante: mazoRestante || [],
            gameStarted: gameStarted,
            gameInitiator: gameInitiator || null,
            playersData: playersData,
            puntosPorJugador: puntosPorJugador,
            estadoRonda: estadoRonda,
            hostId: hostId || null,
            // Usado para descartar snapshots retenidos viejos de salas
            // abandonadas (ver ROOM_STALE_MS).
            updatedAt: Date.now()
        });
        var opts = { qos: 1 };
        // Los mensajes "sync" se retienen en el broker: asi, cualquier
        // jugador que se conecte o reconecte (celular apagado, se salio de
        // la pagina, etc.) recibe el ultimo estado conocido INMEDIATAMENTE
        // al suscribirse, sin depender de que otro cliente le responda a
        // tiempo con el estado.
        if (action === 'sync') {
            opts.retain = true;
        }
        mqttClient.publish(topic, payload, opts);
    }
}

function broadcastRequestState() {
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'request_state',
            id: myId
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastHostClaim() {
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'host_claim',
            id: myId
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastStart(cartasArray, tanda, mazo, esPrimerLote, nuevoCiclo) {
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'start',
            id: myId,
            name: myName,
            cartas: cartasArray,
            tandaActual: tanda !== undefined ? tanda : 0,
            cicloTandaInicio: cicloTandaInicio,
            mazoRestante: mazo || [],
            esPrimerLote: !!esPrimerLote,
            nuevoCiclo: !!nuevoCiclo,
            gameStarted: true,
            playersData: playersData,
            puntosPorJugador: puntosPorJugador,
            estadoRonda: estadoRonda,
            hostId: hostId || null,
            updatedAt: Date.now()
        });
        mqttClient.publish(topic, payload, { qos: 1, retain: true });
        gameStarted = true;
        gameInitiator = myId;
        tandaActual = tanda !== undefined ? tanda : 0;
        mazoRestante = mazo || [];
    }
}

function broadcastSelect(cartaId) {
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'select',
            id: myId,
            name: myName,
            cartaId: cartaId,
            selecciones: misSelecciones || [],
            tandaActual: tandaActual
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastPuntajeGlobal(tipo) {
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'puntaje_global',
            id: myId,
            name: myName,
            tipo: tipo,
            puntos: puntosPorJugador[myId],
            cartaId: estadoRonda.ganadorCartaId || null
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastEstadoRonda() {
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'estado_ronda',
            id: myId,
            estado: estadoRonda
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastRemove(idToRemove, removedSnapshot) {
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'remove',
            id: idToRemove,
            // removedSnapshot (opcional): datos del jugador justo antes de
            // borrarlo, para que todos los clientes puedan ofrecerle el
            // reclamo "eres tu?" si vuelve a entrar con el mismo nombre
            // (ver removedPlayersRegistry).
            removedName: removedSnapshot ? removedSnapshot.name : null,
            removedSelecciones: removedSnapshot ? removedSnapshot.selecciones : null,
            removedCartasGanadoras: removedSnapshot ? removedSnapshot.cartasGanadoras : null,
            removedPuntos: removedSnapshot ? removedSnapshot.puntos : null
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastReset() {
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'reset_all',
            id: myId,
            name: myName
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastClaimOffer(targetId, offeredId, overrideData) {
    if (mqttClient && currentRoom) {
        // overrideData (opcional): usado cuando offeredId ya no existe en
        // playersData porque pertenece a un jugador expulsado -- en ese
        // caso los datos vienen de removedPlayersRegistry en vez de la
        // copia local de playersData.
        var cached = overrideData || playersData[offeredId];
        if (!cached) return;
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'claim_offer',
            targetId: targetId,
            offeredId: offeredId,
            name: cached.name,
            selecciones: cached.selecciones || [],
            cartasGanadoras: cached.cartasGanadoras || [],
            puntos: overrideData ? (overrideData.puntos || 0) : (puntosPorJugador[offeredId] || 0)
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastSetActive(playerId, activeCardId) {
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'set_active',
            id: playerId,
            activeCardId: activeCardId
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}
window.broadcastSetActive = broadcastSetActive;

function showClaimModal(claim) {
    var modal = document.getElementById('claimModal');
    var text = document.getElementById('claimText');
    if (text) {
        text.textContent = 'Ya hay un jugador "' + claim.name + '" en la sala con ' + 
                          (claim.selecciones ? claim.selecciones.length : 0) + 
                          ' cartas seleccionadas y ' + (claim.puntos || 0) +
                          ' puntos. Eres tu (te desconectaste antes)?';
    }
    if (modal) modal.style.display = 'flex';
}

function acceptClaim() {
    if (!pendingClaim) return;
    var staleTempId = myId;

    broadcastRemove(staleTempId);

    delete playersData[staleTempId];
    delete puntosPorJugador[staleTempId];
    forgetJoiningId(staleTempId);

    myId = pendingClaim.oldId;
    misSelecciones = pendingClaim.selecciones.slice();

    // BUG FIX: el reclamo trae los puntos viejos en pendingClaim.puntos (ya sea
    // por la via "otro jugador me detecto al unirme" -claim_offer-, que solo manda
    // un numero suelto, o por la deteccion propia via sync). Antes este valor se
    // guardaba en pendingClaim pero nunca se escribia en puntosPorJugador[myId],
    // asi que al aceptar el reclamo la UI seguia mostrando 0 puntos aunque la
    // fusion de identidad (nombre, cartas, selecciones) si funcionara.
    if (!puntosPorJugador[myId] || puntosPorJugador[myId] < (pendingClaim.puntos || 0)) {
        puntosPorJugador[myId] = pendingClaim.puntos || 0;
    }

    // BUG FIX: antes este bloque solo restauraba cartasGanadoras. La entrada
    // playersData[myId] (mi propia fila en el leaderboard) se creaba con
    // selecciones: [] y nunca se le cargaban las cartas recuperadas en
    // pendingClaim.selecciones (aunque misSelecciones -usada solo en el panel
    // "Mis Corredores"- si quedaba correcta). Como los sync entrantes NUNCA
    // tocan mi propio id (ver el "if (pid !== myId)" en el manejo de
    // 'sync'), esa entrada vacia quedaba congelada para siempre: mi propia
    // fila del leaderboard aparecia sin selecciones, y como yo soy quien
    // retransmite ese playersData[myId] a los demas (via broadcastState),
    // el resto de la sala tambien terminaba viendome sin cartas.
    if (!playersData[myId]) {
        playersData[myId] = { name: myName, selecciones: [], cartasGanadoras: [], activeCardId: null };
    }
    playersData[myId].name = myName;
    playersData[myId].selecciones = misSelecciones.slice();
    playersData[myId].cartasGanadoras = (pendingClaim.cartasGanadoras || []).slice();

    if (cartas.length > 0) {
        for (var i = 0; i < cartas.length; i++) {
            if (cartas[i].seleccionadoPorId === myId) {
                cartas[i].seleccionadoPor = myName;
                cartas[i].seleccionadoPorId = myId;
            }
        }
        renderizarCartas();
        renderizarMisCorredores();
    }

    document.getElementById('claimModal').style.display = 'none';
    pendingClaim = null;
    actualizarUI();
    saveSession();

    // Pedimos el estado fresco de inmediato (en vez de esperar hasta 15s al
    // proximo heartbeat del anfitrion) para recuperar hostId y cualquier otro
    // dato de red correcto ahora que ya tenemos nuestro id real.
    broadcastRequestState();
    broadcastState('sync');
}

// ===== ELIMINAR JUGADOR (SOLO ANFITRION) =====
// Pensado para el caso real: un jugador quedo "bugueado" (se le apago el
// celular, perdio señal por mucho tiempo, etc.) y esta bloqueando la
// partida. El anfitrion puede sacarlo; el jugador eliminado debe volver a
// entrar manualmente si quiere seguir jugando.
// Igual que en Yatzy: el boton en el leaderboard solo ABRE el modal propio
// (removePlayerModal, ya definido en index.html) con el nombre cargado; la
// eliminacion real ocurre recien en confirmRemovePlayer() cuando el
// anfitrion confirma dentro del modal.
var pendingRemoveId = null;

function solicitarEliminarJugador(id) {
    if (hostId !== myId) {
        showNotice('Solo el anfitrion puede eliminar jugadores.');
        return;
    }
    if (id === myId) return;
    if (!playersData[id]) return;
    pendingRemoveId = id;
    var nombre = playersData[id].name || 'este jugador';
    var textEl = document.getElementById('removePlayerText');
    if (textEl) {
        textEl.textContent = 'Eliminar a "' + nombre + '" de la sala? Sus corredores ya elegidos quedan como registro, pero no podra seguir jugando salvo que vuelva a entrar.';
    }
    var modal = document.getElementById('removePlayerModal');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        // Respaldo por si el modal no esta en el HTML (no deberia pasar):
        // no usamos confirm() nativo, asi que preferimos avisar y no actuar
        // en vez de mostrar el dialogo feo del navegador.
        pendingRemoveId = null;
        console.error('removePlayerModal no encontrado en el HTML.');
        showNotice('No se pudo abrir el dialogo de eliminar jugador. Recarga la pagina e intenta de nuevo.');
    }
}
window.solicitarEliminarJugador = solicitarEliminarJugador;

function closeRemovePlayerModal() {
    pendingRemoveId = null;
    var modal = document.getElementById('removePlayerModal');
    if (modal) modal.style.display = 'none';
}
window.closeRemovePlayerModal = closeRemovePlayerModal;

function confirmRemovePlayer() {
    var id = pendingRemoveId;
    closeRemovePlayerModal();
    if (!id) return;
    if (hostId !== myId) return;
    if (!playersData[id]) return;

    // BUG FIX: esto descartaba TODAS las cartas que el jugador tuviera
    // seleccionadas (seleccionadoPorId === id), no solo la que estaba en
    // juego (la ganadora si iba primero, o su activeCardId). Eso borraba
    // tambien sus otros corredores que todavia no habia usado -cartas
    // pensadas para rondas futuras-, asi que si volvia a entrar y
    // reclamaba su identidad, "Mis Corredores" aparecia vacio ("No tienes
    // cartas disponibles") aunque sus puntos si se recuperaran. Solo la
    // carta realmente en juego debe desaparecer; el resto de su mano sigue
    // siendo valida para cuando vuelva a entrar.
    //
    // REVERTIDO: se probo dejar la carta del 1er lugar SIN descartar hasta
    // que alguien marcara "2°" (para imitar mas de cerca lo que pasaria si
    // el jugador seguia conectado), pero eso rompio la posibilidad de
    // marcar "2°" para el resto. Se vuelve al comportamiento anterior, que
    // si funcionaba: la carta activa/ganadora del eliminado se descarta de
    // inmediato, sin excepcion para el 1er lugar.
    var activeCardDelEliminado = playersData[id].activeCardId || null;
    if (activeCardDelEliminado) {
        for (var ci = 0; ci < cartas.length; ci++) {
            if (cartas[ci].id === activeCardDelEliminado && !cartas[ci].descartada) {
                cartas[ci].descartada = true;
            }
        }
    }

    // Snapshot para el reclamo "eres tu?" si vuelve a entrar con el mismo
    // nombre mas adelante (ver removedPlayersRegistry). Se toma ANTES de
    // borrar la entrada; las selecciones incluyen la carta recien
    // descartada arriba, pero como ya quedo con descartada=true, al
    // reclamarla simplemente no se le vuelve a mostrar (igual que
    // renderizarMisCorredores ya filtra cartas descartadas).
    var removedSnapshot = {
        name: playersData[id].name,
        selecciones: (playersData[id].selecciones || []).slice(),
        cartasGanadoras: (playersData[id].cartasGanadoras || []).slice(),
        puntos: puntosPorJugador[id] || 0
    };
    removedPlayersRegistry[removedSnapshot.name] = {
        oldId: id,
        selecciones: removedSnapshot.selecciones,
        cartasGanadoras: removedSnapshot.cartasGanadoras,
        puntos: removedSnapshot.puntos
    };

    delete playersData[id];
    delete puntosPorJugador[id];
    broadcastRemove(id, removedSnapshot);
    // Sincronizamos el estado de las cartas (con las del eliminado ya
    // descartadas) para que a nadie le quede una carta "fantasma" de un
    // jugador que ya no existe bloqueando, por ejemplo, el cierre del
    // ciclo de corredores. estadoRonda no se toca: si el eliminado era el
    // jugador en 1°, estadoRonda.jugadorGanador sigue apuntando a su id
    // (solo se usa como comparacion, ya no necesita existir en
    // playersData), asi que el 1° sigue bloqueado y el 2° sigue habilitado
    // para el resto exactamente igual que si siguiera conectado.
    broadcastState('sync');

    renderLeaderboard();
    actualizarUI();
    saveSession();
}
window.confirmRemovePlayer = confirmRemovePlayer;

// ===== SER ELIMINADOS DE LA SALA =====
function handleRemovedFromRoom() {
    hideLoading();

    // Cerramos cualquier modal que pudiera haber quedado abierto (igual que
    // en Yatzy) antes de volver al lobby y avisar.
    ['claimModal', 'resetGameModal', 'removePlayerModal', 'zoomModal', 'ganadoresModal', 'intercambioModal'].forEach(function(id) {
        var modal = document.getElementById(id);
        if (modal) modal.style.display = 'none';
    });
    pendingRemoveId = null;

    if (hostClaimTimer) { clearTimeout(hostClaimTimer); hostClaimTimer = null; }
    if (hostHeartbeatInterval) { clearInterval(hostHeartbeatInterval); hostHeartbeatInterval = null; }
    if (presencePingInterval) { clearInterval(presencePingInterval); presencePingInterval = null; }
    if (mqttClient) { try { mqttClient.end(true); } catch (e) {} mqttClient = null; }

    currentRoom = null;
    playersData = {};
    puntosPorJugador = {};
    estadoRonda = { usado3: false, usado2: false, ganadorCartaId: null, jugadorGanador: null };
    cartas = [];
    misSelecciones = [];
    cartaActivaId = null;
    tandaActual = -1;
    cicloTandaInicio = 0;
    mazoRestante = [];
    copiasVisuales = {};
    gruposExpansion31 = {};
    gameStarted = false;
    gameInitiator = null;
    hostId = null;

    renderizarCartas();
    renderizarMisCorredores();
    actualizarUI();
    renderLeaderboard();

    var info = document.getElementById('roomInfoDisplay');
    if (info) info.style.display = 'none';
    var leaderboardPanel = document.getElementById('leaderboardPanel');
    if (leaderboardPanel) leaderboardPanel.style.display = 'none';

    clearSession();
    var banner = document.getElementById('sessionBanner');
    if (banner) banner.style.display = 'none';
    var reconnectBtn = document.getElementById('reconnectBtn');
    if (reconnectBtn) {
        reconnectBtn.disabled = true;
        reconnectBtn.style.opacity = '0.5';
        reconnectBtn.style.cursor = 'not-allowed';
    }

    var lobby = document.getElementById('lobbyModal');
    if (lobby) lobby.style.display = 'flex';

    showNotice('El anfitrion te elimino de la sala. Debes volver a entrar para unirte de nuevo.', 'Fuera de la partida');
}
window.handleRemovedFromRoom = handleRemovedFromRoom;

function declineClaim() {
    pendingClaim = null;
    document.getElementById('claimModal').style.display = 'none';
    // Confirmamos que somos un jugador distinto: nos revelamos y avisamos al
    // resto de la sala para que tambien nos muestren en el leaderboard.
    revealJoiningId(myId);
    if (mqttClient && currentRoom) {
        mqttClient.publish('magical_athlete/room/' + currentRoom, JSON.stringify({ action: 'claim_declined', id: myId }));
    }
}