// IMPORTS
import { getJugadores, getTurnoActual } from './jugadores.js';

// RENDER
export function renderLeaderboard() {
    const list = document.getElementById('playersList');
    if (!list) return;
    list.innerHTML = '';

    const jugadores = getJugadores();
    const turnoActual = getTurnoActual();

    if (!jugadores || jugadores.length === 0) {
        list.innerHTML = '<div style="color:#666;text-align:center;padding:10px;font-size:0.8rem;">Esperando jugadores...</div>';
        return;
    }

    jugadores.forEach((j, index) => {
        const div = document.createElement('div');
        const esTurno = index === turnoActual;
        div.className = 'player-card' + (esTurno ? ' turno-actual' : '');
        div.dataset.playerId = index;

        const turnoIndicator = esTurno
            ? '<span style="background:#CA7A02;color:#181810;font-size:0.55rem;padding:2px 8px;border-radius:10px;font-weight:bold;">▲ TURNO</span>'
            : '';

        const puntajeColor = j.puntaje > 0
            ? 'var(--color-primary)'
            : (j.puntaje < 0 ? 'var(--color-secondary)' : 'var(--text-muted)');

        div.innerHTML = `
            <div class="player-card-header">
                <span>${j.nombre} ${turnoIndicator}</span>
                <span style="font-size:0.55rem;color:#666;">#${index + 1}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:2px;">
                <span style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Puntaje</span>
                <span style="font-size:1.4rem;font-weight:800;color:${puntajeColor};line-height:1;">${j.puntaje}</span>
            </div>
        `;
        list.appendChild(div);
    });
}

// TOGGLE
export function toggleLeaderboard() {
    const content = document.getElementById('leaderboardContent');
    const icon = document.getElementById('toggleIcon');
    if (!content || !icon) return;

    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '▲';
    } else {
        content.style.display = 'none';
        icon.textContent = '▼';
    }
}