// Sistema de configuracion y datos del jugador
const Config = {
    DEFAULT_ROOM_CODE: 'GRIL',
    STORAGE_KEY: 'githubjuegos_lobby_data',
    
    getJuegos() {
        return [
            {
                id: 'CleverDados',
                nombre: 'Clever',
                ruta: './CleverDados/index.html',
                color: '#D44D5C',
                topics: ['mqtt', 'dados']
            },
            {
                id: 'QuixxDados',
                nombre: 'Quixx',
                ruta: './QuixxDados/index.html',
                color: '#808BC3',
                topics: ['mqtt', 'dados']
            },
            {
                id: 'JuegoCassettes',
                nombre: 'Cassettes',
                ruta: './JuegoCassettes/index.html',
                color: '#f5deb2',
                topics: ['mqtt', 'cartas']
            },
            {
                id: 'ParaDice',
                nombre: 'Paradice',
                ruta: './ParaDice/index.html',
                color: '#f5deb2',
                topics: ['mqtt', 'dados', 'cartas']
            },
            {
                id: 'SagradaS',
                nombre: 'Sagrada',
                ruta: './SagradaS/index.html',
                color: '#f5deb2',
                topics: ['mqtt', 'dados']
            },
            {
                id: 'MasterCartas',
                nombre: 'Master',
                ruta: './MasterCartas/index.html',
                color: '#4CAF50',
                topics: ['local', 'cartas']
            },
            {
                id: 'FigurasDados',
                nombre: 'Figuras',
                ruta: './FigurasDados/index.html',
                color: '#FF9800',
                topics: ['local', 'dados']
            },
            {
                id: 'MagicalAthlete',
                nombre: 'Magical',
                ruta: './MagicalAthlete/index.html',
                color: '#FF9800',
                topics: ['mqtt', 'dados', 'cartas']
            },
            {
                id: 'HotCarreras',
                nombre: 'Carreras',
                ruta: './HotCarreras/index.html',
                color: '#f5deb2',
                topics: ['local', 'cartas']
            },
            {
                id: 'YatziDados',
                nombre: 'Yahtzee',
                ruta: './YatziDados/index.html',
                color: '#f5deb2',
                topics: ['mqtt', 'dados']
            },
            {
                id: 'EcoTrole',
                nombre: 'EcoTrole',
                ruta: './EcoTrole/index.html',
                color: '#f5deb2',
                topics: ['mqtt', 'dados', 'cartas']
            },
            {
                id: 'SugarPow',
                nombre: 'SugarPow',
                ruta: './SugarPow/index.html',
                color: '#f5deb2',
                topics: ['mqtt', 'dados', 'cartas']
            },
            {
                id: 'HeistDados',
                nombre: 'HeistDados',
                ruta: './HeistDados/index.html',
                color: '#f5deb2',
                topics: ['local', 'dados']
            }
        ];
    },
    
    getDefaultRoomCode() {
        return this.DEFAULT_ROOM_CODE;
    }
};

// Datos del jugador
const PlayerData = {
    data: {
        nombre: '',
        codigoSala: ''
    },
    
    load() {
        try {
            const saved = localStorage.getItem(Config.STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.data.nombre = parsed.nombre || '';
                this.data.codigoSala = parsed.codigoSala || Config.getDefaultRoomCode();
                return true;
            }
        } catch (e) {
            console.warn('Error cargando datos:', e);
        }
        this.data.codigoSala = Config.getDefaultRoomCode();
        return false;
    },
    
    save(nombre, codigoSala) {
        this.data.nombre = nombre.trim();
        this.data.codigoSala = codigoSala.trim().toUpperCase();
        try {
            localStorage.setItem(Config.STORAGE_KEY, JSON.stringify(this.data));
            return true;
        } catch (e) {
            console.error('Error guardando datos:', e);
            return false;
        }
    },
    
    clear() {
        this.data.nombre = '';
        this.data.codigoSala = Config.getDefaultRoomCode();
        try {
            localStorage.removeItem(Config.STORAGE_KEY);
            return true;
        } catch (e) {
            console.error('Error limpiando datos:', e);
            return false;
        }
    },
    
    getNombre() { return this.data.nombre; },
    getCodigoSala() { return this.data.codigoSala; },
    hasData() { return this.data.nombre.length > 0 && this.data.codigoSala.length === 4; }
};

// Validacion
const Validator = {
    isValidName(name) {
        return name && name.trim().length > 0;
    },
    
    isValidRoomCode(code) {
        const clean = code.trim().toUpperCase();
        return clean.length === 4 && /^[A-Z0-9]+$/.test(clean);
    },
    
    getCleanRoomCode(code) {
        return code.trim().toUpperCase();
    }
};