const process = require('node:process');
const readline = require('node:readline');
const {msToTime} = require('./utils_back.js');

function getResetGame(game){
    const help = "resets the game with new random addresses.\n WARNING: will erase all progression!";
    return {
        help: help,
        fn: (arguments)=>{
            game.reset();
            return {status:true, content:"New game started."}
        }
    }
}

function getTime(game){
    const help = "returns the duration of the current game. Optional arguments:\n 'session' to display the duration of the current session,\n 'gamestart' to display game starting time,\n 'sessionstart' to display session starting time,\n 'now' to display current time.\n Usage: time [arg=game]";
    return {
        help: help,
        fn: (arguments)=>{            
            const arg = arguments.length == 0 ? 'game' : arguments[0].toLowerCase();
            const startDate = game.state.time.start;
            
            let output = {status:false, reason: "'"+arguments[0]+"' does not exist. Available arguments : 'game', 'session', 'gamestart' , 'sessionstart', 'now'."};
            switch(arg){
                case 'game':
                    output = {status:true, content: msToTime(Date.now()-game.state.time.sessionStart+game.state.time.previousSessionsDuration)};
                    break;
                case 'session':
                    output = {status:true, content: msToTime(Date.now()-game.state.time.sessionStart)};
                    break;
                case 'now':
                    output = {status:true, content: new Date(Date.now()).toString()};
                    break;
                case 'gamestart':
                    output = {status:true, content: new Date(game.state.time.gameStart).toString()};
                    break;
                case 'sessionstart':
                    output = {status:true, content: new Date(game.state.time.sessionStart).toString()};
                    break;
                default:
                    break;
            }
            return output;
        }
    }
}

function getTeams(game){
	const help = "displays the different teams.";
	return {
		help: help,
		fn: (arguments)=>{
			const teams = [];
			const n_teams = game.config.teams.length;
			for(let i = 0 ; i < n_teams ; i++){
				const teamConfig = game.config.teams[i];
				const teamState = game.state.teams[i]
				teams.push(`${teamConfig.name}\n id: ${i}\n points: ${teamState.points}`);
			}
			return {status: true, content: teams.join('\n\n')};
		}
	}
}

function getGive(game){
	const help = "gives selected team the desired amount of points (positive or negative).\n Usage: give teamId amount";
	return {
		help: help,
		fn: (arguments)=>{
			if(arguments.length<2){
				return {status: false, reason: "invalid command arguments: positional arguments must follow the format 'give teamId amount'."}
			}
			const teamId = parseInt(arguments[0]);
			if(isNaN(teamId)){
				return {status: false, reason: "invalid teamId '"+arguments[0]+"': is not a number."}
			}
			const amount = parseInt(arguments[1]);
			if(isNaN(amount)){
				return {status: false, reason: "invalid amount '"+arguments[1]+"': is not a number."}
			}
			
			const n_teams = game.config.teams.length;
			if(teamId<0 || teamId>=n_teams){
				return {status: false, reason: "invalid teamId '"+arguments[0]+"': must be between 0 and "+(n_teams-1)+"."}
			}
			
			const success = game.give(teamId,amount);
			if(!success){
				return {status: false, reason: `team ${game.config.teams[teamId].name} (${game.state.teams[teamId].points} points) cannot go bellow 0 points.`};
			}
			
			return {status: true, content: `team ${game.config.teams[teamId].name} now has ${game.state.teams[teamId].points} points.`};
		}
	}
}

function getPowers(game){
	const help = "displays powers info. Arguments:\n 'list' [default]: displays all applied powers,\n (id)[int] : displays power of id (id),\n 'active': displays all active powers,\n 'config': displays available powers config,\n 'config (powerId)[str]': displays config of power 'powerId'.\n Usage: powers [arg=list] [powerId]";
	 return {
        help: help,
        fn: (arguments)=>{            
            const arg = arguments.length == 0 ? 'list' : arguments[0].toLowerCase();
            
			function power2str(power){
				return `${power.powerId} - ${power.active ? 'active' : 'inactive'}\n source: ${power.source}${power.target==null ? '' : `\n target: ${power.target}`}\n initDate: ${power.initDate}${power.endDate==null ? '' : `\n endDate: ${power.endDate}`}`;
			}
			
            switch(arg){
                case 'list':
					return {status: true, content: game.powers.toJSON().reduce((reduced,p,id)=>{reduced.push(`${id}: ${power2str(p)}`); return reduced;},[]).join('\n')};
                    break;
                case 'active':
                    return {status: true, content: game.powers.toJSON().reduce((reduced,p,id)=>{if(p.active){reduced.push(`${id}: ${power2str(p)}`)}; return reduced;},[]).join('\n')};
                    break;
                case 'config':
					if(arguments.length<2){
						return {status: true, content: game.powers.utils.config};
					}
					if(arguments[1] in game.powers.utils.config){
						return {status: true, content: game.powers.utils.config[arguments[1]]}
					}
					else{
						return {status: false, reason: `'${arguments[1]}' is not a valid powerId.`}
					}
                    break;
                default:
                    break;
            }
			const id = parseInt(arg);
			if(!isNaN(id)){
				if(id>=0 && id<game.powers.length){
					return {status: true, content: game.powers[id].toJSON()}
				}
				if(id==-1 && game.powers.length>0){
					return {status: true, content: game.powers[game.powers.length-1].toJSON()}
				}
				if(game.powers.length==0){
					return {status: false, reason: 'powers list is empty, no id is available'}
				}
				return {status: false, reason: `invalid id: must be between 0 and ${game.powers.length-1}`}
				
			}
			
            return {status: false, reason: "'"+arguments[0]+"' does not exist. Available arguments : 'list', 'active', 'config' , powerId(str), id(int)."};
        }
    }
	
}

function getAddPower(game){
	const help = "applies a new power, free of charge, from selected player to selected target.\n Usage: addpower powerId [source=admin] [target=null]";
	return {
		help: help,
		fn: (arguments)=>{
			if(arguments.length<1){
				return {status: false, reason: "invalid command arguments: positional arguments must follow the format 'addpower powerId [source=admin] [target=null]'."}
			}
			const powerId = arguments[0];
			
			const source = arguments.length>1 ? arguments[1] : 'admin';
			
			const target = arguments.length>2 ? arguments[2] : null;
			
			const result = game.addPower(powerId, source, target);
			
			if(!result.status){
				switch(result.reason){
					case "invalid_id":{
						return {status: false, reason: `invalid powerId '${powerId}'.`}
					}
					case "invalid_source":{
						return {status: false, reason: `invalid source '${source}': must be 'admin' or a playerId.`}
					}
					case "admin_curse":{
						return {status: false, reason: `admin cannot be the source of a power targetting a curse.`}
					}
					case "target_curse":{
						return {status: false, reason: `invalid target '${target}': must be a powerId of type 'curse'.`}
					}
					case "missing_target":{
						return {status: false, reason: `power '${powerId}' requires a target.`}
					}
					case "invalid_player_target":{
						return {status: false, reason: `target '${target}' is not a valid playerId.`}
					}
					break;
					case "blocked":{
						return {status: false, reason: `power blocked.`}
					}
					break;
					case "exists":{
						return {status: false, reason: `power already applied.`}
					}
					break;
					default:{
						return {status: false, reason: `unknown reason '${result.reason}'.`}
					}
				}
			}
			const power = result.power;
			return {status: true, content: `power '${power.config.name}' added from ${source=='admin' ? source : game.config.players[source].name}`+(source=='admin' ? '' : ` (team ${game.config.teams[game.players.getTeam(source)].name})`)+(power.target==null ? '' : ` towards ${power.target}`)+'.'}
		}
	}
}

function getCompletePower(game){
	const help = "completes a power requiring manual completion.\n Usage: completepower powerId [target=admin]";
	return {
		help: help,
		fn: (arguments)=>{
			if(arguments.length<1){
				return {status: false, reason: "invalid command arguments: positional arguments must follow the format 'completepower powerId [target=admin]'."}
			}
			const powerId = arguments[0];
			
			const target = arguments.length>1 ? arguments[1] : 'admin';
			
			const result = game.completePower(powerId, target);
			
			if(!result.status){
				switch(result.reason){
					case "invalid_id":{
						return {status: false, reason: `invalid powerId '${powerId}'.`}
					}
					case "not_completable":{
						return {status: false, reason: `power '${game.powers.utils.config[powerId].name}' is not manually completable.`}
					}
					case "invalid_target":{
						return {status: false, reason: `invalid source '${source}': must be 'admin' or a playerId.`}
					}
					case "no_active":{
						return {status: false, reason: `cannot complete a non-active power.`}
					}
					break;
					default:{
						return {status: false, reason: `unknown reason '${result.reason}'.`}
					}
				}
			}
			return {status: true, content: `power '${game.powers.utils.config[powerId].name}' was completed for ${target=='admin' ? target : game.config.players[target].name}`+(target=='admin' ? '' : ` (team ${game.config.teams[game.players.getTeam(target)].name})`)+'.'}
		}
	}
}

function exploreDict(dict,keys){
    var content = dict;
    explored = [];
    for(let i = 0 ; i < keys.length ; i++){
        const key = keys[i];
        try {
            const availableKeys = Object.keys(content);
        } catch(e) {
            return {
                status: false,
                reason: "['"+explored.join("']['")+"'] is not a dictionnary."
            } 
        }
        const availableKeys = Object.keys(content);
        if(!availableKeys.includes(key)){
            return {
                status: false,
                reason: "'"+key+"' is not a key in ['"+explored.join("']['")+"']. Available keys : ['"+availableKeys.join("','")+"']."
            } 
        }
        explored.push(key);
        content = content[key];
    }
    return {
        status: true,
        content: content
    }
}

function getExplore(game){
    const help = "outputs the game data structure at a specified path. Available root keys: 'config', 'state', 'library', 'powers'.\n Usage: explore key1 key2 key3...";
    return {
        help: help,
        fn: (arguments)=>{
            if(arguments.length==0){
                return {
                    status:false,
                    reason: help
                }
            }
            let output = {status:false, reason: "'"+arguments[0]+"' does not exist. Available root keys: 'config', 'state', 'library','powers'."};
            switch(arguments[0]){
                case 'config':
                    output = exploreDict(game,arguments);
                    break;
                case 'state':
                    output = exploreDict(game,arguments);
                    break;
                case 'library':
                    output = exploreDict(game,arguments);
                    break;
                case 'powers':
                    output = exploreDict(game,arguments);
                    break;
                default:
                    break;
            }
            return output;
            if(output.status){
                console.log(output.content);
            }
            else{
                console.log('EXPLORE: '+output.reason);
            }
        }
    }
};

// =====================================================================================

class CommandPrompt{
    constructor(game){
        this.game = game;
        
		// Commands list
        this.commands = {
			addpower: getAddPower(this.game),
			completepower: getCompletePower(this.game),
            explore: getExplore(this.game),
			give: getGive(this.game),
			powers: getPowers(this.game),
            resetgame: getResetGame(this.game),
            teams: getTeams(this.game),
            time: getTime(this.game),
        }
        
        this.cli = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        const self = this;
        
        const log = console.log;
        console.log = function() {
            self.cli.pause();
            self.cli.output.write('\x1b[2K\r');
            log.apply(console, Array.prototype.slice.call(arguments));
            self.cli.resume();
            self.cli._refreshLine();
        }
    }
	
	log(str){
		console.log(str)
		this.game.io.of('/admin').emit('log',str);
	}
	
	parse(command){
		const list = command.split(' ').filter((e)=> e!='');
		if(list.length==0){
			return false;
		}
		const commandId = list[0];
		const args = list.slice(1,list.length);
		return {"commandId":commandId,"args":args};
	}
    
    prompt(){
        const self = this;
        this.cli.setPrompt('>>> ', 2);
        this.cli.on('line',(line)=>{
			const parsedCommand = this.parse(line);
			if(!parsedCommand){
				self.cli.prompt();
				return;
			}
            self.apply(parsedCommand.commandId,parsedCommand.args).then((output)=>{
				console.log(output.content);
				self.cli.prompt();
			});
        });
    }
    
    apply(commandId,args){
        const commandsList = Object.keys(this.commands);
        const commandId_low = commandId.toLowerCase();
		const self = this;
		
		return new Promise((resolve,reject)=>{
			if(commandId_low=='help'){
				resolve({"status":true,content:self.help()});
				return;
			}
			if(!commandsList.includes(commandId_low)){
				resolve({"status":false,"content":"'"+commandId_low+"' is not a valid command."});
				return;
			}
			const command = this.commands[commandId_low];
			if(args.length>=1 && args[0]=='-h'){
				resolve({"status":true,"content":commandId.toUpperCase()+': '+command['help']});
				return;
			}
			const output = command.fn(args);
			resolve({"status":output.status,"content":output.status ? output.content : commandId.toUpperCase()+': '+output.reason});
		});
    }
	
	initIo(){
		const self = this;
		this.game.io.of('/admin').on('connection', (socket) => {            
            console.log('an admin connected');
			socket.log = (str)=>{
				socket.emit('log',str);
			};
			socket.on('prompt',(command,callback)=>{
				const parsedCommand = this.parse(command);
				if(!parsedCommand){
					callback(false,"Error while parsing command.");
				}
				self.apply(parsedCommand.commandId,parsedCommand.args).then(callback);
			});
		});
	}
    
    help(){
        const self = this;
        const commandsList = Object.keys(this.commands).sort();
        let output = '';
        commandsList.forEach((commandId)=>{
            const commandHelp = commandId.toUpperCase()+': '+self.commands[commandId].help;
            output = output.concat('\n',commandHelp,'\n');
        });
        return output.substring(1,output.length-1);        
    }
}

module.exports = {CommandPrompt};