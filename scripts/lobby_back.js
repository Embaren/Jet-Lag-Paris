const {CommandPrompt} = require('./commands_back.js');
const {loadJSONSync} = require('./utils_back.js');
const {Game} = require('./game_back.js');

class Lobby{
    constructor(io){
		const gameConfig = loadJSONSync("./config.json");
		this.games = {};
		this.io = io;
		this.io.of(/^\/game\/[a-zA-Z0-9_]+$/g).on('connection',(client)=>{
			const gameIo = client.nsp;
			const gameName = gameIo.name.substring(6);
			if(!this.games[gameName]){
				this.games[gameName] = new Game(gameConfig,gameName,io);
			}
		});
    }
	
}

module.exports = {Lobby};