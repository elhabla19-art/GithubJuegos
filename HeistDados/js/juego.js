// IMPORTS
import { state } from './config.js';
import {
    getJugadorActual,
    getJugadores,
    getTurnoActual,
    siguienteTurno,
    resetearJugadores
} from './jugadores.js';

// APLICAR BOTON
export function aplicarBoton(btn) {
    const jugador = getJugadorActual();
    if (!jugador) {
        return { ok: false, mensaje: 'No hay jugador en turno', tipo: 'warning' };
    }

    let mensaje = '';
    let tipo = 'info';
    const nombre = jugador.nombre;

    switch (btn.tipo) {

        case 'sumar':
            jugador.puntaje += btn.valor;
            mensaje = `${nombre} sacó ${btn.numero}: +${btn.valor} puntos (total: ${jugador.puntaje})`;
            tipo = 'success';
            break;

        case 'restar':
            jugador.puntaje -= btn.valor;
            mensaje = `${nombre} sacó ${btn.numero}: -${btn.valor} puntos (total: ${jugador.puntaje})`;
            tipo = 'error';
            break;

        case 'nada':
            mensaje = `${nombre} sacó ${btn.numero}: sin cambios (total: ${jugador.puntaje})`;
            tipo = 'info';
            break;

        case 'multiplicar':
            jugador.puntaje *= btn.valor;
            mensaje = `${nombre} sacó ${btn.numero}: x${btn.valor} → ${jugador.puntaje} pts`;
            tipo = 'success';
            break;

        case 'dividir':
            jugador.puntaje = Math.floor(jugador.puntaje / btn.valor);
            mensaje = `${nombre} sacó ${btn.numero}: ÷${btn.valor} → ${jugador.puntaje} pts`;
            tipo = 'warning';
            break;

        case 'otro_lanza':
            mensaje = `${nombre} sacó ${btn.numero}: ¡Otro jugador debe lanzar su dado!`;
            tipo = 'info';
            break;

        case 'restar_otros': {
            const turnoActual = getTurnoActual();
            getJugadores().forEach((j, i) => {
                if (i !== turnoActual) j.puntaje -= btn.valor;
            });
            mensaje = `¡${nombre} sacó ${btn.numero}! El resto de jugadores pierden ${btn.valor} puntos`;
            tipo = 'error';
            break;
        }

        case 'perder_todo':
            jugador.puntaje = 0;
            mensaje = `${nombre} sacó ${btn.numero}: ¡Pierde todos sus puntos! Turno del siguiente.`;
            tipo = 'error';
            siguienteTurno();
            break;
    }

    return { ok: true, mensaje, tipo };
}

// REINICIAR
export function reiniciarPartida() {
    resetearJugadores();
    return { ok: true, mensaje: 'Partida reiniciada', tipo: 'info' };
}