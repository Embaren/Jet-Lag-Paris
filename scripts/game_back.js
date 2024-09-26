const {Library} = require('./library_back.js');
const socketio = require('socket.io');
const {checkSector} = require('./utils_back.js');

class Game{
    constructor(gameConfig, server){
        this.config = gameConfig;
        this.server = server;
    }
    
    new(){
        this.io = null;
        this.players = {};
        Object.keys(this.config.players).forEach((playerId)=>{
            this.players[playerId] = {
                loc : null,
            }
        });
        this.state = {
            teams:[{
                points:this.config.initialPoints,
               },
               {
                points:this.config.initialPoints,
               },
               {
                points:this.config.initialPoints,
               },
              ],
            addresses:[],
            time:{
                gameStart: Date.now(),
                previousSessionsDuration: 0,
                sessionStart: Date.now(),
            }
        };
        this.library = new Library(this.config);
        
        const self = this;
        this.library.whenReady.then(()=>{
            self.state.addresses = self.library.addresses;
            self.run();
        });
    }
    
    run(){
        console.log("Game running");
        this.io = socketio(this.server);
        const game = this;
        this.io.on('connection', (socket) => {            
            console.log('a user connected');
            
            socket.on('request_config', (callback)=>{
                callback(game.config);
            });
            
            socket.on('identify_client', (playerId,loc,callback)=>{
                socket.playerId = playerId;
                
                socket.player = game.players[playerId];
                socket.player.loc = loc;
                socket.playerConfig = game.config.players[playerId];
                
                const teamId = game.config.players[playerId].team
                socket.teamId = teamId;
                socket.join(teamId);
                socket.teamConfig = game.config.teams[teamId];
                socket.teamState = game.state.teams[teamId];
                
                console.log('joined '+socket.playerConfig.name+' from '+socket.teamConfig.name+' team');
                this.shareSocketLocation(socket);
                
                const visiblePlayers={};
                Object.keys(this.config.players).forEach((otherPlayerId)=>{
                    // Discard if self
                    if(playerId==otherPlayerId){
                        return;
                    }
                    
                    // Provide if same team
                    const otherTeamId = game.config.players[otherPlayerId].team;
                    if(otherTeamId==teamId){
                        visiblePlayers[otherPlayerId] = game.players[otherPlayerId];
                        return;
                    }
                    
                    // Provide if location null
                    if(!game.players[otherPlayerId].loc){
                        visiblePlayers[otherPlayerId] = game.players[otherPlayerId];
                        return;
                    }
                    
                    const sector = checkSector([game.players[otherPlayerId].loc.x,game.players[otherPlayerId].loc.y], game.config);
                    // Provide if on own territory
                    if(sector==teamId){
                        visiblePlayers[otherPlayerId] = game.players[otherPlayerId];
                    }
                    // Else obfuscate location
                    else{
                        const playerState = {...game.players[otherPlayerId]};
                        playerState.loc = null;
                        visiblePlayers[otherPlayerId] = playerState;
                    }
                });
                
                callback(game.state,visiblePlayers);
            });
          
            socket.on('disconnect', () => {
                console.log('user disconnected');
            });
            
            socket.on('share_location', (loc, callback)=>{
                if(!socket.playerId){
                    callback({status: false, reason:'LOGGEDOUT'});
                }
                else{
                    socket.player.loc = loc;
                    this.shareSocketLocation(socket);
                    callback({status: true});
                }
            });
        });
    }
    
    shareSocketLocation(socket){
        // Share to players in the same team
        socket.broadcast.to(socket.teamId).emit('update_player_location',socket.playerId,socket.player.loc);

        // Check sector
        const sector = checkSector([socket.player.loc.x,socket.player.loc.y], this.config);
        
        // Discard if not in ennemy area
        if(sector == -1 || sector == socket.teamId){
            return;
        }
        
        // Share if in ennemy area
        this.io.to(sector).emit('update_player_location',socket.playerId,socket.player.loc);
    }
    
    reset(){
        this.io.close();
        this.server.restart();
        this.new();
    }
}

module.exports = {Game};