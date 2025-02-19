import {rgba, loadGeoJSON, loadGeoJSONSync} from "/scripts/utils.js";
import {buildLibrary} from "/scripts/library.js";
import {Map} from "/scripts/map.js";
import {Powers} from "/scripts/powers.js";
import {getClientStyle, getPlayerStyle} from "/scripts/ol_styles.js";

class Client{
    constructor(){
        this.playerId = null;
        this.playerConfig = null;
        this.teamId = null;
        this.teamConfig = null;
        
        this.loc={
            "current":null,
            "lastSent":null
        };
        this.feature = null;
        this.layer = null;
        this.style = getClientStyle(this);
    }
    initClient(playerId,config){
        const player = config.players[playerId];
        this.playerId = playerId;
        this.playerConfig = player;
        this.teamId = player.team;
        this.teamConfig = config.teams[player.team];
    }
    setLocation(newLocation){
        this.loc.current = newLocation;
        if(this.feature){
            this.feature.setGeometry(new ol.geom.Point([this.loc.current.x,this.loc.current.y]));
        }
    }
    updateLastSent(){
        this.loc.lastSent = this.loc.current;
    }
    getDistanceFromLastSent(){
        return ol.sphere.getDistance(
            [this.loc.lastSent.longitude,this.loc.lastSent.latitude],
            [this.loc.current.longitude,this.loc.current.latitude]
        );
    }
    getTimeFromLastSent(){
        return Date.now()-this.loc.lastSent.timestamp;
    }
    getLayer(){
        if(!this.layer){
            
            this.feature = new ol.Feature({
                geometry: new ol.geom.Point([this.loc.current.x,this.loc.current.y]),
            });
            this.feature.set('type','client');
            this.layer = new ol.layer.Vector({
                source: new ol.source.Vector({features:[this.feature]}),
                style: this.style('black',false),
            });
            this.layer.name = "MA POSITION";
        }
        return this.layer;
    }
}

class Players{
    constructor(){
        this.states = {}
        this.layer = null;
        this.style = null;
    }
    initPlayers(players, config){
        this.config = config;
        const self = this;
        const featuresCollection = new ol.Collection([]);
        
        // load pictures
        const picturesPromises = []
        const playerIds = Object.keys(players);
        
        playerIds.forEach((playerId)=>{
            const picturesPromise = new Promise((resolve,reject)=>{
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = (err) => reject(err);
                img.src = config.players[playerId].picture;
            });
            
            const state = players[playerId];
            self.states[playerId]=state;
            const feature = new ol.Feature({
                geometry: new ol.geom.Point([state.loc?.x,state.loc?.y]),
            });
            feature.set('type','player');
            feature.set('playerId',playerId);
            self.states[playerId].feature = feature;
            featuresCollection.push(feature);
            
            picturesPromise.then((img)=>{
                const team = config.teams[config.players[playerId].team];
                state.style = getPlayerStyle(img,rgba(...team.color));
                feature.setStyle(state.style());
            });
        });
        this.layer = new ol.layer.Vector({
            source: new ol.source.Vector({features:featuresCollection}),
            //style: this.style('black',false),
        });
        this.layer.name = "JOUEURS";
    }
    getLayer(){
        return this.layer;
    }
    setPlayerLocation(playerId,loc){
        if(!Object.keys(this.states).includes(playerId)){
            return;
        }
        
        this.states[playerId].loc=loc;
        this.states[playerId].feature.setGeometry(new ol.geom.Point([loc.x,loc.y]));
    }
}

export class Game{
    constructor(io, gameContainer, autorun=true){
        this.io = io;
        this.socket = io('/game');
        this.container = gameContainer;
        
        this.tracking = null;
        this.trackingPermission = false;
        this.client = new Client();
        this.players = new Players();
		this.ready = false;
        
        const game = this;
        if(autorun){
            game.socket.on("disconnect", () => {
				game.ready = false;
                game.stopTracking();
                
                game.container.innerHTML="";
                const disconnectDiv = document.createElement("div");
                disconnectDiv.style['color']="white";
                disconnectDiv.style['position']="absolute";
                disconnectDiv.style['top']="50%";
                disconnectDiv.style['-ms-transform']="translateY(-50%)";
                disconnectDiv.style['transform']="translateY(-50%)";
                disconnectDiv.appendChild(document.createTextNode("CONNECTION PERDUE. VEUILLEZ ATTENDRE OU REACTUALISER LA PAGE."));
                game.container.appendChild(disconnectDiv);
            });
            game.socket.on("connect", () => {
                console.log("Connect");
                game.initConfig();
            });
        }
        
        this.socket.on('update_player_location',(playerId,loc)=>{
			if(!game.ready){
				return;
			}
            game.players.setPlayerLocation(playerId,loc);
        });
        
        this.socket.on('capture',(addressId,teamId)=>{
			if(!game.ready){
				return;
			}
            game.switchAddress(addressId,teamId);
			alert("L'équipe "+game.config.teams[teamId].name+" a capturé "+game.library.addresses.features.item(addressId).get('name'));
        });
        
        this.socket.on('challenge',(addressId,teamId)=>{
			if(!game.ready){
				return;
			}
            game.challengeAddress(addressId,teamId);
        });
        
        this.socket.on('unchallenge',(addressId,teamId)=>{
			if(!game.ready){
				return;
			}
            game.unchallengeAddress(addressId,teamId);
        });
        
        this.socket.on('give',(points)=>{
			if(!game.ready){
				return;
			}
            game.updatePoints(points);
		});
        
        this.socket.on('power',(power)=>{
			
			if(!game.ready){
				return;
			}
			
			game.addPower(power);
		});
		
        this.socket.on('complete_power',(powerId,source)=>{
			if(!game.ready){
				return;
			}
			game.powers.completePower(powerId,source);
		});
    }
    
    initConfig(){
        const game = this;
        game.startTracking();
        this.socket.emit('request_config',(config)=>{
            game.config = config;
            game.selectPlayer();
        });
    }
    
    selectPlayer(){
        const game = this;
        
        game.container.innerHTML="";

        const selectPlayerDiv = document.createElement('div');
        selectPlayerDiv.classList.add('select_player_div');
        
        const teamDivs = [];
        for(let i=0 ; i<game.config.teams.length ; i++){
            const team = game.config.teams[i];
            const teamDiv = document.createElement('div');
            teamDiv.classList.add('team_div');
            teamDiv.style['borderColor']=rgba(...team.color);
            const teamNameSpan = document.createElement('span');
            teamNameSpan.appendChild(document.createTextNode(team.name));
            teamDiv.appendChild(teamNameSpan);
            teamDivs.push(teamDiv);
            selectPlayerDiv.appendChild(teamDiv);
        }
        
        Object.keys(game.config.players).forEach((playerId)=>{
            const player = game.config.players[playerId];
            const playerButton = document.createElement('button');
            playerButton.appendChild(document.createTextNode(player.name));
            playerButton.addEventListener("click", ()=>{
                selectPlayerDiv.remove();
                game.client.initClient(playerId, game.config);
                game.requestGameState();
            });
            teamDivs[player.team].appendChild(playerButton);
        });
        
        document.body.appendChild(selectPlayerDiv);
    }
    
    requestGameState(){
        const game = this;
        
        const makeRequest = ()=>{
            game.client.updateLastSent();
            game.socket.emit('identify_client',game.client.playerId,game.client.loc.current,(state,players,powers)=>{
                
                game.players.initPlayers(players, game.config);
				game.powers = new Powers(game.config.powers);
                
                const mapDiv = document.createElement('div');
                mapDiv.id = "mapDiv";
                document.body.appendChild(mapDiv);
                
                const clipFeature = loadGeoJSONSync(game.config.terrain.clipPath)[0];
                const clipGeometry = clipFeature.getGeometry();
                
                game.state = state;
                const libraryPromise = buildLibrary(game, clipGeometry);
                
				Promise.all([libraryPromise,game.powers.tokensReady]).then((values)=>{
					game.library = values[0];
					const map = new Map(game,'mapDiv',clipFeature,13);
					game.map = map;
					
					game.ready = true;
					
					game.map.addClippedLayers([
						game.library.transports['RER'].layers,
						game.library.transports['TRAMWAY'].layers,
						game.library.transports['METRO'].layers,
						game.library.transports['AUTRE'].layers,
					]);
					game.map.addLayers([game.library.addresses.layer,game.players.getLayer(),game.client.getLayer()]);
					
					powers.forEach((p)=>{game.addPower(p)});
				});
            });
        }
        
        const waitingDiv = document.createElement("div");
        waitingDiv.style['color']="white";
        waitingDiv.style['position']="absolute";
        waitingDiv.style['top']="50%";
        waitingDiv.style['-ms-transform']="translateY(-50%)";
        waitingDiv.style['transform']="translateY(-50%)";
        waitingDiv.appendChild(document.createTextNode("EN ATTENTE DU PARTAGE DE POSITION..."));
        game.container.appendChild(waitingDiv);
        
        const checkLocation = ()=>{
            if(game?.client.loc?.current){
                waitingDiv.remove();
                makeRequest();
            }
            else{
                setTimeout(checkLocation,200);
            }
        }
        checkLocation();
        
    };
    
    updateTrackingPermission(bool){
        if(this.trackingPermission!=bool){
            this.trackingPermission = bool;
        }
    }
    
        
    // Share current location with server
    shareLocation(){
        const game = this;
        game.socket.emit('share_location',game.client.loc.current,(status)=>{
            if(status.status){
                game.client.updateLastSent();
            }
            else{
                console.log("Position update denied by server");
            }
        });
    }
    
    startTracking(){
        const game = this;
        game.client.loc = {
            "current":null,
            "lastSent":null
        }
        
        const ifFailure = (error)=>{
            if(error.code == error.PERMISSION_DENIED){
                if(!alert('Le partage de position est indispensable au bon fonctionnement du jeu. Autorisez-le pour avoir accès à la carte. La page va se réactualiser.')){window.location.reload();}
                game.updateTrackingPermission(false);
            }
            else{
                console.log(error);
            }
        };
        
        const ifSuccess = ((pos)=>{
            
            game.updateTrackingPermission(true);
            
            const xy = ol.proj.fromLonLat([pos.coords.longitude,pos.coords.latitude]);
            
            var newLocation = {};
            if(pos.coords.toJSON){
                newLocation = {...pos.coords.toJSON()};
            }
            else{
                for(let key in pos.coords){
                    newLocation[key] = pos.coords[key];
                }
            }
            
            newLocation.x = xy[0];
            newLocation.y = xy[1];
            newLocation.timestamp = pos.timestamp;
            
            game.client.setLocation(newLocation);
            
            // Share location if never shared
            if(!game.client.loc.lastSent){
                game.shareLocation();
                return;
            };
            
            const lastSent = game.client.loc.lastSent;
            const distanceFromLastSent = game.client.getDistanceFromLastSent();
            
            // Don't share location if haven't moved
            if(distanceFromLastSent<game.config.locations.minUpdateRange){
                return;
            }
            
            const timeFromLastSent = game.client.getTimeFromLastSent();
            // Don't share location if shared recently and haven't moved significantly
            if((timeFromLastSent<game.config.locations.minUpdateTime) && (distanceFromLastSent<game.config.locations.maxUpdateRange)){
                return;
            }
            
            // Share location with server
            game.shareLocation();
        });
        
        this.tracking = navigator.geolocation.watchPosition(ifSuccess, ifFailure);
    }
    
    stopTracking(){
        this.updateTrackingPermission(false);
        if(this.tracking){
            navigator.geolocation.clearWatch(this.tracking);
            this.tracking = null;
        }
    }
	
	challenge(addressId){
		const game = this;
		this.socket.emit('challenge',addressId,(status)=>{
			if(status){
				game.challengeAddress(addressId, game.client.teamId);
			}
        });
	}
	
	unchallenge(addressId){
		const game = this;
		this.socket.emit('unchallenge',addressId,(status)=>{
			if(status){
				game.unchallengeAddress(addressId, game.client.teamId);
			}
        });
	}
	
	capture(addressId){
		const game = this;
		this.socket.emit('capture',addressId,(status)=>{
			if(status){
				game.switchAddress(addressId, game.client.teamId);
			}
        });
	}
	
	challengeAddress(addressId, teamId){
		const feature = this.library.addresses.features.item(addressId);
		const challengers = feature.get('challengers');
		const challengers_colors = feature.get('challengers_colors');
		if(!challengers.includes(teamId)){
			challengers.push(teamId);
			challengers_colors.push(this.config.teams[teamId].color);
		}
		feature.setProperties({'challengers':challengers,'challengers_colors':challengers_colors});
	}
	
	unchallengeAddress(addressId, teamId){
		const feature = this.library.addresses.features.item(addressId);
		const challengers = feature.get('challengers');
		const challengers_colors = feature.get('challengers_colors');
		if(challengers.includes(teamId)){
			const challengerIndex = challengers.indexOf(teamId);
			challengers.splice(challengerIndex,1);
			challengers_colors.splice(challengerIndex,1);
		}
		feature.setProperties({'challengers':challengers,'challengers_colors':challengers_colors});
	}
	
	switchAddress(addressId, teamId){
		const feature = this.library.addresses.features.item(addressId);
		feature.setProperties({'current_owner':teamId, 'owner_color':this.config.teams[teamId].color, 'challengers':[], 'challengers_colors':[]});
	}
	
	addPower(power){
		const game = this;
		const additionalFn=[];
		switch(power.powerId){
			case 'closing':
				additionalFn.push((power)=>{
					game.library.stations[power.target].forEach((f)=>{
						f.set('line_color',game.library.transports[f.get('mode')].lines[f.get('line_id')].color);
					});
				});
			break;
			case 'strike':
				additionalFn.push((power)=>{
					const line = game.library.transports[power.target.mode].lines[power.target.line];
					line.features.forEach((f)=>{
						f.set('line_color',line.color);
					});
				});
			break;
		}
		game.powers.pushPower(power,(p)=>{additionalFn.forEach((fn)=>{fn(p)});game.map.updatePowers()});
		if(power.active){
			game.map.updatePowers();
			switch(power.powerId){
				case 'closing':
					game.library.stations[power.target].forEach((f)=>{
						f.set('line_color','black');
					});
				break;
				case 'strike':{
					const line = game.library.transports[power.target.mode].lines[power.target.line];
					line.features.forEach((f)=>{
						f.set('line_color','black');
					});
				}
				break;
			}
		}
	}
	
	updatePoints(points){
		this.state.teams[this.client.teamId].points += points;
		this.map.updateTeamInfo();
	};
	
	buyPower(powerId, target=null){
		this.socket.emit('buy_power',powerId,target,(result)=>{console.log(result)});
	};
	
	completePower(powerId){
		this.socket.emit('complete_power',powerId,(result)=>{console.log(result)});
	};
}