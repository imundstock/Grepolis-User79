// ==UserScript==
// @name         Auto Refresh Page (Intervalo Aleatório 5–9 min)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Atualiza a página automaticamente com intervalo aleatório entre 5 e 9 minutos (em segundos)
// @author       Adaptado
// @match        http://*br79.grepolis.com/game/*
// @match        https://*br79.grepolis.com/game/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function getRandomInterval() {
        // Retorna um valor aleatório entre 300000ms (5min) e 540000ms (9min)
        return Math.floor(Math.random() * (540000 - 300000 + 1)) + 300000;
    }

    function scheduleRefresh() {
        const interval = getRandomInterval();
        console.log(`Página será atualizada em ${(interval / 1000)} segundos`);
        setTimeout(() => {
            window.location.reload();
        }, interval);
    }

    // Inicia o agendamento
    scheduleRefresh();
})();
