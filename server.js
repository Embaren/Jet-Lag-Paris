const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server);

const {loadJSONSync,loadGeoJSON} = require('./scripts/utils_back.js');
const {Library} = require('./scripts/library_back.js');

const gameConfig = loadJSONSync("./config.json");

const maskFeaturesPromise = loadGeoJSON("./public"+gameConfig.terrain.clipPath);
const linesFeaturesPromise = loadGeoJSON("./public"+gameConfig.terrain.linesPath);
const stationsFeaturesPromise = loadGeoJSON("./public"+gameConfig.terrain.stationsPath);

const IP = process.env.IP || 'localhost';
const PORT = process.env.PORT || 3000;

const gameState = {
    teams:[{
            points:gameConfig.initialPoints,
            players:{},
           },
           {
            points:gameConfig.initialPoints,
            players:{},
           },
           {
            points:gameConfig.initialPoints,
            players:{},
           },
          ],
    addresses:[],
};
const library = new Library(gameConfig);

app.use(express.static(__dirname + "/public/"));

app.get('/', (req,res)=>{
    res.sendFile(__dirname + '/index.html');
});

function runSocket(){
    io.on('connection', (socket) => {
        console.log('a user connected');
        
        socket.emit('init_config', gameConfig, (status, socketTeam)=>{
            if(!status){
                return;
            }
            socket.team = socketTeam;
            console.log('joined '+gameConfig.teams[socketTeam].name+' team');
            socket.emit('init_game', gameState ,(status)=>{});
        });
      
        socket.on('disconnect', () => {
            console.log('user disconnected');
        });
    });
}

library.whenReady.then(()=>{
    gameState.addresses = library.addresses;
    runSocket();
});

server.listen(PORT, IP, ()=>{
    console.log(`listening on ${IP}:${PORT}`);
});