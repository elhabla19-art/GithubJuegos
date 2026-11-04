// CONFIG
export const CONFIG = {
    JUGADORES: {
        MIN: 2,
        MAX: 6,
        NOMBRES_POR_DEFECTO: ['Jugador 1', 'Jugador 2', 'Jugador 3', 'Jugador 4', 'Jugador 5', 'Jugador 6']
    },
    BOTONES: [
        { numero: 1,  tipo: 'sumar',        valor: 10,  descripcion: '+10 pts' },
        { numero: 2,  tipo: 'sumar',        valor: 20,  descripcion: '+20 pts' },
        { numero: 3,  tipo: 'sumar',        valor: 30,  descripcion: '+30 pts' },
        { numero: 4,  tipo: 'restar',       valor: 20,  descripcion: '-20 pts' },
        { numero: 5,  tipo: 'sumar',        valor: 50,  descripcion: '+50 pts' },
        { numero: 6,  tipo: 'nada',         valor: 0,   descripcion: '0 pts' },
        { numero: 7,  tipo: 'multiplicar',  valor: 2,   descripcion: 'x2' },
        { numero: 8,  tipo: 'otro_lanza',   valor: 0,   descripcion: 'Otro lanza' },
        { numero: 9,  tipo: 'restar_otros', valor: 10,  descripcion: '-10 a otros' },
        { numero: 10, tipo: 'sumar',        valor: 100, descripcion: '+100 pts' },
        { numero: 11, tipo: 'dividir',      valor: 2,   descripcion: '÷2' },
        { numero: 12, tipo: 'perder_todo',  valor: 0,   descripcion: 'Pierdes todo' }
    ]
};

// STATE
export const state = {
    jugadores: [],
    turnoActual: 0,
    totalJugadores: 0
};

export function initState() {
    state.jugadores = [];
    state.turnoActual = 0;
    state.totalJugadores = 0;
}