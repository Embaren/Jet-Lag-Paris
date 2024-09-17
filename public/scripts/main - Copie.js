import {loadGeoJSON} from "/scripts/utils.js";
import {getTransportStyle, buildTransportDict} from "/scripts/transports_utils.js";
import {Map} from "/scripts/map.js";

const socket = io();

socket.on('init_game', (gameParams, gameState)=>{
    var hovered = null;
    
    const maskFeaturesPromise = loadGeoJSON('/resources/geojsons/paris.geojson');
    const transportDict=buildTransportDict(maskFeaturesPromise, gameParams);

    const map = new Map('mapDiv', gameParams, 13, maskFeaturesPromise);
    map.addLayers([
                   transportDict['RER'].layers,
                   transportDict['TRAMWAY'].layers,
                   transportDict['METRO'].layers,
                   transportDict['AUTRE'].layers
                   ]);

    map.map.on('pointermove', function (e) {
        if (hovered !== null) {
            if(hovered.get('mode')){
                const mode = hovered.get('mode');
                const type = hovered.get('type');
                const line = transportDict[mode].lines[hovered.get('line_id')];
                const color = line.color;
                if(type=="line"){
                    line.features.forEach((feature)=>{
                        feature.setStyle(transportDict[mode].style(color));
                    });
                }
                else{
                    hovered.setStyle(transportDict[mode].style(color));
                }
                const lineName = line.name;
            }
            hovered = null;
        }
        map.map.forEachFeatureAtPixel(e.pixel, function (f) {
            hovered = f;
            if(hovered.get('mode')){
                const mode = hovered.get('mode');
                const type = hovered.get('type');
                const line = transportDict[mode].lines[hovered.get('line_id')];
                const color = line.color;
                if(type=="line"){
                    line.features.forEach((feature)=>{
                        if(feature.get('type')=='line'){
                            //feature.setStyle(transportDict[mode].style(color,true));
                            feature.setStyle(transportDict[mode].style('white',true));
                        }
                        else{
                            feature.setStyle(transportDict[mode].style('white'));
                        }
                    });
                }
                else{
                    //hovered.setStyle(transportDict[mode].style(color,true));
                    hovered.setStyle(transportDict[mode].style('white',true));
                }
                const lineName = line.name;
            }
            return true;
        });

        if (hovered) {
            if(hovered.get('mode')){
                const mode = hovered.get('mode');
                const type = hovered.get('type');
                const line = transportDict[mode].lines[hovered.get('line_id')];
                const lineName = line.name;
                //console.log(lineName)
            }
            //status.innerHTML = selected.get('ECO_NAME');
        } else {
            //status.innerHTML = '&nbsp;';
        }
    });
});

