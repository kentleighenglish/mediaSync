/* global events */
require("isomorphic-fetch");
const debug = require("debug")("app:trello");
const { api: config, settings } = require("config");

const trelloHost = "https://api.trello.com/1";

const { key, token } = config;
const { board: boardId, labelRestriction } = settings;

const getCards = async () => {
	const result = await request(`/boards/${boardId}/cards`);

	return result.status === 200 ? result.data : [];
}

const getList = async (id) => {
	const result = await request(`/lists/${id}`);

	return result.status === 200 ? result.data : [];
}

const getChecklist = async (id) => {
	const result = await request(`/checklists/${id}`);

	const lastItem = result.data.checkItems[5];
	await updateChecklistItem(lastItem);

	return result.status === 200 ? result.data : [];
}

const updateChecklistItem = async (checkItem, data = {}) => {
	const checklistId = checkItem.idChecklist;
	const itemId = checkItem.id;
	const pos = checkItem.pos;
	const name = (checkItem.name || "").replace(/\|\|.+$/, "");

	let newName = name + " || ";
	switch(data.status) {
		case "downloading":
			newName += `Downloading (${data.progress}%)`;
		break;
		case "converting":
			newName += `Converting (${data.progress}%)`;
		case "complete":
			newName += "Complete";
		break;
		case "error":
			newName += data.error;
		default:
			return;
	}


	await request(`/checklists/${checklistId}/checkItems/${itemId}`, {}, "DELETE");
	await request(`/checklists/${checklistId}/checkItems`, {
		name: newName,
		pos,
	}, "POST");
}

const request = async (path, params = {}, method = "GET") => {
	const querystring = convertObjectToQuery({
		...params,
		key,
		token,
	});

	const response = await fetch(`${trelloHost}${path}${querystring}`, {
		method,
	});
	const status = response.status;
	const data = await response.json();

	return { status, data };
}

const convertObjectToQuery = input => Object.keys(input).reduce((out, key) => {
	const val = input[key];
	if (!val) {
		return out;
	}

	return out === "" ? `?${key}=${val}` : `${out}&${key}=${val}`;
}, "");

module.exports = {
  getCards,
  getList,
  getChecklist
};
