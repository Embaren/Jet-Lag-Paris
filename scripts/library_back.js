const {loadGeoJSON, loadJSON, checkSector} = require('./utils_back.js');

function getRandomAddresses(addressesFeatures, gameConfig, clipGeometry){
    const nAddressesPerTeam = gameConfig.nAddressesPerTeam;
    const nTotalAddresses = addressesFeatures.length;
    
    const getRandomIndex = ()=>{
        return Math.floor(Math.random()*nTotalAddresses);
    }
    
    const sampledIndices = [];
    
    // Prepare teams addresses lists
    const teamsAddresses = [];
    gameConfig.teams.forEach((team)=>{
        teamsAddresses.push([]);
    });
    
    let complete = false;
    
    while(!complete){
        // Sample new address
        let i = getRandomIndex();
        while(sampledIndices.includes(i)){
            i = getRandomIndex();
        }
        sampledIndices.push(i);
        
        const feature = addressesFeatures[i];
        const coords = feature.getGeometry().getCoordinates();
        
        // Discard out of bounds
        if(!clipGeometry.intersectsCoordinate(coords)){
            continue;
        }
        
        const team = checkSector(coords, gameConfig);
        // Discard neutral
        if(team==-1){
            continue;
        }
        // Discard if team is aldready full
        if(teamsAddresses[team].length>=nAddressesPerTeam){
            continue;
        }
        // Assign address to team
        const mercCoordinates = feature.getGeometry().getCoordinates();
        const latLonCoordinates = feature.getGeometry().transform('EPSG:3857', 'EPSG:4326').getCoordinates();
        const address = {
            type: "Feature",
            geometry: {
                "type": "Point",
                coordinates: latLonCoordinates,
            },
            properties: {
                type: "address",
                web_merc_coordinates: mercCoordinates,
                team: team,
                team_color: gameConfig.teams[team].color,
                current_owner: team,
                owner_color: gameConfig.teams[team].color,
                name: feature.get("l_adr"),
                district: feature.get("c_ar"),
                effects:[]
            }
        }
        teamsAddresses[team].push(address);
        
        // Update end condition
        complete = true;
        teamsAddresses.forEach((teamAddresses)=>{
            complete = complete && (teamAddresses.length>=nAddressesPerTeam);
        });
    }
    const addresses = [].concat(...teamsAddresses);
    return addresses;
}

class Library{
    constructor(gameConfig){
        const clipFeaturesPromise = loadGeoJSON('./public'+gameConfig.terrain.clipPath);
        const linesFeaturesPromise = loadGeoJSON('./public'+gameConfig.terrain.linesPath);
        const stationsFeaturesPromise = loadGeoJSON('./public'+gameConfig.terrain.stationsPath);
        
        const self = this;
        
        this.whenReady = clipFeaturesPromise.then((clipFeatures)=>{
            const clipFeature = clipFeatures[0];
            self.clipGeometry = clipFeature.getGeometry();
            
            const buildAddressesPromise = loadGeoJSON('./public'+gameConfig.terrain.addressesPath).then((addressesFeatures)=>{
                self.addresses = getRandomAddresses(addressesFeatures, gameConfig, self.clipGeometry);
                return true;
            });
            
            return Promise.all([buildAddressesPromise]);
        });
        
        
        
        
    }
}

module.exports = {Library};