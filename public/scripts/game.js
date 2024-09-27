import {rgba, loadGeoJSON, loadGeoJSONSync} from "/scripts/utils.js";
import {buildLibrary} from "/scripts/library.js";
import {Map} from "/scripts/map.js";
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
        this.socket = io();
        this.container = gameContainer;
        
        this.tracking = null;
        this.trackingPermission = false;
        this.client = new Client();
        this.players = new Players();
        
        const game = this;
        if(autorun){
            game.socket.on("disconnect", () => {
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
            game.players.setPlayerLocation(playerId,loc);
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
            //const teamDot = document.createElement('span');
            //teamDot.classList.add("dot");
            //teamDot.style['backgroundColor']=rgba(...team.color);
            //teamNameSpan.appendChild(teamDot);
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
            game.socket.emit('identify_client',game.client.playerId,game.client.loc.current,(state,players)=>{
                
                game.players.initPlayers(players, game.config);
                
                const mapDiv = document.createElement('div');
                mapDiv.id = "mapDiv";
                document.body.appendChild(mapDiv);
                
                const clipFeature = loadGeoJSONSync(game.config.terrain.clipPath)[0];
                const clipGeometry = clipFeature.getGeometry();
                
                game.state = state;
                const library = buildLibrary(game, clipGeometry);
                game.library = library;
                
                const map = new Map(game,'mapDiv',clipFeature,13);
                game.map = map;
                
                game.map.addClippedLayers([
                    library.transports['RER'].layers,
                    library.transports['TRAMWAY'].layers,
                    library.transports['METRO'].layers,
                    library.transports['AUTRE'].layers,
                ]);
                game.map.addLayers([library.addresses.layer,game.players.getLayer(),game.client.getLayer()]);
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
}