// cartase.js
// ===== CARTAS ESPECIALES: 17, 33 y EXPANSION_31 =====

// Variable global para el grupo de copias visuales de la Expansion_31
var gruposExpansion31 = {};
var opciones17 = {};
var opciones33 = {};

// Numero de la carta especial "Expansion_31" (acumulativa, sin limite)
var EXPANSION_31_NUMERO = TOTAL_IMAGENES_BASE + 31; // 67

// Numero de la carta especial "Expansion_13" (copia la habilidad de un
// corredor que otro jugador este usando actualmente)
var EXPANSION_13_NUMERO = TOTAL_IMAGENES_BASE + 13; // 49

// Opciones ya calculadas para el modal de Expansion_13 (para volver a
// mostrar el mismo modal si se cierra sin elegir, igual que con 17/33)
var opcionesExpansion13 = {};

// Exponer al ambito global
window.EXPANSION_31_NUMERO = EXPANSION_31_NUMERO;
window.EXPANSION_13_NUMERO = EXPANSION_13_NUMERO;
window.gruposExpansion31 = gruposExpansion31;

// ===== INTERCAMBIO POR CARTA 17 =====
function intercambiarPor17(cartaActual) {
    if (copiasVisuales[cartaActual.id]) return;

    if (opciones17[cartaActual.id]) {
        mostrarModalSeleccion(
            opciones17[cartaActual.id],
            'Elige un corredor para copiar (17) - solo tu lo veras asi',
            function(elegido) {
                copiasVisuales[cartaActual.id] = { numero: elegido.numero, imagen: elegido.imagen };
                renderizarCartas();
                renderizarMisCorredores();
                actualizarUI();
                saveSession();
                delete opciones17[cartaActual.id];
            }
        );
        return;
    }

    if (!mazoRestante || mazoRestante.length === 0) {
        showNotice('No quedan corredores en el mazo para copiar.');
        return;
    }
    var candidatosNumeros = mazoRestante.filter(function(n) {
        return n !== 17 && n !== 33;
    });
    if (candidatosNumeros.length === 0) {
        showNotice('No quedan corredores disponibles en el mazo para copiar.');
        return;
    }
    var mezclados = candidatosNumeros.slice();
    for (var i = mezclados.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = mezclados[i];
        mezclados[i] = mezclados[j];
        mezclados[j] = temp;
    }
    var seleccionables = mezclados.slice(0, Math.min(3, mezclados.length)).map(function(n) {
        return { numero: n, imagen: getImagenCarta(n) };
    });

    opciones17[cartaActual.id] = seleccionables;

    mostrarModalSeleccion(
        seleccionables,
        'Elige un corredor para copiar (17) - solo tu lo veras asi',
        function(elegido) {
            copiasVisuales[cartaActual.id] = { numero: elegido.numero, imagen: elegido.imagen };
            renderizarCartas();
            renderizarMisCorredores();
            actualizarUI();
            saveSession();
            delete opciones17[cartaActual.id];
        }
    );
}

// ===== INTERCAMBIO POR CARTA 33 =====
function intercambiarPor33(cartaActual) {
    if (copiasVisuales[cartaActual.id]) return;

    if (opciones33[cartaActual.id]) {
        mostrarModalSeleccion(
            opciones33[cartaActual.id],
            'Elige una carta ganadora para copiar (33) - solo tu la veras asi',
            function(elegido) {
                copiasVisuales[cartaActual.id] = { numero: elegido.numero, imagen: elegido.imagen };
                renderizarCartas();
                renderizarMisCorredores();
                actualizarUI();
                saveSession();
                delete opciones33[cartaActual.id];
            }
        );
        return;
    }

    var vistos = {};
    var ganadoras = cartas.filter(function(c) {
        if (c.id === cartaActual.id) return false;
        if (!c.esGanadora) return false;
        if (c.numero === 17 || c.numero === 33) return false;
        if (vistos[c.numero]) return false;
        vistos[c.numero] = true;
        return true;
    });
    if (ganadoras.length === 0) {
        showNotice('No hay cartas ganadoras disponibles (o son especiales).');
        return;
    }

    opciones33[cartaActual.id] = ganadoras;

    mostrarModalSeleccion(
        ganadoras,
        'Elige una carta ganadora para copiar (33) - solo tu la veras asi',
        function(elegido) {
            copiasVisuales[cartaActual.id] = { numero: elegido.numero, imagen: elegido.imagen };
            renderizarCartas();
            renderizarMisCorredores();
            actualizarUI();
            saveSession();
            delete opciones33[cartaActual.id];
        }
    );
}

// ===== INTERCAMBIO POR CARTA EXPANSION_13 (copiar habilidad de jugador) =====
// A diferencia de 17/33 (que copian entre corredores del mazo), esta carta
// copia la habilidad de un corredor que otro jugador tenga actualmente
// "en uso" (su activeCardId). No se puede copiar una carta especial (17,
// 33 o Expansion_31): esas opciones se muestran en el modal pero
// bloqueadas, para que quede claro que existen pero no son elegibles.
function intercambiarPorExpansion13(cartaActual) {
    if (copiasVisuales[cartaActual.id]) return;

    if (opcionesExpansion13[cartaActual.id]) {
        mostrarModalSeleccionJugadores(
            opcionesExpansion13[cartaActual.id],
            'Elige la habilidad de un jugador para copiar (13) - solo tu la veras asi',
            function(elegido) {
                copiasVisuales[cartaActual.id] = { numero: elegido.numero, imagen: elegido.imagen };
                renderizarCartas();
                renderizarMisCorredores();
                actualizarUI();
                saveSession();
                delete opcionesExpansion13[cartaActual.id];
            }
        );
        return;
    }

    var candidatos = [];
    for (var pid in playersData) {
        if (pid === myId) continue;
        var pdata = playersData[pid];
        if (!pdata || !pdata.activeCardId) continue;

        var cartaActiva = null;
        for (var i = 0; i < cartas.length; i++) {
            if (cartas[i].id === pdata.activeCardId) {
                cartaActiva = cartas[i];
                break;
            }
        }
        if (!cartaActiva || cartaActiva.descartada) continue;

        var esEspecialBloqueada = (
            cartaActiva.numero === 17 ||
            cartaActiva.numero === 33 ||
            (typeof EXPANSION_31_NUMERO !== 'undefined' && cartaActiva.numero === EXPANSION_31_NUMERO)
        );

        candidatos.push({
            numero: cartaActiva.numero,
            imagen: cartaActiva.imagen,
            nombreJugador: pdata.name || 'Jugador',
            bloqueada: esEspecialBloqueada
        });
    }

    if (candidatos.length === 0) {
        showNotice('Ningun otro jugador esta usando un corredor todavia.');
        return;
    }

    opcionesExpansion13[cartaActual.id] = candidatos;

    mostrarModalSeleccionJugadores(
        candidatos,
        'Elige la habilidad de un jugador para copiar (13) - solo tu la veras asi',
        function(elegido) {
            copiasVisuales[cartaActual.id] = { numero: elegido.numero, imagen: elegido.imagen };
            renderizarCartas();
            renderizarMisCorredores();
            actualizarUI();
            saveSession();
            delete opcionesExpansion13[cartaActual.id];
        }
    );
}

// ===== EXPANSION_31 (acumulativa) =====
function generarCartaAleatoriaVisual() {
    var numero;
    do {
        numero = Math.floor(Math.random() * TOTAL_IMAGENES) + 1;
    } while (numero === 17 || numero === 33);
    return { numero: numero, imagen: getImagenCarta(numero) };
}

function activarExpansion31(carta) {
    if (!gruposExpansion31[carta.id]) {
        gruposExpansion31[carta.id] = [{ numero: carta.numero, imagen: carta.imagen }];
    }
    mostrarGrupoExpansion31(carta.id);
}

function mostrarGrupoExpansion31(cartaId) {
    var zoomModal = document.getElementById('zoomModal');
    if (zoomModal) zoomModal.style.display = 'none';

    if (!gruposExpansion31[cartaId] || gruposExpansion31[cartaId].length === 0) {
        var cartaBase = null;
        for (var i = 0; i < cartas.length; i++) {
            if (cartas[i].id === cartaId) {
                cartaBase = cartas[i];
                break;
            }
        }
        if (!cartaBase) return;
        gruposExpansion31[cartaId] = [{ numero: cartaBase.numero, imagen: cartaBase.imagen }];
    }

    var modal = document.getElementById('intercambioModal');
    var contenido = document.getElementById('intercambioContenido');
    var tituloElem = document.getElementById('intercambioTitulo');
    if (!modal || !contenido || !tituloElem) return;

    tituloElem.textContent = 'Tus corredores (Expansion 31) - solo tu los ves';
    contenido.innerHTML = '';

    var grupo = gruposExpansion31[cartaId];
    grupo.forEach(function(item, idx) {
        var div = document.createElement('div');
        div.className = 'carta-opcion';
        var img = document.createElement('img');
        img.src = item.imagen;
        img.alt = '#' + item.numero;
        img.loading = 'lazy';
        div.appendChild(img);
        var span = document.createElement('span');
        span.textContent = '#' + item.numero;
        div.appendChild(span);
        div.addEventListener('click', function(e) {
            e.stopPropagation();
            abrirZoomGrupoItem(cartaId, idx);
        });
        contenido.appendChild(div);
    });

    var addDiv = document.createElement('div');
    addDiv.className = 'carta-opcion carta-opcion-agregar';
    var addSigno = document.createElement('span');
    addSigno.className = 'agregar-signo';
    addSigno.textContent = '+';
    addDiv.appendChild(addSigno);
    var addLabel = document.createElement('span');
    addLabel.textContent = 'Agregar';
    addDiv.appendChild(addLabel);
    addDiv.addEventListener('click', function(e) {
        e.stopPropagation();
        agregarCartaAGrupo(cartaId);
    });
    contenido.appendChild(addDiv);

    modal.style.display = 'flex';
}

function agregarCartaAGrupo(cartaId) {
    if (!gruposExpansion31[cartaId]) {
        gruposExpansion31[cartaId] = [];
    }
    gruposExpansion31[cartaId].push(generarCartaAleatoriaVisual());
    saveSession();
    mostrarGrupoExpansion31(cartaId);
}

function abrirZoomGrupoItem(cartaId, idx) {
    var grupo = gruposExpansion31[cartaId];
    if (!grupo || !grupo[idx]) return;
    var item = grupo[idx];

    var intercambioModal = document.getElementById('intercambioModal');
    if (intercambioModal) intercambioModal.style.display = 'none';

    var modal = document.getElementById('zoomModal');
    var content = document.getElementById('zoomContent');
    if (!modal || !content) return;
    content.innerHTML = '';

    var img = document.createElement('img');
    img.src = item.imagen;
    img.alt = 'Corredor ' + item.numero;
    content.appendChild(img);

    var info = document.createElement('div');
    info.className = 'zoom-info';
    var prefijo = getPrefijoCarta(item.numero);
    info.innerHTML = 'Corredor <span>' + prefijo + ' - #' + item.numero + '</span>';
    content.appendChild(info);

    var btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '10px';
    btnRow.style.flexWrap = 'wrap';
    btnRow.style.justifyContent = 'center';

    var btnMas = document.createElement('button');
    btnMas.className = 'btn-choose';
    btnMas.textContent = '+ Agregar otro';
    btnMas.addEventListener('click', function() {
        agregarCartaAGrupo(cartaId);
    });
    btnRow.appendChild(btnMas);

    var btnVolver = document.createElement('button');
    btnVolver.className = 'modal-btn btn-secondary';
    btnVolver.textContent = 'Volver';
    btnVolver.addEventListener('click', function() {
        mostrarGrupoExpansion31(cartaId);
    });
    btnRow.appendChild(btnVolver);

    content.appendChild(btnRow);
    modal.style.display = 'flex';
}

// Exponer funciones globalmente
window.intercambiarPor17 = intercambiarPor17;
window.intercambiarPor33 = intercambiarPor33;
window.intercambiarPorExpansion13 = intercambiarPorExpansion13;
window.activarExpansion31 = activarExpansion31;
window.mostrarGrupoExpansion31 = mostrarGrupoExpansion31;
window.agregarCartaAGrupo = agregarCartaAGrupo;
window.abrirZoomGrupoItem = abrirZoomGrupoItem;