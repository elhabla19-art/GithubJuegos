// ui.js
function renderizarCartas() {
    var grid = document.getElementById('card-grid');
    grid.innerHTML = '';
    var boardContainer = document.querySelector('.board-container');
    
    if (!cartas || cartas.length === 0 || tandaActual < 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">Presiona "Corredores" para comenzar la partida</div>';
        if (boardContainer) boardContainer.style.display = 'block';
        return;
    }
    
    var disponibles = cartas.filter(function(c) {
        return c.tanda === tandaActual && !c.seleccionadoPor && !c.descartada;
    });
    
    if (disponibles.length === 0) {
        var cicloYaTerminado = (typeof cicloTerminado === 'function') && cicloTerminado();
        if (cicloYaTerminado) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">Presiona "Corredores" para repartir un nuevo lote</div>';
        } else {
            var loteCompleto = (typeof todosLotesCicloCompletos === 'function') && todosLotesCicloCompletos();
            if (!loteCompleto) {
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">Repartiendo el siguiente lote de corredores...</div>';
            } else {
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">Corredores en juego. Cuando todos usen y descarten sus 4 corredores, presiona "Corredores" para repartir un nuevo lote.</div>';
            }
        }
        if (boardContainer) boardContainer.style.display = 'block';
        return;
    }
    
    if (boardContainer) boardContainer.style.display = 'block';
    
    for (var i = 0; i < disponibles.length; i++) {
        var carta = disponibles[i];
        var cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        cardDiv.dataset.id = carta.id;
        var img = document.createElement('img');
        img.src = carta.imagen;
        img.alt = 'Corredor ' + carta.numero;
        img.loading = 'lazy';
        cardDiv.appendChild(img);
        var numberSpan = document.createElement('div');
        numberSpan.className = 'card-number';
        var prefijo = getPrefijoCarta(carta.numero);
        numberSpan.textContent = prefijo + ' - #' + carta.numero;
        cardDiv.appendChild(numberSpan);
        var overlay = document.createElement('div');
        overlay.className = 'card-overlay';
        var overlaySpan = document.createElement('span');
        overlaySpan.textContent = 'Disponible';
        overlay.appendChild(overlaySpan);
        cardDiv.appendChild(overlay);
        (function(c) {
            cardDiv.addEventListener('click', function() {
                if (!c.seleccionadoPor && !c.descartada) {
                    abrirZoom(c, true);
                }
            });
        })(carta);
        grid.appendChild(cardDiv);
    }
}

function showLoading(text) {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingModal').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingModal').style.display = 'none';
}

function renderizarMisCorredores() {
    var container = document.getElementById('my-cards-container');
    container.innerHTML = '';
    if (misSelecciones.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'empty-message';
        empty.textContent = 'Aun no has seleccionado corredores';
        container.appendChild(empty);
        return;
    }
    var misCartas = [];
    for (var i = 0; i < misSelecciones.length; i++) {
        var cId = misSelecciones[i];
        var carta = null;
        for (var j = 0; j < cartas.length; j++) {
            if (cartas[j].id === cId) {
                carta = cartas[j];
                break;
            }
        }
        if (carta && !carta.descartada) {
            misCartas.push(carta);
        }
    }
    if (misCartas.length === 0) {
        var empty2 = document.createElement('div');
        empty2.className = 'empty-message';
        empty2.textContent = 'No tienes cartas disponibles';
        container.appendChild(empty2);
        return;
    }
    var activeId = playersData[myId] ? playersData[myId].activeCardId : null;
    for (var k = 0; k < misCartas.length; k++) {
        var carta = misCartas[k];
        var visual = (typeof copiasVisuales !== 'undefined' && copiasVisuales[carta.id]) ? copiasVisuales[carta.id] : null;
        var numeroMostrado = visual ? visual.numero : carta.numero;
        var imagenMostrada = visual ? visual.imagen : carta.imagen;
        var esActiva = (activeId === carta.id);
        var esGanadora = carta.esGanadora || false;
        var wrapper = document.createElement('div');
        wrapper.className = 'my-card-wrapper' + (esActiva ? ' activa' : '') + (esGanadora ? ' ganadora' : '');
        var imgContainer = document.createElement('div');
        imgContainer.className = 'my-card-img';
        imgContainer.addEventListener('click', function(c, v) {
            return function(e) {
                e.stopPropagation();

                // Si ya tiene copia visual, mostrar zoom de la copia
                if (v) {
                    var cartaParaZoom = {
                        id: c.id,
                        numero: v.numero,
                        imagen: v.imagen,
                        seleccionadoPor: c.seleccionadoPor,
                        seleccionadoPorId: c.seleccionadoPorId,
                        esGanadora: c.esGanadora,
                        descartada: c.descartada,
                        tanda: c.tanda
                    };
                    abrirZoom(cartaParaZoom, false, true);
                    return;
                }

                // Verificar si la carta está activa
                var esActiva = (playersData[myId] && playersData[myId].activeCardId === c.id);

                // Si está activa y es especial, mostrar modal correspondiente
                if (esActiva) {
                    if (c.numero === 17) {
                        intercambiarPor17(c);
                        return;
                    } else if (c.numero === 33) {
                        intercambiarPor33(c);
                        return;
                    } else if (typeof EXPANSION_31_NUMERO !== 'undefined' && c.numero === EXPANSION_31_NUMERO) {
                        activarExpansion31(c);
                        return;
                    } else if (typeof EXPANSION_13_NUMERO !== 'undefined' && c.numero === EXPANSION_13_NUMERO) {
                        intercambiarPorExpansion13(c);
                        return;
                    }
                }

                // En cualquier otro caso, mostrar zoom normal
                abrirZoom(c, false, true);
            };
        }(carta, visual));
        var img = document.createElement('img');
        img.src = imagenMostrada;
        img.alt = 'Corredor ' + numeroMostrado;
        imgContainer.appendChild(img);
        var num = document.createElement('div');
        num.className = 'mini-number';
        var prefijo = getPrefijoCarta(numeroMostrado);
        num.textContent = prefijo + ' - #' + numeroMostrado;
        imgContainer.appendChild(num);
        if (esGanadora) {
            var badge = document.createElement('div');
            badge.className = 'ganadora-badge';
            badge.textContent = 'GANADORA';
            imgContainer.appendChild(badge);
        }
        wrapper.appendChild(imgContainer);
        var btnUsar = document.createElement('button');
        btnUsar.className = 'btn-sm btn-usar';
        var faseSeleccionCompleta = (typeof todosLotesCicloCompletos !== 'function') || todosLotesCicloCompletos();
        if (esActiva) {
            btnUsar.textContent = 'En uso';
        } else if (!faseSeleccionCompleta) {
            btnUsar.textContent = 'Espera...';
        } else {
            btnUsar.textContent = 'Usar';
        }
        if (carta.esGanadora || carta.descartada || esActiva) {
            btnUsar.disabled = true;
        } else if (activeId) {
            btnUsar.disabled = true;
        } else if (!faseSeleccionCompleta) {
            btnUsar.disabled = true;
        }
        btnUsar.addEventListener('click', function(cId) {
            return function(e) {
                e.stopPropagation();
                setActiveCard(cId);
            };
        }(carta.id));
        wrapper.appendChild(btnUsar);
        container.appendChild(wrapper);
    }
}

// ===== AVISO GENERAL (reemplaza alert() nativo, igual que en Yatzy) =====
function showNotice(text, title) {
    if (title === undefined) title = 'Aviso';
    var titleEl = document.getElementById('noticeTitle');
    var textEl = document.getElementById('noticeText');
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    var modal = document.getElementById('noticeModal');
    if (modal) modal.style.display = 'flex';
}
function closeNotice() {
    var modal = document.getElementById('noticeModal');
    if (modal) modal.style.display = 'none';
}
window.showNotice = showNotice;
window.closeNotice = closeNotice;