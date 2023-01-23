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

			const { stderr } = shell.exec(`transmission-remote -s -n "transmission:transmission" -w "${outputPath}" -a "${magnet}"`, { silent: true });

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
			const filteredMovies = movies.filter(m => this._getSimilarity(name, m.title_long) > 0.8);

			let { torrents = [], title_long } = filteredMovies[0];

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

	/*
	 * Removes a torrent from the active torrent list, by id
	 * @param {number} id
	 * @return boolean
	 */
	async removeTorrent(id) {
		if (id) {
			const { stderr } = shell.exec(`transmission-remote -t${id} -rad`);

			if (stderr) {
				throw stderr;
			}

			return true;
		} else {
			throw "Cannot remove torrent - missing torrent ID";
		}
	}

	_getSimilarity(str1, str2) {
		function editDistance(s1, s2) {
			s1 = s1.toLowerCase();
			s2 = s2.toLowerCase();

			var costs = new Array();
			for (var i = 0; i <= s1.length; i++) {
				var lastValue = i;
				for (var j = 0; j <= s2.length; j++) {
					if (i == 0)
					costs[j] = j;
					else {
						if (j > 0) {
							var newValue = costs[j - 1];
							if (s1.charAt(i - 1) != s2.charAt(j - 1))
							newValue = Math.min(Math.min(newValue, lastValue),
							costs[j]) + 1;
							costs[j - 1] = lastValue;
							lastValue = newValue;
						}
					}
				}
				if (i > 0)
				costs[s2.length] = lastValue;
			}
			return costs[s2.length];
		}

		var longer = str1;
		var shorter = str2;
		if (str1.length < str2.length) {
			longer = str2;
			shorter = str1;
		}
		var longerLength = longer.length;
		if (longerLength == 0) {
			return 1.0;
		}
		return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
	}
}

module.exports = TorrentLib;
