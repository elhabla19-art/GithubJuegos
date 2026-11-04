// IMPORTS
import { CONFIG, state } from './config.js';
import { getJugadorActual, siguienteTurno, actualizarIndicadorTurno } from './jugadores.js';
import { renderLeaderboard } from './leaderboard.js';
import { aplicarBoton, reiniciarPartida as reiniciarJuego } from './juego.js';

// RENDER PANEL
export function renderPanelDados() {
    const panel = document.getElementById('panelDados');
    if (!panel) return;
    panel.innerHTML = '';

    CONFIG.BOTONES.forEach(btn => {
        const el = document.createElement('button');
        el.className = `dado-btn dado-tipo-${btn.tipo}`;
        el.dataset.numero = btn.numero;
        el.title = `Dado ${btn.numero}: ${btn.descripcion}`;
        el.innerHTML = `
            <span class="dado-numero">${btn.numero}</span>
            <span class="dado-desc">${btn.descripcion}</span>
        `;
        el.addEventListener('click', () => manejarClickBoton(btn));
        panel.appendChild(el);
    });
}

// CLICK BOTON
function manejarClickBoton(btn) {
    const resultado = aplicarBoton(btn);
    if (!resultado.ok) {
        mostrarMensaje(resultado.mensaje, resultado.tipo);
        return;
    }

    mostrarMensaje(resultado.mensaje, resultado.tipo);
    renderLeaderboard();
    actualizarUI();
}

// ACTUALIZAR UI
export function actualizarUI() {
    actualizarIndicadorTurno();
}

// MENSAJES
export function mostrarMensaje(texto, tipo = 'info') {
    const colores = {
        success: '#504E1D',
        error: '#910F13',
        warning: '#CA7A02',
        info: '#1D424C'
    };

    const msg = document.createElement('div');
    msg.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${colores[tipo] || colores.info};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 9999;
        font-weight: bold;
        font-size: 0.95rem;
        animation: slideDown 0.5s ease;
        max-width: 90%;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        pointer-events: none;
    `;
    msg.textContent = texto;
    document.body.appendChild(msg);

    setTimeout(() => {
        if (msg.parentNode) msg.remove();
    }, 2800);
}

// EVENTOS
export function configurarEventos() {
    // Los eventos PASAR y Reiniciar vienen por onclick del HTML
}

// PASAR TURNO
export function pasarTurno() {
    if (!state.jugadores || state.jugadores.length === 0) return;

    siguienteTurno();

    const nuevo = getJugadorActual();
    if (nuevo) {
        mostrarMensaje(`Turno de ${nuevo.nombre}`, 'info');
    }
    actualizarUI();
}

// REINICIAR UI
function reiniciarPartidaUI() {
    const r = reiniciarJuego();
    mostrarMensaje(r.mensaje, r.tipo);
    renderLeaderboard();
    actualizarUI();
}

// GLOBALES
window.pasarTurno = pasarTurno;
window.reiniciarPartida = reiniciarPartidaUI;