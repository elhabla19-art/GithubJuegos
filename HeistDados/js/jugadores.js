// IMPORTS
import { state } from './config.js';
import { mostrarMensaje } from './ui.js';
import { renderLeaderboard } from './leaderboard.js';

// ESTADO MODAL
const modalState = {
    modo: 'principal',
    jugadores: ['', '']
};

// CREAR JUGADORES
export function crearJugadoresDesdeModal() {
    const nombres = modalState.jugadores.map(n => n.trim());
    if (nombres.some(n => n === '')) {
        mostrarMensaje('Todos los jugadores deben tener un nombre', 'warning');
        return false;
    }
    if (nombres.length < 2) {
        mostrarMensaje('Se necesitan al menos 2 jugadores', 'warning');
        return false;
    }

    state.jugadores = nombres.map((nombre, index) => ({
        id: index,
        nombre: nombre,
        puntaje: 0,
        conectado: true
    }));

    state.turnoActual = 0;
    state.totalJugadores = state.jugadores.length;

    document.getElementById('lobbyModal').style.display = 'none';
    document.getElementById('leaderboardPanel').style.display = 'flex';

    renderLeaderboard();
    actualizarIndicadorTurno();

    console.log('HeistDados iniciado con', nombres.length, 'jugadores:', nombres);
    return true;
}

// GETTERS
export function getJugadores() { return state.jugadores || []; }

export function getJugador(index) {
    if (!state.jugadores || index < 0 || index >= state.jugadores.length) return null;
    return state.jugadores[index];
}

export function getJugadorActual() { return getJugador(state.turnoActual); }
export function getTurnoActual() { return state.turnoActual; }

// TURNOS
export function siguienteTurno() {
    if (!state.jugadores || state.jugadores.length === 0) return;

    let next = (state.turnoActual + 1) % state.jugadores.length;
    let intentos = 0;
    while (state.jugadores[next]?.conectado === false && intentos < state.jugadores.length) {
        next = (next + 1) % state.jugadores.length;
        intentos++;
    }

    state.turnoActual = next;
    actualizarIndicadorTurno();
    renderLeaderboard();
}

export function setTurno(index) {
    if (!state.jugadores || index < 0 || index >= state.jugadores.length) return;
    if (state.jugadores[index].conectado === false) return;
    state.turnoActual = index;
    actualizarIndicadorTurno();
    renderLeaderboard();
}

// INDICADOR TURNO
export function actualizarIndicadorTurno() {
    const jugador = getJugadorActual();
    const el = document.getElementById('turnoIndicador');
    if (!el) return;

    if (jugador) {
        el.textContent = `Turno: ${jugador.nombre} · ${jugador.puntaje} pts`;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

// RESET
export function resetearJugadores() {
    if (!state.jugadores) return;
    state.jugadores.forEach(j => {
        j.puntaje = 0;
        j.conectado = true;
    });
    state.turnoActual = 0;
    renderLeaderboard();
    actualizarIndicadorTurno();
}

// MODAL VISTAS
export function toggleVistaJugadores() {
    const vistaPrincipal = document.getElementById('vistaPrincipal');
    const vistaJugadores = document.getElementById('vistaJugadores');

    if (modalState.modo === 'principal') {
        modalState.modo = 'edicion';
        vistaPrincipal.style.display = 'none';
        vistaJugadores.style.display = 'block';
        renderizarListaJugadores();
    } else {
        modalState.modo = 'principal';
        vistaJugadores.style.display = 'none';
        vistaPrincipal.style.display = 'block';
    }
}

// MODAL LISTA
function renderizarListaJugadores() {
    const container = document.getElementById('listaJugadoresContainer');
    if (!container) return;
    container.innerHTML = '';

    const placeholders = ['Leo', 'Ana'];

    modalState.jugadores.forEach((nombre, index) => {
        const div = document.createElement('div');
        div.className = 'input-group jugador-input';
        div.style.cssText = 'margin-bottom:6px;display:flex;align-items:center;gap:8px;';

        const label = document.createElement('label');
        label.textContent = `Jugador ${index + 1}:`;
        label.style.cssText = 'min-width:70px;font-size:0.85rem;';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `nombreJugador_${index}`;
        input.placeholder = placeholders[index % placeholders.length];
        input.maxLength = 15;
        input.value = nombre || '';
        input.style.cssText = 'flex:1;text-align:left;padding-left:12px;';

        input.addEventListener('input', () => {
            modalState.jugadores[index] = input.value;
        });

        div.appendChild(label);
        div.appendChild(input);

        if (modalState.jugadores.length > 2) {
            const btnEliminar = document.createElement('button');
            btnEliminar.textContent = '✕';
            btnEliminar.style.cssText = `
                background: var(--color-secondary);
                color: var(--text-main);
                border: none;
                border-radius: 50%;
                width: 28px;
                height: 28px;
                font-size: 14px;
                cursor: pointer;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            btnEliminar.addEventListener('click', () => eliminarJugador(index));
            div.appendChild(btnEliminar);
        }

        container.appendChild(div);
    });

    const btnAgregar = document.getElementById('btnAgregarJugador');
    if (btnAgregar) {
        btnAgregar.style.display = modalState.jugadores.length >= 6 ? 'none' : 'block';
    }
}

function agregarJugador() {
    if (modalState.jugadores.length >= 6) {
        mostrarMensaje('Máximo 6 jugadores', 'warning');
        return;
    }
    modalState.jugadores.push('');
    renderizarListaJugadores();
}

function eliminarJugador(index) {
    if (modalState.jugadores.length <= 2) {
        mostrarMensaje('Mínimo 2 jugadores', 'warning');
        return;
    }
    modalState.jugadores.splice(index, 1);
    renderizarListaJugadores();
}

// INICIALIZAR MODAL
export function inicializarModal() {
    renderizarListaJugadores();
}

// GLOBALES
window.getJugadores = getJugadores;
window.getJugadorActual = getJugadorActual;
window.getTurnoActual = getTurnoActual;
window.siguienteTurno = siguienteTurno;
window.toggleVistaJugadores = toggleVistaJugadores;
window.agregarJugador = agregarJugador;
window.iniciarPartida = crearJugadoresDesdeModal;