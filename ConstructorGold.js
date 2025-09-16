// ==UserScript==
// @name         Constructor Gold (fixed)
// @namespace    https://grepolis.com
// @version      1.1
// @description  Grepolis Builder com inicialização tardia e tempos corrigidos
// @match        https://*br79.grepolis.com/game/*
// ==/UserScript==

(() => {
  'use strict';

  // ------------------ Configurações & Estado ------------------
  const blackList = [];
  let buildingTownGroupName = null;
  let buildingTownGroupId = 0;
  let started = false;

  // 5–10 minutos entre ciclos de construção
  const MIN_RUN_DELAY_MS = 5 * 60 * 1000;
  const MAX_RUN_DELAY_MS = 10 * 60 * 1000;

  // 1–5 segundos entre ordens dentro do mesmo ciclo
  const MIN_BUILD_DELAY_MS = 1 * 1000;
  const MAX_BUILD_DELAY_MS = 5 * 1000;

  // Plano de upgrades (altere à vontade)
  const instructions = [
    {
      farm: 3,
      lumber: 2,
      stoner: 1,
      ironer: 1,
      storage: 2,
      main: 2,
      temple: 1,
    },
    {
      storage: 5,
      main: 3,
      temple: 1,
      market: 3,
    },
  ];

  // ------------------ Utils ------------------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  async function waitFor(predicate, { timeout = 60000, interval = 200 } = {}) {
    const t0 = Date.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try { if (predicate()) return; } catch {}
      if (Date.now() - t0 > timeout) throw new Error('waitFor timeout');
      await sleep(interval);
    }
  }

  const isCuratorEnabled = () =>
    Boolean(window.Game?.premium_features?.curator > Date.now() / 1000);

  async function waitForGameAPIs() {
    await waitFor(() =>
      window.MM &&
      window.ITowns &&
      window.gpAjax &&
      window.jQuery &&
      window.Game
    );
  }

  async function getLatestTownGroupName() {
    await waitFor(() =>
      Array.isArray(ITowns?.town_groups?.models) &&
      ITowns.town_groups.models.length > 0
    , { timeout: 30000 });
    const groups = ITowns.town_groups.models;
    const last = groups[groups.length - 1];
    return last?.getName ? last.getName() : last?.attributes?.name || null;
  }

  function updateTownGroup(name) {
    const model = ITowns?.town_groups?.models?.find(m =>
      (m.getName ? m.getName() : m.attributes?.name) === name
    );
    if (model) buildingTownGroupId = model.id;
  }

  // ------------------ Lógica de seleção / recursos ------------------
  const compareResources = (r1, r2) =>
    (r1.wood + r1.iron + r1.stone) >= (r2.wood + r2.iron + r2.stone);

  const hasEnoughResources = (townId, need) => {
    const res = ITowns.towns[townId].resources();
    return res.wood >= need.wood && res.iron >= need.iron && res.stone >= need.stone;
  };

  const isBlackListed = (name, level, town) =>
    !!blackList.find(e => e.name === name && e.level === level && e.town === town);

  const townShouldBuild = (name, level, townId, data) =>
    !isBlackListed(name, data.next_level, townId) &&
    !data.has_max_level &&
    hasEnoughResources(townId, data.resources_for) &&
    data.next_level <= level;

  function findBuildingOrder(targets, buildingData, townId) {
    return Object.entries(targets).reduce((order, [name, level]) => {
      const data = buildingData[name];
      if (
        townShouldBuild(name, level, townId, data) &&
        (!order || compareResources(buildingData[order.name].resources_for, data.resources_for))
      ) {
        return { name, level: data.next_level, town: townId };
      }
      return order;
    }, null);
  }

  function findBuildingsTargets(buildingData) {
    return instructions.find(targets =>
      Object.entries(targets).some(([name, level]) =>
        !buildingData[name].has_max_level && buildingData[name].next_level <= level
      )
    );
  }

  function getOrders() {
    const bbd = MM.getModels().BuildingBuildData || {};
    const models = Object.values(bbd);
    if (!models.length) return [];

    return models.reduce((orders, { attributes }) => {
      const townID = attributes.id;
      const buildingData = attributes.building_data;

      if (attributes.is_building_order_queue_full) return orders;

      // Se Curador ativo, só cidades do grupo selecionado
      if (
        isCuratorEnabled() &&
        buildingTownGroupId &&
        ITowns?.town_group_towns?.hasTown &&
        !ITowns.town_group_towns.hasTown(buildingTownGroupId, townID)
      ) {
        return orders;
      }

      const targets = findBuildingsTargets(buildingData);
      if (!targets) return orders;

      const order = findBuildingOrder(targets, buildingData, townID);
      if (order) orders.push(order);
      return orders;
    }, []);
  }

  function buildOrder(order) {
    return new Promise((resolve, reject) => {
      gpAjax.ajaxPost(
        'frontend_bridge',
        'execute',
        {
          model_url: 'BuildingOrder',
          action_name: 'buildUp',
          arguments: { building_id: order.name },
          town_id: order.town,
        },
        false,
        { success: resolve, error: reject }
      );
    });
  }

  // ------------------ Loops de construção ------------------
  async function buildLoopOnce() {
    const orders = getOrders();
    if (!orders.length) return false;

    for (const order of orders) {
      try {
        await buildOrder(order);
        console.log(`[ConstructorGold] Construindo ${order.name} lvl ${order.level} em ${ITowns.towns[order.town].name}`);
      } catch (error) {
        console.warn('[ConstructorGold] Falhou ordem, vai pra blacklist:', order, error);
        blackList.push(order);
      }
      await sleep(randInt(MIN_BUILD_DELAY_MS, MAX_BUILD_DELAY_MS));
    }
    return true;
  }

  async function runLoop() {
    console.log('[ConstructorGold] Loop iniciado.');
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const builtSomething = await buildLoopOnce();
      const delay = randInt(MIN_RUN_DELAY_MS, MAX_RUN_DELAY_MS);
      if (!builtSomething) {
        // nada pra fazer agora; espera e tenta de novo depois
        console.log(`[ConstructorGold] Sem ordens. Aguardando ${Math.round(delay / 1000)}s…`);
      } else {
        console.log(`[ConstructorGold] Ciclo ok. Próxima checagem em ${Math.round(delay / 1000)}s…`);
      }
      await sleep(delay);
    }
  }

  // ------------------ Bootstrap (funciona mesmo se carregado tarde) ------------------
  async function startOnce() {
    if (started) return;
    started = true;

    try {
      await waitForGameAPIs();

      // captura / atualiza grupo (último da lista)
      try {
        buildingTownGroupName = await getLatestTownGroupName();
        if (buildingTownGroupName && isCuratorEnabled()) {
          updateTownGroup(buildingTownGroupName);
        }
      } catch (e) {
        console.warn('[ConstructorGold] Não conseguiu detectar o grupo de cidades ainda.', e);
      }

      // pequeno atraso extra pra garantir ITowns/MM prontos
      await sleep(1000);

      runLoop();
    } catch (e) {
      started = false;
      console.error('[ConstructorGold] Erro no start:', e);
    }
  }

  // Se o jogo emitir o evento de load, assina — mas também inicializa já
  try {
    if (window.jQuery?.Observer && window.GameEvents?.game?.load) {
      jQuery.Observer(GameEvents.game.load).subscribe(() => startOnce());
    }
  } catch (e) {
    console.warn('[ConstructorGold] Falha ao assinar GameEvents:', e);
  }

  // Inicializa mesmo se foi carregado depois do evento
  startOnce();

  // ------------------ Debug helpers ------------------
  window.ConstructorGold = {
    start: startOnce,
    getOrders,
    updateTownGroup,
    setGroupName: (name) => { buildingTownGroupName = name; updateTownGroup(name); },
    get buildingTownGroupName() { return buildingTownGroupName; },
    get buildingTownGroupId() { return buildingTownGroupId; },
    isCuratorEnabled,
  };
})();
