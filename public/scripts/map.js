import {rgba, msToTime, document_createBoldNode} from '/scripts/utils.js'
import {Controls} from '/scripts/map_controls.js'

function getSectorFeature(pos,radius,arc,phase,inner_radius=0,color=[255,0,0]){
    const circleFeature = new ol.Feature({
        geometry: new ol.geom.Circle(pos,radius),
    });
    const innerRatio = inner_radius/radius;
    circleFeature.color = color;
    circleFeature.setStyle(
        new ol.style.Style({
            renderer: (coordinates, state)=>{
                const [[x,y],[x1,y1]] = coordinates;
                const ctx = state.context;
                const dx = x1-x;
                const dy = y1-y;
                const radius = Math.sqrt(dx * dx + dy * dy);
                                    
                ctx.beginPath();
                ctx.arc(x,y,radius,-phase,-(phase+arc),true);
                ctx.arc(x,y,innerRatio*radius,-(phase+arc),-phase,false);
                ctx.fillStyle=rgba(...circleFeature.color,0.2);
                ctx.fill();
            },
        }),
    );
    return circleFeature;
}

export class Map{
    constructor(game,containerID,clipFeature,zoomLevel){
        
        this.game = game
    
        // Background layer
        this.bgLayer = new ol.layer.Tile({
            source: new ol.source.OSM(),
        });
        
        // Sectors layer
        this.sectorsLayer = new ol.layer.Vector({
            source: new ol.source.Vector({wrapX: false}),
        });
        const extent = this.game.config.terrain.extent;
        const sectorsSource = this.sectorsLayer.getSource();
        const clipDims = [extent[2]-extent[0],extent[3]-extent[1]];
        const arcLength = 2*Math.PI/this.game.config.teams.length;
        const terrainConfig = this.game.config.terrain;
        for (let i = 0 ; i<this.game.config.teams.length ; i++){
            const sectorFeature = getSectorFeature(terrainConfig.gameCenter,Math.max(...clipDims),arcLength,i*arcLength+terrainConfig.phaseAngle,terrainConfig.neutralRadius,this.game.config.teams[i].color);
            sectorsSource.addFeature(sectorFeature);
        }
    
        // Content layers collection
        this.clippedContentLayers = new ol.Collection([]);
        
        // Content layers collection
        this.contentLayers = new ol.Collection([]);
        
        // Clip layer
        this.clipLayer = new ol.layer.Vector({
            style:null,
            source: new ol.source.Vector({}),
        });
        // Init clipping
        this._initClipping();
        this.clipLayer.getSource().addFeature(clipFeature);
        this.clipGeometry = clipFeature.getGeometry()
        
        // Controls
		this.controls = new Controls(game,this);
		
        // Init map
        this.map = new ol.Map({
            target: containerID,

            controls: ol.control.defaults.defaults().extend(this.controls.get()),
            layers: [this.bgLayer,this.sectorsLayer,...this.clippedContentLayers.getArray(),...this.contentLayers.getArray(),this.clipLayer],
            view: new ol.View({
                projection: 'EPSG:3857',
                center:game.config.terrain.gameCenter,
                zoom:13,
            }),
        });
        
        // Init overlay
        this._initClickPopup();
        this._initHover();
        
        this.hovered = null;
        this.selected = null;
    }
	
	clearSelected(){
		const self = this;
		
		if(!self.selected){
			return;
		}
		
		const type = self.selected.get('type');
		switch(type){
		case "line":{
			const mode = self.selected.get('mode');
			const line = self.game.library.transports[mode].lines[self.selected.get('line_id')];
			line.features.forEach((feature)=>{
				feature.setStyle(self.game.library.transports[mode].style(feature.get('color'),false,false));
			});
			break;
		}
		case "station":{
			self.game.library.stations[self.selected.get('name')].forEach((f)=>{
				const mode = f.get('mode');
				const color = f.get('line_color');
				f.setStyle(self.game.library.transports[mode].style(false,false));
			});
			break;
		}
		case "address":{
			self.selected.setStyle(self.game.library.addresses.style('black',false));
			break;
		}
		case "player":{
			self.selected.setStyle(self.game.players.states[self.selected.get('playerId')].style());
			break;
		}
		}
		self.selected=null;
		
	}
	
	setSelectedFeature(f){		
		const self = this;
		
		const type = f.get('type');
		
		switch(type){
		case "line":{
			self.selected = f;
			const mode = f.get('mode');
			const line = self.game.library.transports[mode].lines[f.get('line_id')];
			line.features.forEach((feature)=>{
				if(feature.get('type')=='line'){
					feature.setStyle(self.game.library.transports[mode].style(true,true));
				}
				else{
					feature.setStyle(self.game.library.transports[mode].style(false,true));
				}
			});
			break;
		}
		case "station":{
			self.selected = f;
			self.game.library.stations[f.get('name')].forEach((f)=>{
				const mode = f.get('mode');
				const line = self.game.library.transports[mode].lines[f.get('line_id')];
				f.setStyle(self.game.library.transports[mode].style(false,true));
			});
			const mode = f.get('mode');
			const line = self.game.library.transports[mode].lines[f.get('line_id')];
			f.setStyle(self.game.library.transports[mode].style(true,true));
			break;
		}
		case "address":{
			self.selected = f;
			f.setStyle(self.game.library.addresses.style('white',true));
			break;
		}
		case "player":{
			self.selected = f;
			f.setStyle(self.game.players.states[self.selected.get('playerId')].style('white',true));
			break;
		}
		default:{
			return false;
		}
		};
		return true;
	}
	
	displaySelected(popupElement){
		const self = this;
		if(!self.selected){
			return;
		}
		
		switch(self.selected.get('type')){
		case "line":{
			const line = self.game.library.transports[self.selected.get('mode')].lines[self.selected.get('line_id')];
			const ref = {mode:self.selected.get('mode'),line:self.selected.get('line_id')};
			self.controls.transportWindow('line',ref,line.name);
			break;
		}
		case "station":{
			const ref = {mode:self.selected.get('mode'),line:self.selected.get('line_id'),station:self.selected.get('name')};
			self.controls.transportWindow('station',ref,self.selected.get('name'));
			break;
		}
		case "address":{
			self.controls.addressWindow(self.selected);
			break;
		}
		case "player":{
			const playerId = self.selected.get('playerId');
			self.controls.playerWindow(playerId);
			break;
		}
		}
	}
    
    _initClickPopup(){
        const overlayDiv = document.createElement("div");
        const popup = new ol.Overlay({
            element: overlayDiv,
        });
        this.map.addOverlay(popup);
		
        const self = this;
        
        this.map.on('click', function (e) {
			self.controls.clear();
            
            const coord = e.coordinate;
			
            const popupElement = popup.getElement();
            popup.setPosition(coord);
            
			const prevSelected = self.selected;
			self.clearSelected();
			
            // Update selected
            self.map.forEachFeatureAtPixel(e.pixel, function (f) {
				if(f==prevSelected){
					return;
				}
				const success = self.setSelectedFeature(f);
				return success;
            });
            
            self.displaySelected(popupElement);
        });
    }
	
	clearHighlighted(){
		const self = this;
		
		if (!self.highlighted) {
			return;
		}
		
		const highlighted = self.highlighted;
		self.highlighted=null;
		self.controls.infobox.clear();
		
		const type = highlighted.get('type');
		switch(type){
		case "line":{
			const mode = highlighted.get('mode');
			const line = self.game.library.transports[mode].lines[highlighted.get('line_id')];
			line.features.forEach((feature)=>{
				if(feature.get('type')=='line'){
					feature.setStyle(self.game.library.transports[mode].style(false,false));
				}
			});
			break;
		}
		case "station":{
			const mode = highlighted.get('mode');
			const color = (self.selected!=null
							&& (
								   (self.selected.get('type')=='line' && highlighted.get('line_id')==self.selected.get('line_id'))
								|| (self.selected.get('type')=='station' && highlighted.get('name')==self.selected.get('name'))
								)
							) ? 'white' : highlighted.get('line_color');
			const isSelected = self.selected!=null
								&& (
									   (self.selected.get('type')=='line' && highlighted.get('line_id')==self.selected.get('line_id'))
									|| (self.selected.get('type')=='station' && highlighted.get('name')==self.selected.get('name'))
									)
			highlighted.setStyle(self.game.library.transports[mode].style(false,isSelected));
			break;
		}
		case "address":{
			highlighted.setStyle(self.game.library.addresses.style('black',false));
			break;
		}
		case "player":{
			highlighted.setStyle(self.game.players.states[highlighted.get('playerId')].style());
			break;
		}
		}
	}
	
    _initHover(){const self = this;
        
        this.map.on('pointermove', function (e) {
            if(!self.clipGeometry.intersectsCoordinate(self.map.getCoordinateFromPixel(e.pixel))){
                return;
            }
                
			if(self.highlighted && self.highlighted==self.selected){
				self.highlighted = null;
				return;
			}
            
            // Clears highlighted
			self.clearHighlighted();
            
            // Updates highlighted
            self.map.forEachFeatureAtPixel(e.pixel, function (f) {

                if(f==self.selected){
                    self.highlighted=null;
                    return;
                }
                if(self.selected!=null
                   && self.selected.get('type')=='line'
                   && f.get('type')=='line'
                   && f.get('line_id')==self.selected.get('line_id')){
                    self.highlighted=null;
                    return;
                }
                
                const type = f.get('type');
                
                switch(type){
                case "line":{
                    self.highlighted = f;
                    const mode = self.highlighted.get('mode');
                    const line = self.game.library.transports[mode].lines[self.highlighted.get('line_id')];
                    const color = line.color;
                    line.features.forEach((feature)=>{
                        if(feature.get('type')=='line'){
                            feature.setStyle(self.game.library.transports[mode].style(true,false));
                        }
                        else{
                        }
                    });
                    break;
                }
                case "station":{
                    self.highlighted = f;
                    const mode = self.highlighted.get('mode');
                    const line = self.game.library.transports[mode].lines[self.highlighted.get('line_id')];
                    const color = line.color;
                    self.highlighted.setStyle(self.game.library.transports[mode].style(true,false));
                    break;
                }
                case "address":{
                    self.highlighted = f;
                    self.highlighted.setStyle(self.game.library.addresses.style('black',true));
                    break;
                }
                case "player":{
                    self.highlighted = f;
                    self.highlighted.setStyle(self.game.players.states[self.highlighted.get('playerId')].style(null,true));
                    break;
                }
                };
                
                return true;
            });
            
            // Displays highlighted info
            if (self.highlighted) {
                switch(self.highlighted.get('type')){
                case "line":{
                    const mode = self.highlighted.get('mode');
                    const line = self.game.library.transports[mode].lines[self.highlighted.get('line_id')];
                    const color = line.color;
                    const lineName = line.name;
                    const b = document.createElement("b");
                    b.appendChild(document.createTextNode(lineName));
                    self.controls.infobox.setContent(b);
                    self.controls.infobox.setColor(line.color);
                    break;
                }
                case "station":{
                    const mode = self.highlighted.get('mode');
                    const line = self.game.library.transports[mode].lines[self.highlighted.get('line_id')];
                    const color = line.color;
                    const lineName = line.name;
                    const stationName = self.highlighted.get('name');
                    const contentDiv = document.createElement("div");
                    const b = document.createElement("b");
                    b.appendChild(document.createTextNode(lineName));
                    contentDiv.appendChild(b);
                    contentDiv.appendChild(document.createElement("br"));
                    contentDiv.appendChild(document.createTextNode(stationName));
                    self.controls.infobox.setContent(contentDiv);
                    self.controls.infobox.setColor(line.color);
                    break;
                }
                case "address":{
                    const contentDiv = document.createElement("div");
                    const b = document.createElement("b");
                    b.appendChild(document.createTextNode(self.highlighted.get("name")));
                    contentDiv.appendChild(b);
                    contentDiv.appendChild(document.createElement("br"));
                    contentDiv.appendChild(document.createTextNode("Contrôlé par "+self.game.config.teams[self.highlighted.get('current_owner')].name));
                    self.controls.infobox.setContent(contentDiv);
                    self.controls.infobox.setColor(rgba(...self.highlighted.get('owner_color')));
                    break;
                }
                case "player":{
                    const playerId = self.highlighted.get('playerId');
                    const contentDiv = document.createElement("div");
                    const b = document.createElement("b");
                    b.appendChild(document.createTextNode(self.game.config.players[playerId].name));
                    contentDiv.appendChild(b);
                    contentDiv.appendChild(document.createElement("br"));
                    const timeSinceUpdate = Date.now()-self.game.players.states[playerId].loc.timestamp;
                    
                    contentDiv.appendChild(document.createTextNode("Position mise à jour il y a "+msToTime(timeSinceUpdate,'s')));
                    self.controls.infobox.setContent(contentDiv);
                    self.controls.infobox.setColor(rgba(...self.game.config.teams[self.game.config.players[playerId].team].color));
                    break;
                }
                }
            } else {
            }
        });
    }
	
	updatePowers(){
		this.controls.powersList.update();
	};
    
    updateLayers(){
        this.map.setLayers([this.bgLayer,this.sectorsLayer,...this.clippedContentLayers.getArray(),...this.contentLayers.getArray(),this.clipLayer]);
    }
	
	updateTeamInfo(){
		this.controls.teamInfo.update();
	}
    
    _initClipping(){      
        // Update all layers when a new shape is added to the clipping layer
        this.clipLayer.getSource().on('addfeature',()=>{
            const layers = [this.bgLayer,this.sectorsLayer,...this.clippedContentLayers.getArray()];
            layers.forEach((layer)=>{
                this._setClipping(layer);
            });
        });
    }
    
    // Define clipping function
    getPostrenderClipFn(){
        return (e)=>{
            const vectorContext = ol.render.getVectorContext(e);
            e.context.globalCompositeOperation = 'destination-in';
            this.clipLayer.getSource().forEachFeature((feature)=>{
                vectorContext.drawFeature(feature, new ol.style.Style({
                        fill: new ol.style.Fill({color:'black'})
                    }),
                );
            });
            e.context.globalCompositeOperation = 'source-over';
        }
    }
    
    _setClipping(layer){
        if(layer.clip){
            layer.clip(this.getPostrenderClipFn());
        }
        else{
            layer.setExtent(this.game.config.terrain.extent);
            layer.on('postrender',this.getPostrenderClipFn());
            layer.postrenderFn = this.getPostrenderClipFn();
        }
    }
    
    // Add a layer above the mask
    addLayer(layer){
        this.contentLayers.push(layer);
        this.updateLayers();
    }
    
    // Add a layer behind the mask
    addClippedLayer(layer){
        this._setClipping(layer);
        this.clippedContentLayers.push(layer);
        this.updateLayers();
    }
    
    // Add layers above the mask
    addLayers(layers){
        layers.forEach((layer)=>{
            this.contentLayers.push(layer);
        });
        this.updateLayers();
    }
    
    // Add layers behind the mask
    addClippedLayers(layers){
        layers.forEach((layer)=>{
            this._setClipping(layer);
            this.clippedContentLayers.push(layer);
        });
        this.updateLayers();
    }
};