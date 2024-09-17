import {loadGeoJSON, checkSector, mod, rgba} from "/scripts/utils.js";

// Returns style associated with a transport line
export function getTransportStyle(lineWidth, radius, shape, gameConfig){
    return (color, highlighted=false)=>{
        const highlightFactor=highlighted ? 4 : 0;
        return function(feature,resolution){
            const type = feature.get("type");
            if (type=="line"){
                return new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: color,
                        width: lineWidth + highlightFactor,
                    }),
                });
            }
            else if(type=="station"){
                const team = feature.get('team');
                const teamColor = rgba(...feature.get('team_color'));
                
                if(shape=="circle"){
                    return new ol.style.Style({
                        image: new ol.style.Circle({
                            fill: new ol.style.Fill({
                                color: teamColor,
                            }),
                            stroke: new ol.style.Stroke({
                                color: color,
                                width: lineWidth,
                            }),
                            radius:radius + highlightFactor,
                        }),
                    });
                }
                else{
                    return new ol.style.Style({
                        image: new ol.style.RegularShape({
                            fill: new ol.style.Fill({
                                color: teamColor,
                            }),
                            stroke: new ol.style.Stroke({
                                color: color,
                                width: lineWidth,
                            }),
                            radius:radius + highlightFactor,
                            angle:(shape=="square")?Math.PI/4:0,
                            points:(shape=="square")?4:3,
                        }),
                    });
                }
            }
        }
    }
}

function getPinStyle(outerColor, innerColor, outerRadius, InnerRadius, lineWidth, lineColor){
    const ratio = 2;
    const alpha = Math.asin(1/ratio);
    return new ol.style.Style({
        renderer: (coordinates, state)=>{
            const [x,y] = coordinates;
            const ctx = state.context;
            
            const [x_c, y_c] = [x, y-ratio*outerRadius];
            
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.arc(x_c,y_c,outerRadius,-Math.PI-alpha,0+alpha,false);
            ctx.lineTo(x, y)
            
            ctx.fillStyle=outerColor;
            ctx.fill();
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle=lineColor;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(x_c,y_c,InnerRadius,0,2*Math.PI,false);
            ctx.fillStyle=innerColor;
            ctx.fill();
            ctx.strokeStyle=lineColor;
            ctx.stroke();
            
        },
    });
}

function addressStyle(lineColor, highlighted=false){
    const highlightFactor=highlighted ? 6 : 0;
    return function(feature,resolution){
        const lineWidth = 3;
        const radius = 10;
        const innerRadius = 4;
        const teamColor = rgba(...feature.get('team_color'));
        const ownerColor = rgba(...feature.get('owner_color'));
        
        return getPinStyle(ownerColor,teamColor,radius+highlightFactor,innerRadius+highlightFactor,lineWidth,lineColor);
    }
}

function populateStations(library,gameConfig,stationsFeaturesPromise,clipGeometry){
    return stationsFeaturesPromise.then((stationsFeatures)=>{
        const keys = Object.keys(library.transports);
        
        stationsFeatures.forEach((feature)=>{
            
            // Discard out of bounds
            const coords = feature.getGeometry().getCoordinates();
            if(!clipGeometry.intersectsCoordinate(coords)){
                return;
            }
            // Add station to line layer
            const mode = feature.get("mode");
            const indice = feature.get("indice_lig");
            const team = checkSector(coords, gameConfig);
            const teamColor = (team==-1) ? [255,255,255] : gameConfig.teams[team].color;
            const name = feature.get("nom_gares");
            if(keys.includes(mode)){
                if(Object.keys(library.transports[mode].lines).includes(indice)){
                    const newFeature = new ol.Feature({
                        geometry: feature.getGeometry(),
                        type: 'station',
                        name: name,
                        mode: mode,
                        line_id: indice,
                        team: checkSector(coords, gameConfig),
                        team_color: teamColor,
                    });
                    library.transports[mode].lines[indice]["features"].push(newFeature);
                    // Add station to stations dict
                    if(!Object.keys(library.stations).includes(name)){
                        library.stations[name] = new ol.Collection([]);
                    }
                    library.stations[name].push(newFeature);
                }
            }
            else if(indice=="FUN" && Object.keys(library.transports["AUTRE"].lines).includes("FUN")){
                const newFeature = new ol.Feature({
                    geometry: feature.getGeometry(),
                    type: 'station',
                    name: name,
                    mode: 'AUTRE',
                    line_id: indice,
                    team: checkSector(coords, gameConfig),
                    team_color: teamColor,
                });
                library.transports["AUTRE"].lines[indice]["features"].push(newFeature);
                library.stations[name] = new ol.Collection([newFeature]);
                
            }
        });
        return true;
    });
}

function populateLines(library,linesFeaturesPromise,clipGeometry){
    return linesFeaturesPromise.then((linesFeatures)=>{
        const modeKeys = Object.keys(library.transports);               
        
        linesFeatures.forEach((feature)=>{
            
            // Discard out of bounds
            if(!feature.getGeometry().getCoordinates().some((coords)=>clipGeometry.intersectsCoordinate(coords))){
                return;
            }
            
            const mode = feature.get("mode");
            const indice = feature.get("indice_lig");
            
            // Filter transport mode
            if(modeKeys.includes(mode)){
                // Create line if not exists
                if(!Object.keys(library.transports[mode].lines).includes(indice)){
                    library.transports[mode].lines[indice]={
                        color:"#"+feature.get("colourweb_hexa"),
                        features:new ol.Collection([]),
                        name:feature.get("res_com"),
                    }
                }
                // Add feature to line
                const newFeature = new ol.Feature({
                    geometry: feature.getGeometry(),
                    type: 'line',
                    color: library.transports[mode].lines[indice]['color'],
                    mode: mode,
                    line_id: indice,
                });
                library.transports[mode].lines[indice]["features"].push(newFeature);
            }
            // Special case
            else if(indice=="FUN"){
                if(!Object.keys(library.transports["AUTRE"].lines).includes(indice)){
                    library.transports["AUTRE"].lines[indice]={
                        color:"#"+feature.get("colourweb_hexa"),
                        features:new ol.Collection([]),
                        name:feature.get("res_com"),
                    }
                }
                const newFeature = new ol.Feature({
                    geometry: feature.getGeometry(),
                    type: 'line',
                    mode: 'AUTRE',
                    line_id: indice,
                });
                library.transports["AUTRE"].lines[indice]["features"].push(newFeature);
            }
        });
        
        Object.keys(library.transports).forEach((modeKey)=>{
            Object.keys(library.transports[modeKey].lines).sort().forEach((key)=>{
                const source=new ol.source.Vector({
                    features: library.transports[modeKey].lines[key]['features'],
                });
                const layer = new ol.layer.Vector({
                    source: source,
                    style: library.transports[modeKey].style(library.transports[modeKey].lines[key]['color']),
                });
                layer.on('postrender',library.transports[modeKey].layers?.postrenderFn);
                library.transports[modeKey].layers.getLayers().push(layer);
            });
        });
        
        return true;
    });
}

function populateAddresses(library,gameConfig,addressesList){
    const addressesGeoJSON = {
        type: "FeatureCollection",
        features: addressesList
    }
    const addressesFeatures = new ol.format.GeoJSON().readFeatures(addressesGeoJSON, {
        featureProjection: 'EPSG:3857'
    });
    const addressesCollection = new ol.Collection(addressesFeatures);
    
    const addressesSource=new ol.source.Vector({
        features: addressesCollection,
    });
    const addressesLayer = new ol.layer.Vector({
        source: addressesSource,
        style: addressStyle('black'),
    });
    addressesLayer.name = "ADRESSES";
    
    library.addresses = {
        features:addressesCollection,
        layer:addressesLayer,
        style:addressStyle
    };
}

export function buildLibrary(game, clipGeometry){
    
    const transportDict={
        METRO: {
            layers: new ol.layer.Group({layers:[]}),
            style: getTransportStyle(4,6,'circle'),
            lines:{},
        },
        RER: {
            layers: new ol.layer.Group({layers:[]}),
            style: getTransportStyle(6,10,'square'),
            lines:{},
        },
        TRAMWAY: {
            layers: new ol.layer.Group({layers:[]}),
            style: getTransportStyle(5,8,'triangle'),
            lines:{},
        },
        AUTRE: {
            layers: new ol.layer.Group({layers:[]}),
            style: getTransportStyle(4,6,'triangle'),
            lines:{},
        },
    }
    
    Object.keys(transportDict).forEach((modeKey)=>{
        const layerGroup = transportDict[modeKey].layers;
        layerGroup.name = modeKey;
        layerGroup.setExtent(game.config.terrain.extent);
        layerGroup.clip = (postrenderFn)=>{
            layerGroup.on('postrender',postrenderFn);
            layerGroup.postrenderFn=postrenderFn;
            layerGroup.getLayers().forEach((layer)=>{
                layer.on('postrender',postrenderFn);
            });
        }
    });
    
    const stationsDict = {};
    
    const library = {
        transports: transportDict,
        stations: stationsDict,
    };
    
    const linesFeaturesPromise = loadGeoJSON(game.config.terrain.linesPath);
    const stationsFeaturesPromise = loadGeoJSON(game.config.terrain.stationsPath);

    populateLines(library,linesFeaturesPromise,clipGeometry)
        .then((status)=>{populateStations(library,game.config,stationsFeaturesPromise,clipGeometry);});
    
    populateAddresses(library, game.config, game.state.addresses);
    
    return library;
}