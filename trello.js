/* global events */
const axios = require('axios');
const debug = require('debug')('app:trello');
const { api: config, settings } = require('config');

const trelloHost = 'https://api.trello.com/1';

const { key, token } = config;
const { board: boardId, labelRestriction } = settings;

const getCards = async () => {
	const result = await axios.get(`${trelloHost}/boards/${boardId}/cards/?key=${key}&token=${token}`);

	return result.status === 200 ? result.data : [];
}

const getList = async (id) => {
	const result = await axios.get(`${trelloHost}/lists/${id}?key=${key}&token=${token}`);

	return result.status === 200 ? result.data : [];
}

const getChecklist = async (id) => {
	const result = await axios.get(`${trelloHost}/checklists/${id}?key=${key}&token=${token}`);

	return result.status === 200 ? result.data : [];
}

module.exports = {
  getCards,
  getList,
  getChecklist
};
