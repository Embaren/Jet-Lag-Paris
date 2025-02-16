const {loadGeoJSON, checkSector} = require('./utils_back.js');
const GeoJSONmodPromise = import('ol/format/GeoJSON.js');

const fs = require('fs');
const JSONStream = require('JSONStream');

function getRandomAddressesPromise(addressesPath, gameConfig, clipGeometry){
    
    return new Promise((resolveGlobal, rejectGlobal)=>{
        const nAddressesPerTeam = gameConfig.nAddressesPerTeam;
        const numSamplesPerLoop = nAddressesPerTeam*gameConfig.teams.length*5;
        const sampledIds = [];
        
        // Prepare teams addresses lists
        const teamsAddresses = [];
        gameConfig.teams.forEach((team)=>{
            teamsAddresses.push([]);
        });
        
        const getTeamsAddressesPromise=()=>{
            return new Promise((resolve, reject) => {
                
                GeoJSONmodPromise.then((mod)=>{
                
                    const fileStream = fs.createReadStream(addressesPath);
                    const jsonStream = fileStream.pipe(JSONStream.parse('features.*'));
                    
                    const GeoJSON=mod.default;
                
                    jsonStream.on('header', function (header) {
                        
                        // Prepare random samples
                        const numFeatures = header.numFeatures;
                        let featureId = 0;
                        const newSampledIds = [];
                        while(newSampledIds.length < numSamplesPerLoop){
                            const r = Math.floor(Math.random() * numFeatures);
                            if(sampledIds.indexOf(r) === -1){
                                sampledIds.push(r);
                                newSampledIds.push(r);
                            };
                        }
                        newSampledIds.sort((a,b)=>{return a-b});
                        
                        var complete = false;
                        jsonStream.on('data', function (data) {
                            const id = featureId;
                            featureId+=1;
                            // Update complete condition
                            complete = true;
                            teamsAddresses.forEach((teamAddresses)=>{
                                complete = complete && (teamAddresses.length>=nAddressesPerTeam);
                            });
                            // Stop if complete
                            if(complete){
                                return;
                            }
                            // Stop if no more ids to sample
                            if(!newSampledIds){
                                return;
                            }
                            // Stop if id not to sample
                            if(id!=newSampledIds[0]){
                                return;
                            }
                            newSampledIds.shift();
                            
                            // Parse geofeatures
                            const feature = new GeoJSON().readFeatures(data, {
                                featureProjection: 'EPSG:3857'
                            })[0];
                            const coords = feature.getGeometry().getCoordinates();
                            
                            // Discard out of bounds
                            if(!clipGeometry.intersectsCoordinate(coords)){
                                return;
                            }
                            const team = checkSector(coords, gameConfig);
                            // Discard neutral
                            if(team==-1){
                                return;
                            }
                            // Discard if team is aldready full
                            if(teamsAddresses[team].length>=nAddressesPerTeam){
                                return;
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
                            
                        });
                        jsonStream.on('end', function () {
                            if(complete){
                                resolve(0);
                            }
                            else{
                                getTeamsAddressesPromise().then((iter)=>{resolve(iter+1)});
                            }
                        });
                        jsonStream.on('error', function (error) {
                            reject(error);
                        });
                    });
                
                });
            });
        }
        getTeamsAddressesPromise().then((numIterations)=>{resolveGlobal([].concat(...teamsAddresses))});
    });
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
            
            const buildAddressesPromise = getRandomAddressesPromise('./public'+gameConfig.terrain.addressesPath, gameConfig, self.clipGeometry)
                .then((addresses)=>{self.addresses = addresses; return true});
            
            return Promise.all([buildAddressesPromise]);
        });
        
    }
}

module.exports = {Library};