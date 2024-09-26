const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);

const {loadJSONSync} = require('./scripts/utils_back.js');
const {CommandPrompt} = require('./scripts/commands_back.js');
const {Game} = require('./scripts/game_back.js');

//const IP = process.env.IP || 'localhost';
const PORT = process.env.PORT || 3000;

const gameConfig = loadJSONSync("./config.json");

const game = new Game(gameConfig, server);

// Command interface
const commandPrompt = new CommandPrompt(game);
commandPrompt.prompt();

game.new();

app.use(express.static(__dirname + "/public/"));

app.get('/', (req,res)=>{
    res.sendFile(__dirname + '/index.html');
});

server.listen(PORT, ()=>{
    console.log(`listening on :${PORT}`);
});
server.restart=()=>{
    server.close();
    server.listen(PORT, ()=>{
        console.log(`listening on :${PORT}`);
    });
}