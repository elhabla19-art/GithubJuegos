// ===== LEADERBOARD =====
function renderLeaderboard() {
    const list = document.getElementById('playersList');
    if (!list) return;
    list.innerHTML = '';
    const arr = Object.keys(playersData).map(id => ({ id, ...playersData[id] })).sort((a, b) => (b.score || 0) - (a.score || 0));
    const canKick = isRoomCreator && !gameStarted && !!currentRoom;
    arr.forEach(p => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.style.borderLeftColor = colorHexOf(p.color);
        const isTurn = gameStarted && turnOrder[currentTurnIndex] === p.id;
        card.innerHTML = `
            <span class="pc-name">
                <span style="width:10px;height:10px;border-radius:50%;background:${colorHexOf(p.color)};display:inline-block;"></span>
                ${p.name}${p.id === myId ? ' (Tu)' : ''}${isTurn ? '<span class="pc-turn-tag">TURNO</span>' : ''}
            </span>
            <span class="pc-score">${p.score || 0}</span>`;
        if (canKick && p.id !== myId) {
            const kickBtn = document.createElement('button');
            kickBtn.type = 'button';
            kickBtn.className = 'pc-kick-btn';
            kickBtn.title = 'Quitar jugador de la sala';
            kickBtn.textContent = '✕';
            kickBtn.addEventListener('click', (e) => { e.stopPropagation(); requestKickPlayer(p.id); });
            card.appendChild(kickBtn);
        }
        card.addEventListener('click', () => openViewPlayer(p.id));
        list.appendChild(card);
    });
    checkGameFinished();
}
