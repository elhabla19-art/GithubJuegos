// Punto de entrada principal
(function() {
    'use strict';
    
    let juegos = [];
    let isDropdownOpen = false;
    
    function init() {
        console.log('Inicializando Github Juegos...');
        
        UI.init();
        
        PlayerData.load();
        const playerName = PlayerData.getNombre();
        const roomCode = PlayerData.getCodigoSala();
        UI.setPlayerData(playerName, roomCode);
        UI.updateSyncIndicator(playerName, roomCode);
        
        juegos = Config.getJuegos();
        console.log('Cargados ' + juegos.length + ' juegos');
        
        UI.renderGames(juegos);
        UI.renderFilterTopics(juegos);
        
        setupEvents();
        
        setTimeout(function() {
            UI.toggleDropdown(true);
            isDropdownOpen = true;
        }, 300);
    }
    
    function setupEvents() {
        const elements = UI.elements;
        
        elements.filterHeader.addEventListener('click', function(e) {
            e.stopPropagation();
            isDropdownOpen = !isDropdownOpen;
            UI.toggleDropdown(isDropdownOpen);
        });
        
        elements.saveLobbyBtn.addEventListener('click', handleSaveLobby);
        elements.clearLobbyBtn.addEventListener('click', handleClearLobby);
        
        elements.playerNameInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') handleSaveLobby();
        });
        elements.roomCodeInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') handleSaveLobby();
        });
        
        document.addEventListener('click', function(event) {
            if (isDropdownOpen) {
                const target = event.target;
                const isHeader = elements.filterHeader.contains(target);
                const isDropdown = elements.filterDropdown.contains(target);
                if (!isHeader && !isDropdown) {
                    isDropdownOpen = false;
                    UI.toggleDropdown(false);
                }
            }
        });
        
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                if (isDropdownOpen) {
                    isDropdownOpen = false;
                    UI.toggleDropdown(false);
                }
                if (elements.qrModal.classList.contains('show')) {
                    UI.closeQRModal();
                }
            }
        });
        
        elements.qrButton.addEventListener('click', function() {
            UI.openQRModal();
        });
        
        elements.qrModal.addEventListener('click', function(event) {
            if (event.target === elements.qrModal) {
                UI.closeQRModal();
            }
        });
    }
    
    function handleSaveLobby() {
        const nombre = UI.elements.playerNameInput.value.trim();
        const codigo = UI.elements.roomCodeInput.value.trim();
        
        if (!Validator.isValidName(nombre)) {
            UI.showLobbyStatus('Por favor, ingresa tu nombre', 'error');
            return;
        }
        
        if (!Validator.isValidRoomCode(codigo)) {
            UI.showLobbyStatus('El codigo debe tener al menos 4 letras/numeros', 'error');
            return;
        }
        
        const codigoLimpio = Validator.getCleanRoomCode(codigo);
        if (PlayerData.save(nombre, codigoLimpio)) {
            UI.showLobbyStatus('Datos guardados: ' + nombre + ' | Sala: ' + codigoLimpio, 'success');
            UI.updateSyncIndicator(nombre, codigoLimpio);
            isDropdownOpen = false;
            UI.toggleDropdown(false);
        } else {
            UI.showLobbyStatus('Error al guardar los datos', 'error');
        }
    }
    
    function handleClearLobby() {
        if (PlayerData.clear()) {
            UI.showLobbyStatus('Datos eliminados', 'info');
            UI.setPlayerData('', Config.getDefaultRoomCode());
            UI.updateSyncIndicator('', '');
        } else {
            UI.showLobbyStatus('Error al limpiar', 'error');
        }
    }
    
    window.openGame = function(gameId) {
        const juego = juegos.find(function(j) {
            return j.id === gameId;
        });
        if (!juego) {
            console.error('Juego no encontrado:', gameId);
            alert('Juego no encontrado: ' + gameId);
            return;
        }
        
        let url = juego.ruta;
        const nombre = PlayerData.getNombre() || 'Jugador';
        const codigo = PlayerData.getCodigoSala() || Config.getDefaultRoomCode();
        
        if (gameId === 'CleverDados') {
            const separator = url.includes('?') ? '&' : '?';
            url += separator + 'nombre=' + encodeURIComponent(nombre) + '&sala=' + codigo;
        }
        
        if (gameId === 'QuixxDados') {
            const separator = url.includes('?') ? '&' : '?';
            url += separator + 'nombre=' + encodeURIComponent(nombre) + '&sala=' + codigo;
        }

        if (gameId === 'JuegoCassettes') {
            const separator = url.includes('?') ? '&' : '?';
            url += separator + 'nombre=' + encodeURIComponent(nombre) + '&sala=' + codigo;
        }

        if (gameId === 'ParaDice') {
            const separator = url.includes('?') ? '&' : '?';
            url += separator + 'nombre=' + encodeURIComponent(nombre) + '&sala=' + codigo;
        }

        if (gameId === 'SagradaS') {
            const separator = url.includes('?') ? '&' : '?';
            url += separator + 'nombre=' + encodeURIComponent(nombre) + '&sala=' + codigo;
        }

        if (gameId === 'MasterCartas') {
            const separator = url.includes('?') ? '&' : '?';
            url += separator + 'nombre=' + encodeURIComponent(nombre) + '&sala=' + codigo;
        }

        if (gameId === 'FigurasDados') {
            const separator = url.includes('?') ? '&' : '?';
            url += separator + 'nombre=' + encodeURIComponent(nombre) + '&sala=' + codigo;
        }

        if (gameId === 'MagicalAthlete') {
            const separator = url.includes('?') ? '&' : '?';
            url += separator + 'nombre=' + encodeURIComponent(nombre) + '&sala=' + codigo;
        }

        if (gameId === 'HotCarreras') {
            const separator = url.includes('?') ? '&' : '?';
            url += separator + 'nombre=' + encodeURIComponent(nombre) + '&sala=' + codigo;
        }
        
        if (gameId === 'YatziDados') {
            const separator = url.includes('?') ? '&' : '?';
            url += separator + 'nombre=' + encodeURIComponent(nombre) + '&sala=' + codigo;
        }

        if (gameId === 'EcoTrole') {
            const separator = url.includes('?') ? '&' : '?';
            url += separator + 'nombre=' + encodeURIComponent(nombre) + '&sala=' + codigo;
        }

        if (gameId === 'SugarPow') {
            const separator = url.includes('?') ? '&' : '?';
            url += separator + 'nombre=' + encodeURIComponent(nombre) + '&sala=' + codigo;
        }

        if (gameId === 'HeistDados') {
            const separator = url.includes('?') ? '&' : '?';
            url += separator + 'nombre=' + encodeURIComponent(nombre) + '&sala=' + codigo;
        }
        
        window.open(url, '_blank');
    };

    window.filterGamesByTopic = function(topic) {
        const filtered = FilterSystem.setFilter(topic);
        const juegosFiltrados = FilterSystem.filterGames(juegos, filtered);
        
        UI.renderFilterTopics(juegos);
        
        const container = UI.elements.projectsContainer;
        const currentItems = container.querySelectorAll('.project-item');
        
        Animations.exit(currentItems, function() {
            UI.renderGames(juegosFiltrados);
        });
        
        isDropdownOpen = false;
        UI.toggleDropdown(false);
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();