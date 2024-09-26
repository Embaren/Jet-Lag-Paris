const fs = require('fs');

// Modulo function
function mod(a,b) {
    return ((a % b) + b) % b;
};

// Loads a JSON file synchronously
function loadJSONSync(path){
    const file = fs.readFileSync(path);
    return JSON.parse(file);
}

// Loads a JSON file asynchronously
function loadJSON(path){
    const filePromise = fs.promises.readFile(path);
    return filePromise.then((file)=>{return JSON.parse(file);});
}

// Returns a promise to the parsed feature of a GeoJSON file
function loadGeoJSON(path){
    const GeoJSONmodPromise = import('ol/format/GeoJSON.js');
    const filePromise = fs.promises.readFile(path);
    
    return Promise.all([GeoJSONmodPromise,filePromise]).then((values) => {
        const GeoJSON = values[0].default;
        const json = JSON.parse(values[1]);
        return new GeoJSON().readFeatures(json, {
            featureProjection: 'EPSG:3857'
        });
    });
}

// Returns the team tag in which the coords belong. Returns -1 if neutral.
function checkSector(coords, gameConfig){
    const relCoordinates = [coords[0]-gameConfig.terrain.gameCenter[0],coords[1]-gameConfig.terrain.gameCenter[1]];
    const isNeutral = (relCoordinates[0]*relCoordinates[0]+relCoordinates[1]*relCoordinates[1])<(gameConfig.terrain.neutralRadius*gameConfig.terrain.neutralRadius);
    if(isNeutral){
        return -1;
    }
    
    const angle = mod(Math.atan2(relCoordinates[1],relCoordinates[0])-gameConfig.terrain.phaseAngle,2*Math.PI);
    const team = Math.floor(angle*gameConfig.teams.length/(2*Math.PI));
    return team;
}

// Converts a duration to a string hh:mm:ss.ms
function msToTime(s,precision="ms"){
    const ms = s % 1000;
    s = (s - ms) / 1000;
    const secs = s % 60;
    s = (s - secs) / 60;
    const mins = s % 60;
    const hrs = (s - mins) / 60;

    switch(precision){
        case "h":
            return hrs;
        case "m":
            return hrs + ':' + mins;
        case "s":
            return hrs + ':' + mins + ':' + secs;
        default:
            return hrs + ':' + mins + ':' + secs + '.' + ms;
    }
}

module.exports = {mod,checkSector,loadJSONSync,loadJSON,loadGeoJSON,msToTime};