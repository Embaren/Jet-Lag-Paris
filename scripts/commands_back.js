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
    const help = "returns the duration of the current game. Optional arguments:\n 'session' to display the duration of the current session,\n 'gamestart' to display game starting time,\n 'sessionstart' to display session starting time,\n 'now' to display current time.";
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
    const help = "outputs the game data structure at a specified path. Available root keys: 'config', 'state', 'library'.\n Usage: explore key1 key2 key3...";
    return {
        help: help,
        fn: (arguments)=>{
            if(arguments.length==0){
                return {
                    status:false,
                    reason: help
                }
            }
            let output = {status:false, reason: "'"+arguments[0]+"' does not exist. Available root keys: 'config', 'state', 'library'."};
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

class CommandPrompt{
    constructor(game){
        this.game = game;
        
        this.commands = {
            explore: getExplore(this.game),
            time: getTime(this.game),
            resetgame: getResetGame(this.game),
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
    
    prompt(){
        const self = this;
        this.cli.setPrompt('>>> ', 2);
        this.cli.on('line',(line)=>{
            const list = line.split(' ').filter((e)=> e!='');
            if(line=list.length==0){
                self.cli.prompt();
                return;
            }
            const commandId = list[0];
            const args = list.slice(1,list.length);
            
            self.apply(commandId,args);
            self.cli.prompt();
        });
        this.cli.prompt();
    }
    
    apply(commandId,args){
        const commandsList = Object.keys(this.commands);
        const commandId_low = commandId.toLowerCase()
        if(commandId_low=='help'){
            console.log(this.help());
            return;
        }
        if(!commandsList.includes(commandId_low)){
            console.log("'"+commandId_low+"' is not a valid command.");
            return;
        }
        const command = this.commands[commandId_low];
        if(args.length>=1 && args[0]=='-h'){
            console.log(commandId.toUpperCase()+': '+command['help']);
            return
        }
        const output = command.fn(args);
        if(output.status){
            console.log(output.content);
        }
        else{
            console.log(commandId.toUpperCase()+': '+output.reason);
        }
    }
    
    help(){
        const self = this;
        const commandsList = Object.keys(this.commands).sort();
        let output = '';
        commandsList.forEach((commandId)=>{
            const commandHelp = commandId.toUpperCase()+': '+self.commands[commandId].help;
            output = output.concat('\n',commandHelp,'\n');
        });
        return output;        
    }
}

module.exports = {CommandPrompt};