// ===== INICIALIZACION =====
document.addEventListener('DOMContentLoaded', function () {
    renderDice();
    renderScores();
    document.querySelectorAll('.dice-face-btn').forEach(btn => {
        btn.innerHTML = pipsHTML(parseInt(btn.dataset.value, 10));
    });

    mostrarDatosURL();

    const session = loadSession();
    const banner = document.getElementById('sessionBanner');
    const reconnectBtn = document.getElementById('reconnectBtn');

    if (session && banner) {
        document.getElementById('sessionBannerText').textContent =
            'Tenías una partida abierta en la sala ' + session.roomCode + ' como "' + session.myName + '".';
        banner.style.display = 'block';
        if (reconnectBtn) {
            reconnectBtn.disabled = false;
            reconnectBtn.style.opacity = '1';
            reconnectBtn.style.cursor = 'pointer';
        }
    } else {
        if (reconnectBtn) {
            reconnectBtn.disabled = true;
            reconnectBtn.style.opacity = '0.5';
            reconnectBtn.style.cursor = 'not-allowed';
        }
    }

    document.addEventListener('pointerdown', primeAudio, { once: true });

    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.modal-btn');
        if (btn && !btn.closest('#turnActions')) sfxButton();
    }, true);

    // Ocultar el panel de pre-juego si existe (por si acaso)
    const preGame = document.getElementById('preGamePanel');
    if (preGame) preGame.style.display = 'none';
    // Asegurar que el área de juego se muestra al unirse (joinSuccess se encarga)
});

// ===== MOSTRAR DATOS DESDE URL =====
function mostrarDatosURL() {
    const nombre = localStorage.getItem('farkle_nombre_prefill');
    const sala = localStorage.getItem('farkle_sala_prefill');

    if (nombre || sala) {
        const display = document.getElementById('urlDataDisplay');
        if (display) {
            display.style.display = 'block';
            document.getElementById('urlPlayerName').textContent = nombre || '---';
            document.getElementById('urlRoomCode').textContent = sala || '---';
            console.log('Datos configurados:', { nombre, sala });
        }
    }
}

// ===== EXPORTAR FUNCIONES GLOBALES =====
window.entrarSala = entrarSala;
window.reconnectToSession = reconnectToSession;
window.dismissSession = dismissSession;
window.acceptClaim = acceptClaim;
window.declineClaim = declineClaim;
window.closeTooltip = closeTooltip;
window.keepDice = keepDice;
window.bankPoints = bankPoints;
window.undoTurnStep = undoTurnStep;
window.setDiceValue = setDiceValue;
window.closeDiceModal = closeDiceModal;
window.closeGameOverModal = closeGameOverModal;
window.closeViewPlayer = closeViewPlayer;
window.startGame = startGame;
window.endTurn = endTurn;
window.requestGameReset = requestGameReset;
window.closeResetGameModal = closeResetGameModal;
window.confirmGameReset = confirmGameReset;
window.closeNotice = closeNotice;
window.claimHost = claimHost;
window.closeEndTurnReminder = closeEndTurnReminder;
window.endTurnFromReminder = endTurnFromReminder;
window.closeRemovePlayerModal = closeRemovePlayerModal;
window.confirmRemovePlayer = confirmRemovePlayer;