// ==UserScript==
// @name         Auto Desbloquear Aldeias da Ilha Atual (Sem Botão)
// @namespace    grepolis-helper
// @version      1.0
// @description  Desbloqueia automaticamente todas as aldeias da ilha da cidade atual assim que o jogo carregar. Sem botão, sem interação manual.
// @author       Hannzo
// @match        http://*br79.grepolis.com/game/*
// @match        https://*br79.grepolis.com/game/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const uw = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    function unlock(polisID, farmTownPlayerID, ruralID) {
        let data = {
            model_url: 'FarmTownPlayerRelation/' + farmTownPlayerID,
            action_name: 'unlock',
            arguments: { farm_town_id: ruralID },
            town_id: polisID
        };
        uw.gpAjax.ajaxPost('frontend_bridge', 'execute', data, () => {
            console.log(`✅ Desbloqueada aldeia ${ruralID} (cidade ${polisID})`);
        });
    }

    function desbloquearAldeiasDaIlhaAtual() {
        let polisID = uw.Game.townId;
        let islandX = uw.ITowns.towns[polisID].getIslandCoordinateX();
        let islandY = uw.ITowns.towns[polisID].getIslandCoordinateY();

        let aldeias = uw.MM.getCollections().FarmTown[0].models;
        let relacoes = uw.MM.getCollections().FarmTownPlayerRelation[0].models;

        for (let i = 0; i < aldeias.length; i++) {
            let aldeia = aldeias[i];
            if (aldeia.attributes.island_x === islandX && aldeia.attributes.island_y === islandY) {
                let ruralID = aldeia.id;

                for (let j = 0; j < relacoes.length; j++) {
                    let rel = relacoes[j];
                    if (ruralID === rel.getFarmTownId()) {
                        let farmTownPlayerID = rel.id;

                        if (rel.attributes.relation_status === 0) {
                            unlock(polisID, farmTownPlayerID, ruralID);
                        }
                    }
                }
            }
        }
    }

    const waitUntilReady = setInterval(() => {
        if (
            uw.Game?.townId &&
            uw.ITowns?.towns &&
            uw.MM?.getCollections()?.FarmTown?.[0]?.models?.length &&
            uw.MM?.getCollections()?.FarmTownPlayerRelation?.[0]?.models?.length
        ) {
            clearInterval(waitUntilReady);
            console.log("🚀 Desbloqueando aldeias da ilha da cidade atual...");
            desbloquearAldeiasDaIlhaAtual();
        }
    }, 1000);
})();
