// ==UserScript==
// @name         Constructor Gold
// @namespace    https://grepolis.com
// @version      1.0
// @description  Grepolis Builder
// @match        https://*br79.grepolis.com/game/*
// ==/UserScript==

const isCuratorEnabled = Game.premium_features.curator > Date.now() / 1000;
const blackList = [];

var buildingTownGroupName;

    function getTowns(){
        return new Promise((resolve) => {
            var loop = setInterval(() => {
                if(typeof ITowns.town_groups.models[ITowns.town_groups.models.length - 1] != "undefined"){
                    buildingTownGroupName = ITowns.town_groups.models[ITowns.town_groups.models.length - 1].attributes.name;
                    clearInterval(loop);
                    resolve(buildingTownGroupName);
                }
            })
        })
    }

buildingTownGroupName = await getTowns();

var buildingTownGroupId = 0;

const maxTimeBetweenRuns = 10 * 60 * 10;
const minTimeBetweenRuns = 10 * 60 * 5;
const timeBetweenRunsDifference = maxTimeBetweenRuns - minTimeBetweenRuns;

const maxTimeBetweenBuildings = 5;
const minTimeBetweenBuildings = 1;
const timeBetweenBuildingsDifference = maxTimeBetweenBuildings - minTimeBetweenBuildings;

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

const compareResources = (resources, resources2) => {
	return (
		(resources.wood + resources.iron + resources.stone) >=
		(resources2.wood + resources2.iron + resources2.stone)
	);
};

const hasEnoughtResources = (town, resourcesNeeded) => {
	const resources = ITowns.towns[town].resources();
	if (resources.wood < resourcesNeeded.wood) return false;
	if (resources.iron < resourcesNeeded.iron) return false;
	if (resources.stone < resourcesNeeded.stone) return false;
	return true;
};

const isBlackListed = (name, level, town) => {
	return !!blackList.find(element => (
		element.name === name &&
		element.level === level &&
		element.town === town
	));
};

const townShouldBuild = (name, level, town, buildingData) => {
	return (
		!isBlackListed(name, buildingData.next_level, town) &&
		!buildingData.has_max_level &&
		hasEnoughtResources(town, buildingData.resources_for) &&
		buildingData.next_level <= level
	);
};

const findBuildingOrder = (targets, buildingData, townID) => {
	return Object.entries(targets).reduce((order, [name, level]) => {
		const data = buildingData[name];
		return (
			townShouldBuild(name, level, townID, data) &&
			(
				!order ||
				compareResources(buildingData[order.name].resources_for, data.resources_for)
			)
		) ? {
		    name: name,
		    level: data.next_level,
		    town: townID
		} : order;
	}, null);
};

const findBuildingsTargets = buildingData => {
	return instructions.find(targets => {
		return !!Object.entries(targets).find(([name, level]) => {
			return !buildingData[name].has_max_level && buildingData[name].next_level <= level;
		});
	});
};

const getOrders = () => {
	const models = Object.values(MM.getModels().BuildingBuildData || {});
	return models.reduce((orders, {attributes}) => {
		const townID = attributes.id;
		const buildingData = attributes.building_data;

		if (
			attributes.is_building_order_queue_full ||
			(isCuratorEnabled && !ITowns.town_group_towns.hasTown(buildingTownGroupId, townID))
		) return orders;

		const buildingsTargets = findBuildingsTargets(buildingData);
		console.log(`Name: ${ITowns.towns[townID].name}`, buildingsTargets);
		if (!buildingsTargets) return orders;

		const order = findBuildingOrder(buildingsTargets, buildingData, townID);
		if (order) orders.push(order);
		return orders;
	}, []);
};

const buildOrder = async order => {
	return new Promise((resolve, reject) => {
		gpAjax.ajaxPost('frontend_bridge', 'execute', {
			model_url: 'BuildingOrder',
			action_name: 'buildUp',
			arguments: {building_id: order.name},
			town_id: order.town
		}, false, {
			success: resolve,
			error: reject
		});
	});
};

const updateTownGroup = buildingTownGroupName => {
	const buildingTownGroup = ITowns.town_groups.models.find(model => model.getName() === buildingTownGroupName);
	if (buildingTownGroup) buildingTownGroupId = buildingTownGroup.id;
};

const freeze = time => new Promise(resolve => setTimeout(resolve, time));

const build = async () => {
	const orders = getOrders();
	console.log(orders);
	if (orders.length === 0) return;
	for (const order of orders) {
		try {
			await buildOrder(order);
			console.log(`Building ${order.name} level ${order.level} in ${ITowns.towns[order.town].name}`);
		} catch(error) {
			console.log(order);
			blackList.push(order);
		}
		const delay = Math.floor(Math.random() * timeBetweenBuildingsDifference) + minTimeBetweenBuildings;
		await freeze(delay);
	}
	await build();
};

const run = async () => {
	const delay = Math.floor(Math.random() * timeBetweenRunsDifference) + minTimeBetweenRuns;
	await build();
	await freeze(delay);
	await run();
};

jQuery.Observer(GameEvents.game.load).subscribe(async () => {
	await freeze(2000);
	if (buildingTownGroupName && isCuratorEnabled) updateTownGroup(buildingTownGroupName);
	run();
});// ==UserScript==
// @name         New Userscript
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://pt82.grepolis.com/game/index?login=1&p=2225917&ts=1637179234#
// @icon         https://www.google.com/s2/favicons?domain=grepolis.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Your code here...
})();
