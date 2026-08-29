// ui.js - EcoTrole
var miRol = null;
var miHabilidad = null;

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
    
    var objetos = misCartas.filter(function(c) { return c.tipo === 'objeto'; });
    
    if (!habilidadCarta && objetos.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'empty-message';
        empty.textContent = 'No tienes cartas. Usa "Objetos" para obtener una.';
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
                abrirZoom(c, false, true);
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
    
    for (var i = 0; i < objetos.length; i++) {
        var carta = objetos[i];
        var wrapper = document.createElement('div');
        wrapper.className = 'my-card-wrapper objeto';
        
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
        img.alt = 'Objeto ' + carta.numero;
        imgContainer.appendChild(img);
        
        var num = document.createElement('div');
        num.className = 'mini-number';
        num.textContent = 'OBJ #' + carta.numero;
        imgContainer.appendChild(num);
        
        var tipoBadge = document.createElement('div');
        tipoBadge.className = 'tipo-badge objeto';
        tipoBadge.textContent = 'OBJETO';
        imgContainer.appendChild(tipoBadge);
        
        wrapper.appendChild(imgContainer);
        container.appendChild(wrapper);
    }
}

function actualizarUI() {
    var startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        var esAnfitrion = hostId === myId;
        var puedeRepartir = !rolesAsignados && esAnfitrion;
        startBtn.disabled = !puedeRepartir;
        if (!juegoIniciado) {
            startBtn.textContent = 'Pasajeros';
        } else if (rolesAsignados) {
            startBtn.textContent = 'Roles Asignados';
            startBtn.style.opacity = '0.7';
        }
    }
    
    var objetosBtn = document.getElementById('objetosBtn');
    if (objetosBtn) {
        objetosBtn.disabled = !juegoIniciado || !miRol || mazoObjetosRestantes.length === 0;
    }
    
    var resetBtn = document.getElementById('resetGameBtn');
    if (resetBtn) {
        var esAnfitrion = hostId === myId;
        resetBtn.style.display = esAnfitrion ? '' : 'none';
    }
    
    var rolDisplay = document.getElementById('miRolDisplay');
    if (rolDisplay) {
        if (!miRol) {
            rolDisplay.textContent = 'Rol: ?';
            rolDisplay.className = 'sin-rol';
        } else if (miRol === 'pasajero') {
            rolDisplay.textContent = 'Rol: Pasajero';
            rolDisplay.className = 'rol-pasajero';
        } else if (miRol === 'ladron') {
            rolDisplay.textContent = 'Rol: Ladron';
            rolDisplay.className = 'rol-ladron';
        }
    }
    
    var restantesDisplay = document.getElementById('mazoRestanteDisplay');
    if (restantesDisplay) {
        restantesDisplay.textContent = 'Objetos restantes: ' + (mazoObjetosRestantes ? mazoObjetosRestantes.length : 0);
    }
    
    renderLeaderboard();
    renderizarMisCartas();
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