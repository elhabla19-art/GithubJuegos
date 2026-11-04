// IMPORTS
import { initState } from './config.js';
import { renderPanelDados, configurarEventos, actualizarUI } from './ui.js';
import { renderLeaderboard, toggleLeaderboard } from './leaderboard.js';
import { inicializarModal } from './jugadores.js';

// INIT
function init() {
    initState();
    renderPanelDados();
    configurarEventos();
    inicializarModal();
    actualizarUI();
    renderLeaderboard();

    window.toggleLeaderboard = toggleLeaderboard;

    console.log('HeistDados - Iniciado');
}

// START
document.addEventListener('DOMContentLoaded', init);