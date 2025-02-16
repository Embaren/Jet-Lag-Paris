const {checkSector} = require('./utils_back.js');

class Players{
	constructor(config){
		this.state = {}
		this.sockets = {}
		Object.keys(config.players).forEach((playerId)=>{
			this.state[playerId] = {
				loc : null,
			}
			this.sockets[playerId] = null;
		});
		this.config = config.players;
		
		this.gameConfig = config;
	}
	get(key){
		return(this.state[key]);
	}
	getConfig(key){
		return(this.config[key]);
	}
	getTeam(key){
		return(this.config[key].team);
	}
	getSocket(key){
		return(this.sockets[key]);
	}
	check(key){
		return(key in this.config)
	}
	setSocket(key, socket){
		if(this.getSocket(key)){
			this.getSocket(key).disconnect(true);
		}
		this.sockets[key] = socket;
	}
	getVisiblePlayers(observerKey, powers=null){
		const visiblePlayers={};
		const observerTeam = this.getTeam(observerKey);
		const obfuscatedPlayers = [];
		if(powers){
			
		}
		Object.keys(this.config).forEach((targetKey)=>{
			
			// Discard if self
			if(observerKey==targetKey){
				return;
			}
			
			const teamId = this.getTeam(observerKey);
			const target = this.get(targetKey);
			const targetData = {
				'loc': target.loc,
			}
			
			// Provide if same team
			const otherTeamId = this.getTeam(targetKey);
			if(otherTeamId==teamId){
				visiblePlayers[targetKey] = targetData;
				return;
			}
			
			// Provide if location null
			if(!target.loc){
				visiblePlayers[targetKey] = targetData;
				return;
			}
			
			const sector = checkSector([target.loc.x,target.loc.y], this.gameConfig);
			// Provide if on own territory
			if(sector==teamId){
				visiblePlayers[targetKey] = targetData;
			}
			// Else obfuscate location
			else{
				targetData.loc = null;
				visiblePlayers[targetKey] = targetData;
			}
		});
		return visiblePlayers;
	}
	
	checkSector(key){
		const player = this.get(key);
		return checkSector([player.loc.x,socket.player.loc.y], this.gameConfig);
	}
}

module.exports = {Players};