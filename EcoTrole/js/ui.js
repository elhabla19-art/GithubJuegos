// ui.js - EcoTrole
var miRol = null;
var miHabilidad = null;

var ITEM_EMOJIS = {
    reloj: '⌚',
    celular: '📱',
    billetera: '💳'
};

function renderizarBadgesItems() {
    if (!misItems || misItems.length === 0) return '';
    var emojis = misItems.map(function(item) {
        return ITEM_EMOJIS[item] || '';
    }).join(' ');
    return ' <span class="item-badges" title="Reloj, Celular y Billetera">' + emojis + '</span>';
}

function renderizarMisCartas() {
    var container = document.getElementById('my-cards-container');
    container.innerHTML = '';

    if (!juegoIniciado) {
        var empty = document.createElement('div');
        empty.className = 'empty-message';
        empty.textContent = 'Esperando que el anfitrion reparta los roles...';
        container.appendChild(empty);
        return;
    }

    if (!miRol) {
        var empty = document.createElement('div');
        empty.className = 'empty-message';
        empty.textContent = 'Aun no tienes un rol asignado. Espera...';
        container.appendChild(empty);
        return;
    }

    var habilidadCarta = null;
    for (var i = 0; i < misCartas.length; i++) {
        if (misCartas[i].tipo === 'habilidad') {
            habilidadCarta = misCartas[i];
            break;
        }
    }

    var acciones = misCartas.filter(function(c) { return c.tipo === 'accion'; });

    if (!habilidadCarta && acciones.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'empty-message';
        empty.textContent = 'No tienes cartas. Usa "Accion" para obtener una.';
        container.appendChild(empty);
        return;
    }

    if (habilidadCarta) {
        var wrapper = document.createElement('div');
        wrapper.className = 'my-card-wrapper habilidad';

        var imgContainer = document.createElement('div');
        imgContainer.className = 'my-card-img';
        imgContainer.addEventListener('click', function(c) {
            return function(e) {
                e.stopPropagation();
                abrirZoom(c, false);
            };
        }(habilidadCarta));

        var img = document.createElement('img');
        img.src = habilidadCarta.imagen;
        img.alt = 'Habilidad ' + habilidadCarta.numero;
        imgContainer.appendChild(img);

        var num = document.createElement('div');
        num.className = 'mini-number';
        num.textContent = 'HAB #' + habilidadCarta.numero;
        imgContainer.appendChild(num);

        var tipoBadge = document.createElement('div');
        tipoBadge.className = 'tipo-badge habilidad';
        tipoBadge.textContent = 'HABILIDAD';
        imgContainer.appendChild(tipoBadge);

        wrapper.appendChild(imgContainer);
        container.appendChild(wrapper);
    }

    for (var i = 0; i < acciones.length; i++) {
        var carta = acciones[i];
        var wrapper = document.createElement('div');
        wrapper.className = 'my-card-wrapper accion';

        var imgContainer = document.createElement('div');
        imgContainer.className = 'my-card-img';
        imgContainer.addEventListener('click', function(c) {
            return function(e) {
                e.stopPropagation();
                abrirZoom(c, true);
            };
        }(carta));

        var img = document.createElement('img');
        img.src = carta.imagen;
        img.alt = 'Accion ' + carta.numero;
        imgContainer.appendChild(img);

        var num = document.createElement('div');
        num.className = 'mini-number';
        num.textContent = 'ACC #' + carta.numero;
        imgContainer.appendChild(num);

        var tipoBadge = document.createElement('div');
        tipoBadge.className = 'tipo-badge accion';
        tipoBadge.textContent = 'ACCION';
        imgContainer.appendChild(tipoBadge);

        wrapper.appendChild(imgContainer);
        container.appendChild(wrapper);
    }
}

function actualizarUI() {
    var startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        var esAnfitrion = hostId === myId;
        startBtn.style.display = esAnfitrion ? '' : 'none';
        var puedeRepartir = !rolesAsignados && esAnfitrion;
        startBtn.disabled = !puedeRepartir;
        if (!juegoIniciado) {
            startBtn.textContent = 'Pasajeros';
        } else if (rolesAsignados) {
            startBtn.textContent = 'Roles Asignados';
            startBtn.style.opacity = '0.7';
        }
    }

    var accionBtn = document.getElementById('accionBtn');
    if (accionBtn) {
        var misAcciones = typeof contarMisCartasAccion === 'function' ? contarMisCartasAccion() : 0;
        accionBtn.disabled = !juegoIniciado || !miRol || misAcciones >= MAX_CARTAS_ACCION || mazoAccionesRestantes.length === 0;
    }

    var resetBtn = document.getElementById('resetGameBtn');
    if (resetBtn) {
        var esAnfitrion = hostId === myId;
        resetBtn.style.display = esAnfitrion ? '' : 'none';
    }

    var decisionBtn = document.getElementById('decisionBtn');
    if (decisionBtn) {
        var esAnfitrionDecision = hostId === myId;
        decisionBtn.style.display = esAnfitrionDecision ? '' : 'none';
        decisionBtn.disabled = !rolesAsignados;
    }

    var rolDisplay = document.getElementById('miRolDisplay');
    if (rolDisplay) {
        if (!miRol) {
            rolDisplay.innerHTML = 'Rol: ?';
            rolDisplay.className = 'sin-rol';
        } else if (miRol === 'pasajero') {
            rolDisplay.innerHTML = 'Rol: Pasajero' + renderizarBadgesItems();
            rolDisplay.className = 'rol-pasajero';
        } else if (miRol === 'ladron') {
            rolDisplay.innerHTML = 'Rol: Ladron' + renderizarBadgesItems();
            rolDisplay.className = 'rol-ladron';
        } else if (miRol === 'estorbo') {
            rolDisplay.innerHTML = 'Rol: Estorbo' + renderizarBadgesItems();
            rolDisplay.className = 'rol-estorbo';
        }
    }

    var restantesDisplay = document.getElementById('mazoRestanteDisplay');
    if (restantesDisplay) {
        restantesDisplay.textContent = 'Acciones restantes: ' + (mazoAccionesRestantes ? mazoAccionesRestantes.length : 0);
    }

    renderLeaderboard();
    renderizarMisCartas();
    if (typeof renderizarDecisionModal === 'function') renderizarDecisionModal();
    if (typeof actualizarBannerVictoria === 'function') actualizarBannerVictoria();
}

function showLoading(text) {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingModal').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingModal').style.display = 'none';
}

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

window.renderizarMisCartas = renderizarMisCartas;
window.actualizarUI = actualizarUI;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showNotice = showNotice;
window.closeNotice = closeNotice;