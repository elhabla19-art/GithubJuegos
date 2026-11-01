// ui.js
function renderizarCartas() {
    var grid = document.getElementById('card-grid');
    grid.innerHTML = '';
    var boardContainer = document.querySelector('.board-container');
    
    if (!cartas || cartas.length === 0 || tandaActual < 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">Presiona "Cartas" para comenzar la partida</div>';
        if (boardContainer) boardContainer.style.display = 'block';
        return;
    }
    
    var disponibles = cartas.filter(function(c) {
        return c.tanda === tandaActual && !c.seleccionadoPor && !c.descartada;
    });
    
    if (disponibles.length === 0) {
        var cicloYaTerminado = (typeof cicloTerminado === 'function') && cicloTerminado();
        if (cicloYaTerminado) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">Presiona "Cartas" para repartir un nuevo lote</div>';
        } else {
            var loteCompleto = (typeof todosLotesCicloCompletos === 'function') && todosLotesCicloCompletos();
            if (!loteCompleto) {
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">Repartiendo el siguiente lote de cartas...</div>';
            } else {
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">Cartas en juego. Cuando todos usen y descarten sus 4 cartas, presiona "Cartas" para repartir un nuevo lote.</div>';
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
        img.alt = getEtiquetaCarta(carta.numero);
        img.loading = 'lazy';
        cardDiv.appendChild(img);
        var numberSpan = document.createElement('div');
        numberSpan.className = 'card-number';
        numberSpan.textContent = getEtiquetaCarta(carta.numero);
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
    var controles = document.getElementById('ordenControles');
    if (controles) controles.innerHTML = '';
    if (misSelecciones.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'empty-message';
        empty.textContent = 'Aun no has seleccionado cartas';
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
    var faseSeleccionCompleta = (typeof todosLotesCicloCompletos !== 'function') || todosLotesCicloCompletos();
    var ordenConfirmado = ordenConfirmadoMio();
    var hayOrden = ordenConfirmado.length > 0;
    var idsVivas = misCartas.map(function(c) { return c.id; });
    ordenBorrador = ordenBorrador.filter(function(id) { return idsVivas.indexOf(id) !== -1; });
    var ordenMostrado = hayOrden ? ordenConfirmado : ordenBorrador;

    for (var k = 0; k < misCartas.length; k++) {
        var carta = misCartas[k];
        var esActiva = (activeId === carta.id);
        var posicion = ordenMostrado.indexOf(carta.id);
        var wrapper = document.createElement('div');
        wrapper.className = 'my-card-wrapper' + (esActiva ? ' activa' : '');
        var imgContainer = document.createElement('div');
        imgContainer.className = 'my-card-img';
        imgContainer.addEventListener('click', function(c) {
            return function(e) {
                e.stopPropagation();
                abrirZoom(c, false, true);
            };
        }(carta));
        var img = document.createElement('img');
        img.src = carta.imagen;
        img.alt = getEtiquetaCarta(carta.numero);
        imgContainer.appendChild(img);
        var num = document.createElement('div');
        num.className = 'mini-number';
        num.textContent = getEtiquetaCarta(carta.numero);
        imgContainer.appendChild(num);
        if (posicion !== -1) {
            var badge = document.createElement('div');
            badge.className = 'orden-badge';
            badge.textContent = String(posicion + 1);
            imgContainer.appendChild(badge);
        }
        wrapper.appendChild(imgContainer);
        var vidaInfo = document.createElement('div');
        vidaInfo.className = 'mini-vida';
        vidaInfo.textContent = 'Vida ' + getVidaCarta(carta.numero) + ' \u00b7 ' + getPuntosCarta(carta.numero) + ' pts';
        wrapper.appendChild(vidaInfo);

        var btnOrden = document.createElement('button');
        btnOrden.className = 'btn-sm btn-usar';
        if (hayOrden) {
            btnOrden.textContent = esActiva ? 'En uso' : (posicion !== -1 ? 'Turno ' + (posicion + 1) : 'Sin orden');
            btnOrden.disabled = true;
        } else if (!faseSeleccionCompleta) {
            btnOrden.textContent = 'Espera...';
            btnOrden.disabled = true;
        } else {
            btnOrden.textContent = (posicion !== -1) ? 'Quitar' : 'Elegir';
            btnOrden.addEventListener('click', function(cId) {
                return function(e) {
                    e.stopPropagation();
                    alternarOrdenBorrador(cId);
                };
            }(carta.id));
        }
        wrapper.appendChild(btnOrden);
        container.appendChild(wrapper);
    }

    if (controles) {
        if (hayOrden) {
            var nota = document.createElement('div');
            nota.className = 'orden-nota';
            nota.textContent = 'Orden confirmado: al eliminar tu carta en uso, la siguiente entra sola.';
            controles.appendChild(nota);
        } else if (faseSeleccionCompleta) {
            var ayuda = document.createElement('div');
            ayuda.className = 'orden-nota';
            ayuda.textContent = 'Toca tus cartas en el orden en que las jugaras (1 = la primera).';
            controles.appendChild(ayuda);
            var fila = document.createElement('div');
            fila.className = 'orden-botones';
            var btnReiniciar = document.createElement('button');
            btnReiniciar.className = 'modal-btn btn-outline';
            btnReiniciar.textContent = 'Reiniciar';
            btnReiniciar.disabled = ordenBorrador.length === 0;
            btnReiniciar.addEventListener('click', reiniciarOrdenBorrador);
            fila.appendChild(btnReiniciar);
            var btnConfirmar = document.createElement('button');
            btnConfirmar.className = 'modal-btn btn-primary';
            btnConfirmar.textContent = 'Confirmar orden';
            btnConfirmar.disabled = ordenBorrador.length !== misCartas.length;
            btnConfirmar.addEventListener('click', confirmarOrden);
            fila.appendChild(btnConfirmar);
            controles.appendChild(fila);
        }
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