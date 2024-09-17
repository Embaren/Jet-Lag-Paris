import {loadGeoJSON, checkSector, mod, rgba} from "/scripts/utils.js";

// Returns style associated with a transport line
export function getTransportStyle(lineWidth, radius, shape){
    return (color, highlighted=false)=>{
        const highlightFactor=highlighted ? 3 : 0;
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

export function buildTransportDict(maskFeaturesPromise, gameConfig){
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
        layerGroup.setExtent(gameConfig.extent);
        layerGroup.clip = (postrenderFn)=>{
            layerGroup.on('postrender',postrenderFn);
            layerGroup.postrenderFn=postrenderFn;
            layerGroup.getLayers().forEach((layer)=>{
                layer.on('postrender',postrenderFn);
            });
        }
    });
    
    const linesFeaturesPromise = loadGeoJSON('/resources/geojsons/trains.geojson');
    const stationsFeaturesPromise = loadGeoJSON('/resources/geojsons/gares.geojson');

    maskFeaturesPromise.then((maskFeatures)=>{
        const maskGeometry = maskFeatures[0].getGeometry();
        
        linesFeaturesPromise.then((linesFeatures)=>{
            const keys = Object.keys(transportDict);               
            
            linesFeatures.forEach((feature)=>{
                if(!feature.getGeometry().getCoordinates().some((coords)=>maskGeometry.intersectsCoordinate(coords))){
                    return;
                }
                
                const mode = feature.get("mode");
                const indice = feature.get("indice_lig");
                if(keys.includes(mode)){
                    if(!Object.keys(transportDict[mode].lines).includes(indice)){
                        transportDict[mode].lines[indice]={
                            color:"#"+feature.get("colourweb_hexa"),
                            features:new ol.Collection([]),
                            name:feature.get("res_com"),
                        }
                    }
                    const newFeature = new ol.Feature({
                        geometry: feature.getGeometry(),
                        type: 'line',
                        color: transportDict[mode].lines[indice]['color'],
                        mode: mode,
                        line_id: indice,
                    });
                    transportDict[mode].lines[indice]["features"].push(newFeature);
                }
                else if(indice=="FUN"){
                    if(!Object.keys(transportDict["AUTRE"].lines).includes(indice)){
                        transportDict["AUTRE"].lines[indice]={
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
                    transportDict["AUTRE"].lines[indice]["features"].push(newFeature);
                }
            });
            stationsFeaturesPromise.then((stationsFeatures)=>{
                const keys = Object.keys(transportDict);
                stationsFeatures.forEach((feature)=>{
                
                    const coords = feature.getGeometry().getCoordinates();
                    if(!maskGeometry.intersectsCoordinate(coords)){
                        return;
                    }
                    
                    const mode = feature.get("mode");
                    const indice = feature.get("indice_lig");
                    const team = checkSector(coords, gameConfig);
                    const teamColor = (team==-1) ? [255,255,255] : gameConfig.teams[team].color;
                    if(keys.includes(mode)){
                        if(Object.keys(transportDict[mode].lines).includes(indice)){
                            const newFeature = new ol.Feature({
                                geometry: feature.getGeometry(),
                                type: 'station',
                                name: feature.get("nom_gares"),
                                mode: mode,
                                line_id: indice,
                                team: checkSector(coords, gameConfig),
                                team_color: teamColor,
                            });
                            transportDict[mode].lines[indice]["features"].push(newFeature);
                        }
                    }
                    else if(indice=="FUN" && Object.keys(transportDict["AUTRE"].lines).includes("FUN")){
                        const newFeature = new ol.Feature({
                            geometry: feature.getGeometry(),
                            type: 'station',
                            name: feature.get("nom_gares"),
                            mode: 'AUTRE',
                            line_id: indice,
                            team: checkSector(coords, gameConfig),
                            team_color: teamColor,
                        });
                        transportDict["AUTRE"].lines[indice]["features"].push(newFeature);
                    }
                });
            });
            
            Object.keys(transportDict).forEach((modeKey)=>{
                Object.keys(transportDict[modeKey].lines).sort().forEach((key)=>{
                    const source=new ol.source.Vector({
                        features: transportDict[modeKey].lines[key]['features'],
                    });
                    const layer = new ol.layer.Vector({
                        source: source,
                        style: transportDict[modeKey].style(transportDict[modeKey].lines[key]['color']),
                    });
                    layer.on('postrender',transportDict[modeKey].layers?.postrenderFn);
                    transportDict[modeKey].layers.getLayers().push(layer);
                });
            });
        });
    });
    
    return transportDict;
}