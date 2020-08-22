const axios = require('axios');
const config = require('config');
const debug = require('debug')('app:server');
const debugError = require('debug')('app:error');
const path = require('path');
const EventEmitter = require('events');

const cron = require('cron');
global.events = new EventEmitter();


const trelloApi = require('./trello');
const MediaLib = require("./libs/media");

const mediaLib = new MediaLib();

const { board: boardId, mediaType, entryType, labelRestriction } = config.settings;

if (!boardId) {
	throw "No board ID provided in environment variables";
}

let jobRunning = false;
const job = new cron.CronJob('*/5 * * * * *', async () => {
	if (jobRunning === true) {
		return;
	}

	jobRunning = true;
	debug("Running media sync job");

	try {
		let cards = await trelloApi.getCards();

		if (labelRestriction) {
			cards = cards.reduce((acc, card) => {
				if (!!card.labels.filter(label => label.name === labelRestriction).length) {
					return [...acc, card];
				}

				return acc;
			}, []);
		}

		let entries = {};
		const lists = {}
		if (entryType === "card") {
			for (let i = 0; i < cards.length; i++) {
				const card = cards[i];

				lists[card.idList] = await trelloApi.getList(card.idList);

				const list = lists[card.idList];

				entries[list.name] = entries[list.name] ? [...entries[list.name], card.name] : [card.name];
			}
		} else if(entryType === "checklist") {
			for (let i = 0; i < cards.length; i++) {
				const { name, idChecklists } = cards[i];

				if (idChecklists.length) {
					entries[name] = {}
				}

				for (let j = 0; j < idChecklists.length; j++) {
					const checklistId = idChecklists[j];

					const checklist = await trelloApi.getChecklist(checklistId);

					entries = {
						...entries,
						[name]: {
							...entries[name],
							[checklist.name]: checklist.checkItems.reduce((acc, item) => {
								if (item.state === "complete") {
									return acc;
								}

								return [...acc, item.name];
							}, [])
						}
					}
				}
			}
		}

		if (mediaType === "films") {
			await mediaLib.syncFilms(entries);
		}
	} catch(e) {
		debugError(e);
	}

	jobRunning = false;
}, null, true, 'Europe/London');

job.start();
debug("Sync started and scheduled");
