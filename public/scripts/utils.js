// Modulo function
export function mod(a,b) {
    return ((a % b) + b) % b;
};

// Load text with Ajax synchronously: takes path to file and optional MIME type
function loadTextFileAjaxSync(path, mimeType){
    const xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET",path,false);
    if (mimeType != null) {
        if (xmlhttp.overrideMimeType) {
            xmlhttp.overrideMimeType(mimeType);
        }
    }
    xmlhttp.send();
    if (xmlhttp.status==200 && xmlhttp.readyState == 4 ){
        return xmlhttp.responseText;
    }
    else {
    // TODO Throw exception
        return null;
    }
}

// Loads synchronously a JSON file
export function loadJSONSync(path) {
    // Load json file;
    const file = loadTextFileAjaxSync(path, "application/json");
    // Parse json
    return JSON.parse(file);
}

// Loads synchronously a GeoJSON file
export function loadGeoJSONSync(path) {
    // Load json file;
    const file = loadTextFileAjaxSync(path, "application/json");
    // Parse json
    const json = JSON.parse(file);
    // Read features
    return new ol.format.GeoJSON().readFeatures(json, {
        featureProjection: 'EPSG:3857'
    });
}

// Returns a promise to the parsed feature of a GeoJSON file
export function loadGeoJSON(path){
    return fetch(path)
        .then((response) => response.json())
        .then((json) => new ol.format.GeoJSON().readFeatures(json, {
            featureProjection: 'EPSG:3857'
        }));
}

// Returns the team tag in which the coords belong. Returns -1 if neutral.
export function checkSector(coords, gameConfig){
    const relCoordinates = [coords[0]-gameConfig.terrain.gameCenter[0],coords[1]-gameConfig.terrain.gameCenter[1]];
    const isNeutral = (relCoordinates[0]*relCoordinates[0]+relCoordinates[1]*relCoordinates[1])<(gameConfig.terrain.neutralRadius*gameConfig.terrain.neutralRadius);
    if(isNeutral){
        return -1;
    }
    
    const angle = mod(Math.atan2(relCoordinates[1],relCoordinates[0])-gameConfig.terrain.phaseAngle,2*Math.PI);
    const team = Math.floor(angle*gameConfig.teams.length/(2*Math.PI));
    return team;
}

export function rgba(r,g,b,a=1){
    return `rgba(${r},${g},${b},${a})`;
}