// ===== INICIALIZACION =====
document.addEventListener('DOMContentLoaded', function () {
    renderBoard();
    renderDice();
    renderScores();
    document.querySelectorAll('.dice-face-btn').forEach(btn => {
        btn.innerHTML = pipsHTML(parseInt(btn.dataset.value, 10));
    });

    const session = loadSession();
    const banner = document.getElementById('sessionBanner');
    if (session && banner) {
        document.getElementById('sessionBannerText').textContent = `Tenias una partida abierta en la sala ${session.roomCode} como "${session.myName}".`;
        banner.style.display = 'block';
    }

    applyPrefillFromURL();

    // Desbloquear audio con el primer toque (requisito de navegadores moviles)
    document.addEventListener('pointerdown', primeAudio, { once: true });

    // Sonido de clic generico para botones de menus/modales (no pisa los sonidos especificos del juego)
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.modal-btn');
        if (btn && !btn.closest('#turnActions')) sfxButton();
    }, true);
});

// ===== EXPORTAR FUNCIONES GLOBALES =====
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.showJoinModal = showJoinModal;
window.backToLobby = backToLobby;
window.playSolo = playSolo;
window.reconnectToSession = reconnectToSession;
window.dismissSession = dismissSession;
window.acceptClaim = acceptClaim;
window.declineClaim = declineClaim;
window.closeTooltip = closeTooltip;
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
window.closeKickPlayerModal = closeKickPlayerModal;
window.confirmKickPlayer = confirmKickPlayer;
