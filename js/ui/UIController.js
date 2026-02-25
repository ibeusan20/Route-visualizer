import { clamp } from '../utils/geo.js';

export class UIController {
    constructor() {
        this.elements = {
            algorithm: document.getElementById('algorithm'),
            profile: document.getElementById('profile'),
            speed: document.getElementById('speed'),
            speedValue: document.getElementById('speedValue'),
            btnLoadRoads: document.getElementById('btnLoadRoads'),
            btnClearPoints: document.getElementById('btnClearPoints'),
            btnResetColors: document.getElementById('btnResetColors'),
            btnStart: document.getElementById('btnStart'),
            btnPause: document.getElementById('btnPause'),
            status: document.getElementById('status'),
            stats: document.getElementById('stats')
        };

        this.initSpeedLabel();
    }

    initSpeedLabel() {
        this.elements.speedValue.textContent = this.elements.speed.value;
        this.elements.speed.addEventListener('input', () => {
            this.elements.speedValue.textContent = this.elements.speed.value;
        });
    }

    bindHandlers(handlers) {
        this.elements.btnLoadRoads.addEventListener('click', handlers.onLoadRoads);
        this.elements.btnClearPoints.addEventListener('click', handlers.onClearPoints);
        this.elements.btnResetColors.addEventListener('click', handlers.onResetColors);
        this.elements.btnStart.addEventListener('click', handlers.onStart);
        this.elements.btnPause.addEventListener('click', handlers.onPause);
    }

    getSelectedAlgorithm() {
        // keys: astar, dijkstra, bidijkstra, wastar, greedy, bfs
        return this.elements.algorithm.value;
    }

    getSelectedProfile() {
        return this.elements.profile.value; // car | walk
    }

    getAnimationSpeedMs() {
        return clamp(parseInt(this.elements.speed.value, 10) || 8, 1, 100);
    }

    setLoadButtonDisabled(disabled) {
        this.elements.btnLoadRoads.disabled = Boolean(disabled);
    }

    setPauseButtonLabel(text) {
        this.elements.btnPause.textContent = text;
    }

    setStatus(message) {
        this.elements.status.textContent = `Status: ${message}`;
    }

    setStats(text) {
        this.elements.stats.textContent = text || '';
    }
}