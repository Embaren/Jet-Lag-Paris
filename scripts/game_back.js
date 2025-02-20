const {Library} = require('./library_back.js');
const {checkSector} = require('./utils_back.js');
const {Powers} = require('./powers_back');
const {Players} = require('./players_back');
const {CommandPrompt} = require('./commands_back.js');

class Game{
    constructor(gameConfig, name, io){
        this.config = gameConfig;
		this.name = name;
		this.gameIo = io.of('/game/'+name);
		
		this.commandPrompt = new CommandPrompt(this,io.of('/admin/'+name));
		this.log('created')
		
		this.new();
    }
	
	log(str){
		this.commandPrompt.log(str);
	}
    
    new(){
		this.players = new Players(this.config);
		
		this.powers = new Powers(this.config);
		
		
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
            },
        };
        this.library = new Library(this.config);
        
        const self = this;
        this.library.whenReady.then(()=>{
            self.state.addresses = self.library.addresses;
			self.log("initialised");
            self.run();
        });
    }
    
	processSocket(socket){
		const game = this;
		
		game.log('a player connected');
		
		socket.emit('listening');
		
		socket.on('request_config', (callback)=>{
			callback(game.config);
		});
		
		socket.on('identify_client', (playerId,loc,callback)=>{
			socket.playerId = playerId;
			
			socket.player = game.players.get(playerId);
			socket.player.loc = loc;
			socket.playerConfig = game.players.getConfig(playerId);
			
			const teamId = game.players.getTeam(playerId);
			socket.teamId = teamId;
			socket.teamConfig = game.config.teams[teamId];
			socket.teamState = game.state.teams[teamId];
			
			game.players.setSocket(playerId, socket);
			socket.join(["t:"+teamId,"p:"+playerId]);
			
			game.log('joined '+socket.playerConfig.name+' from '+socket.teamConfig.name+' team');
			this.shareSocketLocation(socket);
			
			const visiblePlayers = game.players.getVisiblePlayers(playerId,this.powers);
			
			const visiblePowers = game.powers.getVisiblePowers(playerId);
			
			callback(game.state,visiblePlayers,visiblePowers);
		});
	  
		socket.on('disconnect', () => {
			if(socket.playerId){
				game.log('left '+socket.playerConfig.name+' from '+socket.teamConfig.name+' team');
			}
			game.log('player disconnected');
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
		
		socket.on('challenge', (addressId, callback)=>{
			const addressProps = game.state.addresses[addressId].properties;
			if(socket.teamId == addressProps.team){
				return callback(false);
			}
			if(addressProps.current_owner != addressProps.team){
				return callback(false);
			}
			if(addressProps.challengers.includes(socket.teamId)){
				return callback(false);
			}
			
			addressProps.challengers.push(socket.teamId);
			addressProps.challengers_colors.push(socket.teamConfig.color);
			socket.broadcast.emit('challenge',addressId,socket.teamId);
			callback(true);
		});
		
		socket.on('unchallenge', (addressId, callback)=>{
			const addressProps = game.state.addresses[addressId].properties;
			if(socket.teamId == addressProps.team){
				return callback(false);
			}
			if(addressProps.current_owner != addressProps.team){
				return callback(false);
			}
			if(!addressProps.challengers.includes(socket.teamId)){
				return callback(false);
			}
			const challengerIndex = addressProps.challengers.indexOf(socket.teamId);
			addressProps.challengers.splice(challengerIndex,1);
			addressProps.challengers_colors.splice(challengerIndex,1);
			socket.broadcast.emit('unchallenge',addressId,socket.teamId);
			callback(true);
		});
		
		socket.on('capture', (addressId, callback)=>{
			const addressProps = game.state.addresses[addressId].properties;
			if(socket.teamId == addressProps.team){
				return callback(false);
			}
			if(addressProps.current_owner != addressProps.team){
				return callback(false);
			}
			const success = this.give(socket.teamId,game.config.pointsPerCapture);
			if(!success){
				return callback(false);
			}
			addressProps.current_owner = socket.teamId;
			addressProps.owner_color = socket.teamConfig.color;
			addressProps.challengers.length = 0;
			addressProps.challengers_colors.length = 0;
			socket.broadcast.emit('capture',addressId,socket.teamId);
			callback(true);
		});
		
		socket.on('buy_power', (powerId, target, callback)=>{
			return callback(game.buyPower(powerId, socket.playerId, target));
		});
		
		socket.on('complete_power', (powerId, callback)=>{
			return callback(game.completePower(powerId, socket.playerId));
		});
	}
	
    run(){		
		this.commandPrompt.initIo();
        const game = this;
		this.gameIo.sockets.forEach(
		(socket)=>{game.processSocket(socket);});
        this.gameIo.on('connection', (socket)=>{game.processSocket(socket);});
		this.log("running");
    }
    
    shareSocketLocation(socket){
        // Share to players in the same team
        socket.broadcast.to("t:"+socket.teamId).emit('update_player_location',socket.playerId,socket.player.loc);

        // Check sector
        const sector = checkSector([socket.player.loc.x,socket.player.loc.y], this.config);
        
        // Discard if not in ennemy area
        if(sector == -1 || sector == socket.teamId){
            return;
        }
        
        // Share if in ennemy area
        this.gameIo.to("t:"+sector).emit('update_player_location',socket.playerId,socket.player.loc);
    }
	
	give(teamId,points){
		if(this.state.teams[teamId].points+points<0){
			return false;
		}
		this.state.teams[teamId].points += points;
		this.gameIo.to('t:'+teamId).emit('give',points);
		this.log('team '+this.config.teams[teamId].name+' : got '+points+' points.');
		return true;
	}
	
	addPower(powerId,source,target=null){
		if(!(this.powers.utils.check(powerId))){
			return {status:false, reason:"invalid_id"}
		}
		
		if(!(source=='admin' || this.players.check(source))){
			return {status: false, reason: 'invalid_source'}
		}
		
		const targetType = this.powers.utils.getTargetType(powerId);
		if(targetType!='none' && target==null){
			return {status:false, reason:"missing_target"}
		}
		
		switch(targetType){
			case "player":{
				if(!this.players.check(target)){
					return {status:false, reason:"invalid_player_target"}
				}
			}
			break;
			case "curse":{
				if(source=="admin"){
					return {status:false, reason:"admin_curse"}
				}
				if(!(this.powers.utils.check(target) && this.powers.utils.getType(target)=='curse')){
					return {status:false, reason:"target_curse"}
				}
			}
			break;
			case "station":{
				// Add station check
			}
			break;
			case "platform":{
				// Add platform check
			}
			break;
			case "line":{
				// Add line check
			}
			break;
		}
		
		const result = this.powers.pushPower(powerId,source,targetType=='none' ? null : target);
		
		if(result.status){
			this.gameIo.emit('power',result.power);
		}
		
		return result;
	}
	
	buyPower(powerId,source,target=null){
		const cost = this.powers.utils.getCost(powerId);
		
		const teamId = this.players.getTeam(source);
		
		if(cost>this.state.teams[teamId].points){
			return {"status":false,"reason":"cost"};
		}
		
		const result = this.addPower(powerId, source, target);
		if(result.status){
			this.give(teamId, -cost);
		}
		
		return result;
	}
	
	completePower(powerId,target){
		if(!(this.powers.utils.check(powerId))){
			return {status:false, reason:"invalid_id"};
		}
		
		if(!(target=='admin' || this.players.check(target))){
			return {status: false, reason: 'invalid_target'};
		}
		
		const result = this.powers.complete(powerId, target);
		if(result.status){
			this.gameIo.emit('complete_power',powerId,target);
		}
		
		return result;
	}
    
    reset(){
		this.log("Resetting game...");
		this.gameIo.local.disconnectSockets();
		this.new();        
    }
}

module.exports = {Game};