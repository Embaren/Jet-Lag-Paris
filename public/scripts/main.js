import {loadGeoJSON, loadGeoJSONSync, rgba} from "/scripts/utils.js";
import {buildLibrary} from "/scripts/library.js";
import {Map} from "/scripts/map.js";

const socket = io();

const game = {};

socket.on('init_config', (gameConfig, callback)=>{
    document.body.innerHTML="";
    
    game.config = gameConfig;
    
    const selectTeamDiv = document.createElement('div');
    
    for(let i=0 ; i<game.config.teams.length ; i++){
        const team = game.config.teams[i];
        const teamButton = document.createElement('button');
        const teamDot = document.createElement('span');
        teamDot.classList.add("dot");
        teamDot.style['backgroundColor']=rgba(...team.color);
        teamButton.appendChild(teamDot);
        teamButton.appendChild(document.createTextNode(team.name));
        teamButton.addEventListener("click", ()=>{
            selectTeamDiv.remove();
            callback(true,i);
        });
        selectTeamDiv.appendChild(teamButton);
    }
    document.body.appendChild(selectTeamDiv);
});

    
socket.on('init_game', (gameState, callback)=>{
    const mapDiv = document.createElement('div');
    mapDiv.id = "mapDiv";
    document.body.appendChild(mapDiv);
    const clipFeature = loadGeoJSONSync(game.config.terrain.clipPath)[0];
    const clipGeometry = clipFeature.getGeometry();
    
    game.state = gameState;
    
    const library=buildLibrary(game, clipGeometry);

    const map = new Map('mapDiv', game.config, 13, clipFeature, library);
    map.addLayers([
                   library.transports['RER'].layers,
                   library.transports['TRAMWAY'].layers,
                   library.transports['METRO'].layers,
                   library.transports['AUTRE'].layers,
                   library.addresses.layer
                   ]);    
    
    callback(true);
});
