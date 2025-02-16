const express = require('express');
const app = express();
const http = require('http');
var server = http.createServer(app);

const socketio = require('socket.io');

const {loadJSONSync} = require('./scripts/utils_back.js');
const {CommandPrompt} = require('./scripts/commands_back.js');
const {Game} = require('./scripts/game_back.js');

const PORT = process.env.PORT || 3000;

const gameConfig = loadJSONSync("./config.json");

app.use(express.static(__dirname + "/public/"));

app.get('/admin', (req,res)=>{
    res.sendFile(__dirname + '/admin.html');
});

app.get('/', (req,res)=>{
    res.sendFile(__dirname + '/index.html');
});

function startServer(callback=null){
	server = http.createServer(app);
	
	server.start = startServer;
	
	server.listen(PORT, ()=>{
		console.log(`listening on :${PORT}`);
		if(callback){
			callback();
		}
	});
}

function getServer(){
	return server;
}

startServer();

const game = new Game(gameConfig, getServer);
game.new();