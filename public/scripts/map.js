import {rgba} from '/scripts/utils.js'

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

class VisibilityControl extends ol.control.Control {
  constructor(layerCollection) {

    const visibilityDiv = document.createElement('div');
    visibilityDiv.appendChild(document.createTextNode("VISIBILITE"));
    visibilityDiv.className = 'ol-unselectable ol-control ol-visibility';

    super({
        element: visibilityDiv,
    });

    layerCollection.on('add',(e)=>{
        const layer = e.element;
        const name = layer.name ? layer.name : "layer";
        const button = document.createElement('button');
        button.className = 'ol-unselectable';
        button.innerHTML = name;
        visibilityDiv.appendChild(button);
        button.addEventListener('click', ()=>{
            const isVisible = layer.getVisible();
            if(isVisible){
                button.classList.add('ol-control-unabled');
            }
            else{
                button.classList.remove('ol-control-unabled');
            }
            layer.setVisible(!isVisible)}
        );
        
    });
  }
}

class Infobox extends ol.control.Control {
  constructor() {
    const infoDiv = document.createElement('div');
    infoDiv.className = 'ol-unselectable ol-control ol-infobox';

    super({
        element: infoDiv,
    });
    
    this.infoDiv = infoDiv;
  }
  
  clear(){
      this.infoDiv.innerHTML="";
  }
  
  setContent(content){
      this.clear();
      this.infoDiv.appendChild(content);
  }
  
  setColor(color){
      this.infoDiv.style['backgroundColor']=color;
  }
}

export class Map{
    constructor(containerID,gameConfig,zoomLevel,clipFeature,library){     
        this.gameConfig = gameConfig;
        this.library = library;
    
        // Background layer
        this.bgLayer = new ol.layer.Tile({
            source: new ol.source.OSM(),
        });
        
        // Sectors layer
        this.sectorsLayer = new ol.layer.Vector({
            source: new ol.source.Vector({wrapX: false}),
        });
        const extent = this.gameConfig.terrain.extent;
        const sectorsSource = this.sectorsLayer.getSource();
        const clipDims = [extent[2]-extent[0],extent[3]-extent[1]];
        const arcLength = 2*Math.PI/gameConfig.teams.length;
        for (let i = 0 ; i<gameConfig.teams.length ; i++){
            const sectorFeature = getSectorFeature(gameConfig.terrain.gameCenter,Math.max(...clipDims),arcLength,i*arcLength+gameConfig.terrain.phaseAngle,gameConfig.terrain.neutralRadius,gameConfig.teams[i].color);
            sectorsSource.addFeature(sectorFeature);
        }
    
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
        const visibilityControls = new VisibilityControl(this.contentLayers);
        this.infobox = new Infobox();
        
        // Init map
        this.map = new ol.Map({
            target: containerID,
            controls: ol.control.defaults.defaults().extend([visibilityControls, this.infobox]),
            layers: [this.bgLayer,this.sectorsLayer,...this.contentLayers.getArray(),this.clipLayer],
            view: new ol.View({
                projection: 'EPSG:3857',
                center:gameConfig.terrain.gameCenter,
                zoom:13,
            }),
        });
        
        // Init overlay
        this._initClickPopup();
        this._initHover();
        
        this.hovered = null;
        this.selected = null;
    }
    
    _initClickPopup(){
        const overlayDiv = document.createElement("div");
        const popup = new ol.Overlay({
            element: overlayDiv,
        });
        this.map.addOverlay(popup);
        const self = this;
        
        this.map.on('click', function (e) {
            
            const coord = e.coordinate;
            const popupElement = popup.getElement();
            popup.setPosition(coord);
            let popover = bootstrap.Popover.getInstance(popupElement);
            if (popover) {
                popover.dispose();
            }
            
            // Clear selected
            if (self.selected !== null) {
                const type = self.selected.get('type');
                switch(type){
                case "line":{
                    const mode = self.selected.get('mode');
                    const line = self.library.transports[mode].lines[self.selected.get('line_id')];
                    const color = line.color;
                    line.features.forEach((feature)=>{
                        if(feature.get('type')=='line'){
                            feature.setStyle(self.library.transports[mode].style(color));
                        }
                        else if(feature.get('type')=='station'){
                            feature.setStyle(self.library.transports[mode].style(color));
                        }
                    });
                    break;
                }
                case "station":{
                    const mode = self.selected.get('mode');
                    const line = self.library.transports[mode].lines[self.selected.get('line_id')];
                    const color = line.color;
                    self.selected.setStyle(self.library.transports[mode].style(color));
                    break;
                }
                case "address":{
                    self.selected.setStyle(self.library.addresses.style('black',false));
                    break;
                }
                }
                self.selected=null;
            }
            
            // Update selected
            self.map.forEachFeatureAtPixel(e.pixel, function (f) {
                const type = f.get('type');
                
                switch(type){
                case "line":{
                    self.selected = f;
                    const mode = f.get('mode');
                    const line = self.library.transports[mode].lines[f.get('line_id')];
                    line.features.forEach((feature)=>{
                        if(feature.get('type')=='line'){
                            feature.setStyle(self.library.transports[mode].style('white',true));
                        }
                        else{
                            feature.setStyle(self.library.transports[mode].style('white'));
                        }
                    });
                    break;
                }
                case "station":{
                    self.selected = f;
                    const mode = f.get('mode');
                    const line = self.library.transports[mode].lines[f.get('line_id')];
                    f.setStyle(self.library.transports[mode].style('white',true));
                    break;
                }
                case "address":{
                    self.selected = f;
                    f.setStyle(self.library.addresses.style('white',true));
                    break;
                }
                };
                return true;
            });
            
            if(self.selected){ 
                switch(self.selected.get('type')){
                case "line":{
                    const line = self.library.transports[self.selected.get('mode')].lines[self.selected.get('line_id')];
                    popover = new bootstrap.Popover(popupElement, {
                        animation: false,
                        container: popupElement,
                        content: '<p>Vous avez sélectionné une ligne de '+self.selected.get('mode')+'.</p>',
                        html: true,
                        placement: 'top',
                        title: line.name,
                    });
                    popover.show();
                    break;
                }
                case "station":{
                    const line = self.library.transports[self.selected.get('mode')].lines[self.selected.get('line_id')];
                    popover = new bootstrap.Popover(popupElement, {
                        animation: false,
                        container: popupElement,
                        content: '<p>Vous avez sélectionné une station de '+self.selected.get('mode')+'.</p>',
                        html: true,
                        placement: 'top',
                        title: line.name,
                    });
                    popover.show();
                    break;
                }
                case "address":{
                    popover = new bootstrap.Popover(popupElement, {
                        animation: false,
                        container: popupElement,
                        content: "<p>Vous avez sélectionné une adresse de l'équipe "+self.gameConfig.teams[self.selected.get('team')].name+".</p>",
                        html: true,
                        placement: 'top',
                        title: self.selected.get('name'),
                    });
                    popover.show();
                    break;
                }
                }
            }
        });
    }
    
    _initHover(){;
        const self = this;
        
        this.map.on('pointermove', function (e) {
            if(!self.clipGeometry.intersectsCoordinate(self.map.getCoordinateFromPixel(e.pixel))){
                return;
            }
            
            // Clears highlighted
            if (self.highlighted !== null) {
                const highlighted = self.highlighted;
                self.highlighted=null;
                self.infobox.clear();
                
                if(highlighted==self.selected){
                    return;
                }
                
                const type = highlighted.get('type');
                switch(type){
                case "line":{
                    const mode = highlighted.get('mode');
                    const line = self.library.transports[mode].lines[highlighted.get('line_id')];
                    const color = line.color;
                    line.features.forEach((feature)=>{
                        if(feature.get('type')=='line'){
                            feature.setStyle(self.library.transports[mode].style(color));
                        }
                    });
                    break;
                }
                case "station":{
                    const mode = highlighted.get('mode');
                    const line = self.library.transports[mode].lines[highlighted.get('line_id')];
                    const color = (self.selected!=null && self.selected.get('type')!='station' && highlighted.get('line_id')==self.selected.get('line_id')) ? 'white' : line.color;
                    highlighted.setStyle(self.library.transports[mode].style(color));
                    break;
                }
                case "address":{
                    highlighted.setStyle(self.library.addresses.style('black',false));
                    break;
                }
                }
            }
            
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
                    const line = self.library.transports[mode].lines[self.highlighted.get('line_id')];
                    const color = line.color;
                    line.features.forEach((feature)=>{
                        if(feature.get('type')=='line'){
                            feature.setStyle(self.library.transports[mode].style(color,true));
                        }
                        else{
                        }
                    });
                    break;
                }
                case "station":{
                    self.highlighted = f;
                    const mode = self.highlighted.get('mode');
                    const line = self.library.transports[mode].lines[self.highlighted.get('line_id')];
                    const color = line.color;
                    self.highlighted.setStyle(self.library.transports[mode].style(color,true));
                    //highlighted.setStyle(self.library.transports[mode].style('white',true));
                    break;
                }
                case "address":{
                    self.highlighted = f;
                    self.highlighted.setStyle(self.library.addresses.style('black',true));
                    break;
                }
                };
                
                return true;
            });
            
            // Displays highlighted name
            if (self.highlighted) {
                switch(self.highlighted.get('type')){
                case "line":{
                    const mode = self.highlighted.get('mode');
                    const line = self.library.transports[mode].lines[self.highlighted.get('line_id')];
                    const color = line.color;
                    const lineName = line.name;
                    const b = document.createElement("b");
                    b.appendChild(document.createTextNode(lineName));
                    self.infobox.setContent(b);
                    self.infobox.setColor(line.color);
                    break;
                }
                case "station":{
                    const mode = self.highlighted.get('mode');
                    const line = self.library.transports[mode].lines[self.highlighted.get('line_id')];
                    const color = line.color;
                    const lineName = line.name;
                    const stationName = self.highlighted.get('name');
                    const contentDiv = document.createElement("div");
                    const b = document.createElement("b");
                    b.appendChild(document.createTextNode(lineName));
                    contentDiv.appendChild(b);
                    contentDiv.appendChild(document.createElement("br"));
                    contentDiv.appendChild(document.createTextNode(stationName));
                    self.infobox.setContent(contentDiv);
                    self.infobox.setColor(line.color);
                    break;
                }
                case "address":{
                    const contentDiv = document.createElement("div");
                    const b = document.createElement("b");
                    b.appendChild(document.createTextNode(self.highlighted.get("name")));
                    contentDiv.appendChild(b);
                    contentDiv.appendChild(document.createElement("br"));
                    contentDiv.appendChild(document.createTextNode("Contrôlé par "+self.gameConfig.teams[self.highlighted.get('current_owner')].name));
                    self.infobox.setContent(contentDiv);
                    self.infobox.setColor(rgba(...self.highlighted.get('owner_color')));
                    break;
                }
                }
            } else {
            }
        });
    }
    
    updateLayers(){
        this.map.setLayers([this.bgLayer,this.sectorsLayer,...this.contentLayers.getArray(),this.clipLayer]);
    }
    
    _initClipping(){      
        // Update all layers when a new shape is added to the clipping layer
        this.clipLayer.getSource().on('addfeature',()=>{
            const layers = [this.bgLayer,this.sectorsLayer,...this.contentLayers.getArray()];
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
            layer.setExtent(this.gameConfig.terrain.extent);
            layer.on('postrender',this.getPostrenderClipFn());
            layer.postrenderFn = this.getPostrenderClipFn();
        }
    }
    
    addLayer(layer){
        this._setClipping(layer);
        this.contentLayers.push(layer);
        this.updateLayers();
    }
    
    addLayers(layers){
        layers.forEach((layer)=>{
            this._setClipping(layer);
            this.contentLayers.push(layer);
        });
        this.updateLayers();
    }
};