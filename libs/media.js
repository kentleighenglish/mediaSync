const shell = require("shelljs");
const path = require("path");
const fs = require("fs");
const debug = require("debug")("app:medialib");

const TorrentLib = require("./torrent");

const videoExtension = ["mp4", "mov", "wmv", "flv", "webm", "avi", "mkv"];

const flattenEntries = (entries, rootKey) => {
	if (Array.isArray(entries)) {
		return entries.reduce((acc, entry) => ({
			...acc,
			[`${rootKey}/${entry}`]: entry
		}), {});
	}

	if (typeof entries === "object") {
		return Object.keys(entries).reduce((out, key) => ({
			...out,
			...flattenEntries(entries[key], rootKey ? `${rootKey}/${key}` : key)
		}), {})
	}

	return;
}

class MediaLib {

	constructor() {
		this.downloadDirectory = path.resolve("./downloads");
		this.convertDirectory = path.resolve("./library");

		this.torrent = new TorrentLib(this.downloadDirectory);
	}

	filmExists(filmPath) {
		const fileName = filmPath.match(/[^\/]+$/)[0];

		return fs.existsSync(`${this.convertDirectory}${filmPath}/${fileName}.mp4`);
		return true;
	}

	/*
	 * Adds a list of films to a torrent list, and converts+deletes completed torrents
	 * @param {Array} entries
	 * @return void
	 */
	async syncFilms(entries) {
		debug("Syncing films...");
		entries = flattenEntries(entries);

		const entryPaths = Object.keys(entries);
		debug(`Found ${entryPaths.length} films`);

		await Promise.all(entryPaths.map(async path => {
			const entry = entries[path];

			try {
				if (!this.filmExists(path)) {
					await this.torrent.addFilm(entry, path);
				}
			} catch(e) {
				console.error(e);
			}
		}));

		this.torrent.updateActiveTorrents();

		await Promise.all(Object.values(this.torrent.activeTorrents).map(async torrent => {
			if (torrent.state === "Seeding" || torrent.percentDone === "100%") {
				debug(`${torrent.name} COMPLETED`);

				const videoPath = await this.getTorrentVideoFile(torrent.location);

				// Convert and copy completed torrents (find video file by extension probably)
				const savePath = torrent.location.replace(this.downloadDirectory, "");
				const saveFilename = savePath.match(/[^\/]+$/)[0];

				const saveDirectory = `${this.convertDirectory}${savePath}`;

				if (!fs.existsSync(saveDirectory)) fs.mkdirSync(saveDirectory, { recursive: true });

				debug(`Converting ${torrent.name} to mp4`)
				debug(`and saving converted file in ${saveDirectory}`);
				const { stdout, stderr } = shell.exec(`ffmpeg -i "${videoPath}" -f mp4 -vcodec h264 -acodec libmp3lame "${saveDirectory}/${saveFilename}.mp4"`, { silent: true })

				if (stderr) {
					throw stderr;
				}
			}
		}));

	}

	/*
	 * Search for video files in the given directory and return the first one
	 * @param {string} folderPath - The search directory
	 * @return string
	 */
	async getTorrentVideoFile(folderPath) {
		const extensions = videoExtension.map(ext => (`-name *.${ext}`)).join(" -o ");
		const { stdout, stderr } = await shell.exec(`find "${folderPath}" -type f \\( ${extensions} \\)`, { silent: true });

		if (stderr) {
			throw stderr;
		}

		const videoFiles = stdout.split("\n");

		if (videoFiles.length) {
			return videoFiles[0];
		} else {
			throw `Could not find video file in ${folderPath}`;
		}
	}
}

module.exports = MediaLib;
