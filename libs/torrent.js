const axios = require("axios");
const path = require("path");
const fs = require("fs");
const shell = require("shelljs");
const { sortBy } = require("lodash");
const debug = require("debug")("app:torrentlib");

const TRACKERS = [
	"udp://open.demonii.com:1337/announce",
	"udp://tracker.openbittorrent.com:80",
	"udp://tracker.coppersurfer.tk:6969",
	"udp://glotorrents.pw:6969/announce",
	"udp://tracker.opentrackr.org:1337/announce",
	"udp://torrent.gresille.org:80/announce",
	"udp://p4p.arenabg.com:1337",
	"udp://tracker.leechers-paradise.org:6969"
];

class TorrentLib {

	constructor(downloadDirectory) {
		this._activeTorrents = {};
		this.downloadDirectory = downloadDirectory;

		this.updateActiveTorrents();
	}

	get activeTorrents() {
		return (this._activeTorrents || []);
	}

	/*
	 * Retrieves a list of active torrents from transmission-remote, and organises them into arrays
	 * @return void
	 */
	updateActiveTorrents() {
		const { stdout = "", stderr } = shell.exec(`transmission-remote -tall -i`, { silent: true });

		if (stderr) {
			throw stderr;
		}

		const torrentsArray = [];
		const torrents = stdout.split(/NAME\n/);

		if (torrents.length) {
			torrents.shift();

			torrents.map(torrent => {
				const lines = torrent.split("\n").filter(line => /:\s/.test(line));

				const torrentObject = lines.reduce((acc, line) => {
					const lineSplit = line.split(/:\s/);
					const key = lineSplit[0].trim().toLowerCase().replace(/\s+(.)/g, (match, str) => str.toUpperCase());
					const value = lineSplit[1].trim();

					return {
						...acc,
						[key]: value
					};
				}, {});

				torrentsArray.push(torrentObject);
			})
		}

		const output = torrentsArray.reduce((acc, torrent) => {
			const key = torrent.location.match(/[^\/]+$/)[0];
			return {
				...acc,
				[key]: torrent
			}
		}, {});

		this._activeTorrents = output;
	}

	/*
	 * Adds a torrent magnet to transmission-daemon with a given download path
	 * @param {string} magnet - The torrent magnetURI
	 * @param {string} torrentPath - The file path of the torrent download
	 * @return boolean
	 */
	async addTorrent(magnet, torrentPath) {
		try {
			const outputPath = path.resolve(this.downloadDirectory, torrentPath);

			const { stderr } = shell.exec(`transmission-remote -n "transmission:transmission" -w "${outputPath}" -a "${magnet}"`, { silent: true });

			if (stderr) {
				throw stderr;
			}

			return true;
		} catch(e) {
			console.error(e);
			return false;
		}
	}

	/*
	 * Generates a magnet URI from a hash and name, also takes additional query params
	 * @param {string} hash - Magnet URI hash
	 * @param {string} name - Name of torrent source
	 * @param {Object} queryOpts - Additional query options
	 * @return string
	 */
	generateMagnetUrl(hash, name, queryOpts = {}) {
		const trackers = TRACKERS.reduce((acc, tracker) => (`${acc}&tr=${tracker}`), "");
		const queryObject = {
			...queryOpts,
			xt: `urn:btih:${hash}`,
			dn: name
		}

		const queryString = Object.keys(queryObject).reduce((acc, key) => (
			acc
			? `${acc}&${key}=${encodeURI(queryObject[key])}`
			: `?${key}=${encodeURI(queryObject[key])}`
		), "");

		return `magnet:${queryString}${trackers}`;
	}

	/*
	 * Searchs YTS API for the given film name, finding the most downloaded copy
	 * and generates a magnet URI from the given response
	 * @param {string} name - Name of the film
	 * @param {string} path - Download path
	 * @return void
	 */
	async addFilm(name, path) {
		if (this._activeTorrents[name]) {
			return;
		}

		const altName = name.replace(/\s\(\d{4}\)$/, "");

		debug(`Searching for torrent ${name}`);
		const url = `https://yts.mx/api/v2/list_movies.json?quality=720p&sort_by=download_count&query_term=${encodeURI(name)}`;
		const altUrl = `https://yts.mx/api/v2/list_movies.json?quality=720p&sort_by=download_count&query_term=${encodeURI(altName)}`;

		const { data: apiResult } = await axios.get(url);

		const init_movie_count = apiResult.data.movie_count;

		debug(`Found ${init_movie_count} results for ${name}`);

		let altApiResult = null;
		if (!init_movie_count) {
			debug(`Retrying with alternate name: ${altName}`);
			const { data } = await axios.get(altUrl);
			altApiResult = data;
		}

		const { data: { movie_count, movies = [] } } = (altApiResult || apiResult);

		if (movie_count) {
			let { torrents = [], title_long } = movies[0];

			if (torrents.length) {
				torrents = sortBy(torrents, "seeds");

				let torrent = torrents.find(t => t.quality === "720p");
				if (!torrent) {
					torrent = torrents.find(t => t.quality === "1080p");
				}

				const { hash, quality } = torrent;

				const magnetUri = this.generateMagnetUrl(hash, title_long);

				debug(`Adding torrent to list ${title_long} - ${quality}`);
				// Add torrent to transmission
				await this.addTorrent(magnetUri, path);

				this.updateActiveTorrents();
				return;
			}
		}

		debug(`Could not find a torrent for ${name}`);
	}
}

module.exports = TorrentLib;
