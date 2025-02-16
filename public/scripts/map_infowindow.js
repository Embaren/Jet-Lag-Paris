import {rgba, msToTime, document_createBoldNode} from '/scripts/utils.js'

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

class ShrinkableCollection extends ol.control.Control {
	constructor(shrinkables,top=true,left=true){
		const wrappingDiv = document.createElement('div');
		wrappingDiv.className = `ol-unselectable ol-control ol-shrinkable-collection ol-control-${top ? 'top' : 'bottom'} ol-control-${left ? 'left' : 'right'}`;
		wrappingDiv.style['flex-direction']=`column${top ? '-reverse' : ''}`;
		super({
			element: wrappingDiv,
		});
		
		for(let i = shrinkables.length-1 ; i >=0 ; i--){
			const s = shrinkables[i];
			s.displayButton.addEventListener('click', ()=>{
				for(let j = 0 ; j < shrinkables.length ; j++){
					if(j==i){
						continue;
					}
					shrinkables[j].hide();
				}
			});
			wrappingDiv.appendChild(s.wrappingDiv);
		}
	}
}

class Shrinkable {
	constructor(title,content,reverse=false){
		const wrappingDiv = document.createElement('div');
		wrappingDiv.className = `ol-shrinkable`;
		wrappingDiv.style['flex-direction']=`column${reverse ? '' : '-reverse'}`;
		
		this.displayed = false;
		
		const self = this;
		this.displayButton = document.createElement("button");
		this.displayButton.appendChild(document.createTextNode(title));
		this.displayButton.classList.add('ol-shrinkable-button');
		this.displayButton.addEventListener('click', ()=>{self.toggle()});
		wrappingDiv.appendChild(this.displayButton);
		
		this.content = content;
		this.contentDiv = document.createElement('div');
		this.contentDiv.classList.add('ol-shrinkable-content');
		this.contentDiv.style['flex-direction'] = `column${reverse ? '':'-reverse'}`;
		this.contentDiv.appendChild(this.content);
		wrappingDiv.appendChild(this.contentDiv);
		
		this.wrappingDiv = wrappingDiv;
		
		this.hide();
	}
	display(){
		this.displayed = true;
		this.displayButton.classList.add('ol-control-unabled');
		this.content.hidden = false;
	}
	hide(){
		this.displayed = false;
		this.displayButton.classList.remove('ol-control-unabled');
		this.content.hidden = true;
	  
	}
	toggle(){
		this.content.hidden = this.displayed;
		if(this.displayed){
			this.displayButton.classList.remove('ol-control-unabled');
		}
		else{
			this.displayButton.classList.add('ol-control-unabled');
		}
		this.displayed = !this.displayed;
	}
}

class ShrinkableControl extends ol.control.Control {
	constructor(title,content,reverse=false){
		const wrappingDiv = document.createElement('div');
		wrappingDiv.className = `ol-unselectable ol-control ol-shrinkable`;
		wrappingDiv.style['flex-direction']=`column${reverse ? '-reverse' : ''}`;
		super({
			element: wrappingDiv,
		});
		
		this.displayed = false;
		
		this.content = content;
		this.content.classList.add('ol-shrinkable-content');
		wrappingDiv.appendChild(this.content);
		
		const self = this;
		this.displayButton = document.createElement("button");
		this.displayButton.appendChild(document.createTextNode(title));
		this.displayButton.classList.add('ol-shrinkable-button');
		this.displayButton.addEventListener('click', ()=>{self.toggle()});
		wrappingDiv.appendChild(this.displayButton);
		
		this.wrappingDiv = wrappingDiv;
		
		this.hide();
	}
	display(){
		this.displayed = true;
		this.displayButton.classList.add('ol-control-unabled');
		this.content.hidden = false;
	}
	hide(){
		this.displayed = false;
		this.displayButton.classList.remove('ol-control-unabled');
		this.content.hidden = true;
	  
	}
	toggle(){
		this.content.hidden = this.displayed;
		if(this.displayed){
			this.displayButton.classList.remove('ol-control-unabled');
		}
		else{
			this.displayButton.classList.add('ol-control-unabled');
		}
		this.displayed = !this.displayed;
	}
}

class VisibilityControl extends Shrinkable {
    constructor(layerCollections) {
        const visibilityDiv = document.createElement('div');
        //visibilityDiv.className = 'ol-unselectable ol-control ol-visibility';
        visibilityDiv.className = 'ol-visibility';

        super('VISIBILITE',visibilityDiv,true);
		
		
		this.wrappingDiv.classList.add('ol-control-top');
		this.wrappingDiv.classList.add('ol-control-right');
        
        layerCollections.forEach((layerCollection)=>{
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
        });
    }
}

class Infobox extends ol.control.Control {
  constructor() {
    const infoDiv = document.createElement('div');
    infoDiv.className = 'ol-unselectable ol-control ol-infobox ol-control-hcenter ol-control-bottom';

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

class TeamInfo extends ol.control.Control {
  constructor(teamConfig, teamState) {
	  
    const infoDiv = document.createElement('div');
    infoDiv.className = 'ol-unselectable ol-control ol-teaminfo ol-control-hcenter ol-control-top';
	infoDiv.style['backgroundColor']=rgba(...teamConfig.color);

    super({
        element: infoDiv,
    });
    
	this.teamState = teamState
	infoDiv.appendChild(document.createTextNode(this.teamState.points));
	
    this.infoDiv = infoDiv;
  }
  
  update(){
	this.infoDiv.innerHTML="";
	this.infoDiv.appendChild(document.createTextNode(this.teamState.points));
  }
}

function getPowerContent(p,game){
	const infoDiv = document.createElement('div');
	const itemInfoSVG = game.powers.getToken(p.powerId);
	switch(p.config.type){
		case "defence":
			itemInfoSVG.getElementById('background').style['fill']=rgba(0,0,128);
			break;
		case "curse":
			itemInfoSVG.getElementById('background').style['fill']=rgba(128,0,0);
			break;
		case "incident":
			itemInfoSVG.getElementById('background').style['fill']=rgba(0,128,0);
			break;
	}
	infoDiv.appendChild(itemInfoSVG);
	const textDiv = document.createElement('div');
	infoDiv.appendChild(textDiv);
	
	// Description
	const descP = document.createElement('p');
	descP.appendChild(document.createTextNode(p.config.description));
	textDiv.appendChild(descP);
	
	// Duration
	if(p.endDate){
		const durationP = document.createElement('p');
		function updateDuration(){
			const duration = p.endDate-Date.now();
			durationP.innerHTML="";
			if(duration>0){
				durationP.appendChild(document.createTextNode(`Durée : ${msToTime(duration,'s')} sur ${msToTime(p.config.duration,'s')}`));
				setTimeout(updateDuration,1000);
				return;
			}
			durationP.appendChild(document.createTextNode(`Durée : terminé !`));
			
		}
		updateDuration();
		textDiv.appendChild(durationP);
	}
	
	// Source
	const sourceP = document.createElement('p');
	sourceP.appendChild(document.createTextNode(`Acheteur : ${p.source=='admin' ? 'admin' : game.config.players[p.source].name}`));
	textDiv.appendChild(sourceP);
	
	// Target
	if(p.target){
		const targetP = document.createElement('p');
		let target = "non défini";
		let targetType = "non défini";
		switch(p.config.target){
			case "player":
				target = `${game.config.players[p.target].name} (joueur)`;
				break;
			case "curse":
				target = `${game.powers.config[p.target].name} (malédiction)`;
				break;
			case "line":
				target = `${game.library.transports[p.target.mode].lines[p.target.line].name} (ligne)`;
				break;
			case "station":
				
				target = `${p.target} (station, impacte les lignes ${game.library.stations[p.target].getArray().reduce((acc,f)=>{acc.push(game.library.transports[f.get('mode')].lines[f.get('line_id')].name);return acc;},[]).join(', ')})`;
				break;
			case "platform":
				target = `${p.target.station} (quais de la station sur la ligne ${game.library.transports[p.target.mode].lines[p.target.line].name})`;
				break;
		}
		targetP.appendChild(document.createTextNode(`Cible : ${target}`));
		textDiv.appendChild(targetP);
	}
	
	// Cost
	const costP = document.createElement('p');
	costP.appendChild(document.createTextNode(`Coût : ${p.config.cost}`));
	textDiv.appendChild(costP);
	
	return infoDiv;
}

function getPowerConfigContent(powerId,game){
	const p = game.powers.config[powerId];
	const infoDiv = document.createElement('div');
	const itemInfoSVG = game.powers.getToken(powerId);
	switch(p.type){
		case "defence":
			itemInfoSVG.getElementById('background').style['fill']=rgba(0,0,128);
			break;
		case "curse":
			itemInfoSVG.getElementById('background').style['fill']=rgba(128,0,0);
			break;
		case "curse":
			itemInfoSVG.getElementById('background').style['fill']=rgba(128,0,0);
			break;
	}
	infoDiv.appendChild(itemInfoSVG);
	const textDiv = document.createElement('div');
	infoDiv.appendChild(textDiv);
	
	// Description
	const descP = document.createElement('p');
	descP.appendChild(document.createTextNode(p.description));
	textDiv.appendChild(descP);
	
	// Duration
	if(p.duration){
		const durationP = document.createElement('p');
		durationP.appendChild(document.createTextNode(`Durée : ${msToTime(p.duration,'s')}`));
		textDiv.appendChild(durationP);
	}
	
	if(p.target!='none'){
		const targetTypeP = document.createElement('p');
		let targetType = "non défini";
		switch(p.target){
			case "player":
				targetType="joueur";
				break;
			case "curse":
				targetType="malédiction";
				break;
			case "line":
				targetType="ligne";
				break;
			case "station":
				targetType="station";
				break;
			case "platform":
				targetType="quai";
				break;
		}
		targetTypeP.appendChild(document.createTextNode(`Cible : ${targetType}`));
		textDiv.appendChild(targetTypeP);
		
	}
	
	const costP = document.createElement('p');
	costP.appendChild(document.createTextNode(`Coût : ${p.cost}`));
	textDiv.appendChild(costP);
	
	return infoDiv;
}

class Radio{
	constructor(container,values,labels,icons=null,onClick=null){
		this.selectedId = null;
		this.values = values;
		const self = this;
		
		this.buttons = [];
		
		const selectDiv = document.createElement('div');
		selectDiv.classList.add('radio');
		
		labels.forEach((label,i)=>{
			const radioButton = document.createElement('button');
			
			if(icons && icons.length>i){
				radioButton.appendChild(icons[i]);
			}

			const textDiv = document.createElement('div');
			textDiv.appendChild(document.createTextNode(label));
			radioButton.appendChild(textDiv);
			
			radioButton.addEventListener('click', ()=>{self.select(i);if(onClick){onClick(self.get())}});
			
			this.buttons.push(radioButton);
			selectDiv.appendChild(radioButton);
		});
		container.appendChild(selectDiv);
	}
	select(i){
		if(i<this.values.length){
			if(this.selectedId!==null){
				this.buttons[this.selectedId].classList.remove('selected');
			}
			this.selectedId = i;
			this.buttons[i].classList.add('selected');
		}
	}
	get(){
	return this.selectedId===null ? null : this.values[this.selectedId];
	}
}

class PowersList extends ol.control.Control {
	constructor(game, utilsWindow) {
		const powersDiv = document.createElement('div');
		powersDiv.className = 'ol-unselectable ol-control ol-powerslist ol-control-left ol-control-bottom';

		super({
			element: powersDiv,
		});
		
		const self = this;
		
		this.game = game;
		this.utilsWindow = utilsWindow;
		
		this.powersDiv = powersDiv;
		this.update()
		
		this.countdownFrequency = 1000;
	}
	_updateCountdown(p,element){
		if(p.active && p.endDate>Date.now()){
			const self = this;
			const duration = p.endDate - p.initDate;
			const remaining = p.endDate - Date.now();
			const ratio = 1-remaining/duration;
			const rad = ratio*2*Math.PI;
			const cos = Math.cos(rad);
			const sin = Math.sin(rad);
			const scale = 1/Math.max(Math.abs(cos),Math.abs(sin));
			const vertices = [[sin*scale,-cos*scale],[0,0],[0,-1]];
			if(ratio<7/8){
				vertices.push([-1,-1]);
			}
			if(ratio<5/8){
				vertices.push([-1,1]);
			}
			if(ratio<3/8){
				vertices.push([1,1]);
			}
			if(ratio<1/8){
				vertices.push([1,-1]);
			}
			
			element.style['clip-path'] = `polygon(${vertices.map((v)=>{return `${Math.round((v[0]+1)*50)}% ${Math.round((v[1]+1)*50)}%`}).join(',')})`
			
			setTimeout(()=>{self._updateCountdown(p,element);},this.countdownFrequency);
		}
	}
	
	update(){
		const self = this;
		
		this.powersDiv.innerHTML = "";
		
		const balances = this.game.powers.filter((p,id)=>{
			return p.active && (p.config.target=="curse" && p.source==this.game.client.playerId);
		});
		
		const items = this.game.powers.filter((p,id)=>{
			return p.active && (p.config.type=="event" || (p.config.target=="player" && p.target==this.game.client.playerId));
		});

		for(const p of balances.concat(items)){
			const itemButton = document.createElement('button');
			
			const itemSVG = this.game.powers.getToken(p.config.target=="curse" ? p.target : p.powerId);
			if(p.config.target=="curse"){
				itemSVG.getElementById('background').style['fill']=rgba(255,255,255);
				switch(p.config.type){
					case "defence":
						itemSVG.getElementById('icon').style['fill']=rgba(0,0,128);
						itemSVG.getElementById('background').style['stroke']=rgba(0,0,128);
						break;
					case "curse":
						itemSVG.getElementById('icon').style['fill']=rgba(128,0,0);
						itemSVG.getElementById('background').style['stroke']=rgba(128,0,0);
						break;
				}
			}
			
			if(p.endDate){
				const itemSVGBg = this.game.powers.getToken(p.powerId);
				itemSVGBg.style['opacity']='25%';
				itemButton.appendChild(itemSVGBg);
				
				this._updateCountdown(p,itemSVG)
			}
			itemButton.appendChild(itemSVG);
			
			itemButton.addEventListener('click', ()=>{

				const infoDiv = document.createElement('div');

				infoDiv.appendChild(getPowerContent(p,self.game));
				
				infoDiv.appendChild(document.createElement('hr'));
				
				const interactDiv = document.createElement('div');
				interactDiv.classList.add('column');
				infoDiv.appendChild(interactDiv);
				// Dice
				if(p.dice){
					const diceDiv = document.createElement('div');
					
					diceDiv.appendChild(document.createTextNode(`Valeur du dé : `));
					
					const diceSpan = document.createElement('span');
					diceSpan.classList.add('dice');
					diceSpan.appendChild(document.createTextNode(p.dice));
					diceDiv.appendChild(diceSpan);
					
					interactDiv.appendChild(diceDiv);
				}
				// Manual completion
				if(p.config.endingCondition=='manual'){
					const confirmButton = document.createElement('button');
					
					const optionTextDiv = document.createElement('div');
					optionTextDiv.appendChild(document.createTextNode(`Confirmer la complétion`));
					confirmButton.appendChild(optionTextDiv);
					
					confirmButton.addEventListener('click', ()=>{self.game.completePower(p.powerId);self.utilsWindow.hide();});
					interactDiv.appendChild(confirmButton);
				}
				// Buy protection
				if(p.config.type=='curse'){
					const protectButton = document.createElement('button');
			
					const optionSVG = self.game.powers.getToken('balance');

					optionSVG.getElementById('background').style['fill']=rgba(0,0,128);
					optionSVG.style['width']='2.5em';
					optionSVG.style['height']='2.5em';
					protectButton.appendChild(optionSVG);
					
					
					const optionTextDiv = document.createElement('div');
					optionTextDiv.appendChild(document.createTextNode(`${self.game.powers.config['balance'].name} pour ${self.game.powers.config['balance'].cost} points`));
					protectButton.appendChild(optionTextDiv);
					
					protectButton.addEventListener('click', ()=>{self.game.buyPower('balance',p.powerId);self.utilsWindow.hide();});
					
					interactDiv.appendChild(protectButton);
				}
				
				self.utilsWindow.display(infoDiv, p.config.name);
			});

			this.powersDiv.appendChild(itemButton);
		}
	}
}

class Shop extends Shrinkable {
	constructor(game,utilsWindow) {
		const itemsDiv = document.createElement('div');
		itemsDiv.className = 'ol-shop-items';

		super('BOUTIQUE',itemsDiv);
		
		const shop = this;
		
		this.wrappingDiv.classList.add('ol-control-bottom');
		this.wrappingDiv.classList.add('ol-control-right');

		this.game = game;
		this.utilsWindow = utilsWindow;
		
		const items = Object.keys(game.config.powers).filter((k)=>{
			const p = game.config.powers[k];
			return p.target=="none" || (p.type=="defence" && (p.target=="player" || p.target=="curse"));
		});
		
		for(const powerId of items){
			const p = game.config.powers[powerId];
			const itemButton = document.createElement('button');
			
			const optionSVG = game.powers.getToken(powerId);
			itemButton.appendChild(optionSVG);
			
			const itemTextDiv = document.createElement('div');
			itemTextDiv.appendChild(document.createTextNode(p.name));
			itemButton.appendChild(itemTextDiv);
			itemButton.addEventListener('click', ()=>{
				const infoDiv = document.createElement('div');
				infoDiv.appendChild(getPowerConfigContent(powerId,game));
				
				infoDiv.appendChild(document.createElement('hr'));
				
				const interactDiv = document.createElement('div');
				interactDiv.classList.add('column');
				infoDiv.appendChild(interactDiv);
				
				var radio = null;
				if(p.target=='curse'){
					const radioTitle = document.createElement('p');
					radioTitle.appendChild(document_createBoldNode('Malédiction ciblée :'));
					interactDiv.appendChild(radioTitle);
					
					const unavailable = game.powers.reduce((acc,value)=>{if(value.active && value.config.target=='curse' && value.source==game.client.playerId){acc.push(value.target)};return acc;},[]);
					const values = Object.keys(game.config.powers).filter((k)=>{return game.config.powers[k].type=='curse' && !unavailable.includes(k)});
					const labels = [];
					const icons = [];
					values.forEach((k)=>{
						labels.push(game.powers.config[k].name);
						
						const curseSVG = game.powers.getToken(k);
						icons.push(curseSVG);
					});
					radio = new Radio(interactDiv,values,labels,icons);
					interactDiv.appendChild(document.createElement('hr'));
				}
				
				// Buy
				const buyButton = document.createElement('button');
				buyButton.appendChild(document.createTextNode(`Acheter pour ${p.cost} points`));
				switch(p.target){
					case 'none':
						buyButton.addEventListener('click', ()=>{game.buyPower(powerId);shop.utilsWindow.hide();shop.hide();});
					break;
					case 'player':
						buyButton.addEventListener('click', ()=>{game.buyPower(powerId,game.client.playerId);shop.utilsWindow.hide();shop.hide();});
					break;
					case 'curse':
						buyButton.addEventListener('click', ()=>{const selection = radio.get(); if(selection){game.buyPower(powerId,selection);shop.utilsWindow.hide();shop.hide();}});
					break;
				}
				interactDiv.appendChild(buyButton);
				
				// Cancel
				const cancelButton = document.createElement('button');
				cancelButton.appendChild(document.createTextNode(`Annuler`));
				cancelButton.addEventListener('click', ()=>{shop.utilsWindow.hide();});
				interactDiv.appendChild(cancelButton);
				
				shop.utilsWindow.display(infoDiv, p.name);
			});
			itemsDiv.appendChild(itemButton);
		}
  }
}

class PlayersControl extends Shrinkable {
	
	constructor(game,utilsWindow) {
		const contentDiv = document.createElement('div');
		contentDiv.className = 'ol-players';

		super('JOUEURS',contentDiv);
		
		const self = this;
		
		this.wrappingDiv.classList.add('ol-control-bottom');
		this.wrappingDiv.classList.add('ol-control-right');
	}
	
}

class UtilsWindow extends ol.control.Control{
	constructor(){
		const popupDiv = document.createElement('div');
		popupDiv.className = 'ol-unselectable ol-control ol-utilswindow';
		
		super({
			element: popupDiv,
		});
		
		const titleDiv = document.createElement('div');
		titleDiv.className = 'ol-utilswindow-title';
		popupDiv.appendChild(titleDiv);
		const contentDiv = document.createElement('div');
		contentDiv.className = 'ol-utilswindow-content';
		popupDiv.appendChild(contentDiv);
		
		this.popupDiv = popupDiv;
		this.titleDiv = titleDiv;
		this.contentDiv = contentDiv;
		//contentDiv.className = 'ol-unselectable ol-control';
		this.hide();
	}
  
  display(content=null,title=null){
	  if(content){
		  this.set(content,title);
	  }
	  this.displayed = true;
	  this.popupDiv.hidden = false;
  }
  hide(){
	  this.displayed = false;
	  this.popupDiv.hidden = true;
	  
  }
  toggle(){
	  this.popupDiv.hidden = this.displayed;
	  this.displayed = !this.displayed;
  }
  
  set(content,title=null){
	  this.titleDiv.innerHTML="";
	  if(title){
		  this.titleDiv.appendChild(document_createBoldNode(title));
	  }
	  this.contentDiv.innerHTML="";
	  this.contentDiv.appendChild(content);
  }
}

function displayTransportWindow(type,ref,name,game,utilsWindow,teamId=-1){
	
	const line = game.library.transports[ref.mode].lines[ref.line];
	const contentDiv = document.createElement('div');
	const infoDiv = document.createElement('div');
	contentDiv.appendChild(infoDiv);
	if(type=='line'){
		const modeP = document.createElement('p');
		modeP.appendChild(document.createTextNode(`Réseau : ${ref.mode}`));
		infoDiv.appendChild(modeP);
	}
	if(type=='station'){
		const teamP = document.createElement('p');
		teamP.appendChild(document.createTextNode(`Station ${teamId==-1 ? 'NEUTRE' : game.config.teams[teamId].name}`));
		infoDiv.appendChild(teamP);
		
		const linesP = document.createElement('p');
		const lines = [];
		game.library.stations[ref.station].forEach((f)=>{
			lines.push(game.library.transports[f.get('mode')].lines[f.get('line_id')].name);
		});
		
		linesP.appendChild(document.createTextNode(`Lignes : ${lines.join(', ')}`));
		infoDiv.appendChild(linesP);
		
		const lineP = document.createElement('p');
		lineP.appendChild(document.createTextNode(`Ligne sélectionnée : ${line.name}`));
		infoDiv.appendChild(lineP);
	}
	
	const interactDiv = document.createElement('div');
	interactDiv.classList.add('column');
	contentDiv.appendChild(interactDiv);
	
	const activePowers = game.powers.filter((p)=>{
		if(!p.active){
			return false;
		}
		if(type=='line' && p.config.target=='line'){
			return ref.mode==p.target.mode && ref.line==p.target.line;
		}
		if(type=='station'){
			switch(p.config.target){
				case 'station':
					return ref.station==p.target;
				case 'platform':
					return ref.mode==p.target.mode && ref.line==p.target.line && ref.station==p.target.station;
				case 'line':
					return ref.mode==p.target.mode && ref.line==p.target.line;
			}
		}
		return false;
	});
	
	// Active powers
	{
		interactDiv.appendChild(document.createElement('hr'));
		
		const radioTitle = document.createElement('p');
		radioTitle.appendChild(document_createBoldNode('Pouvoirs actifs :'));
		interactDiv.appendChild(radioTitle);

		const values = [];
		const labels = [];
		const icons = [];
		activePowers.forEach((p)=>{			
			labels.push(p.config.name);
			
			const token = game.powers.getToken(p.powerId);
			icons.push(token);
		});
		const radioOnClick = (p)=>{
			const infoDiv = document.createElement('div');
			infoDiv.appendChild(getPowerContent(p,game));
			
			infoDiv.appendChild(document.createElement('hr'));
			
			const interactionDiv = document.createElement('div');
			infoDiv.appendChild(interactionDiv);
			
			// Cancel
			const cancelButton = document.createElement('button');
			cancelButton.appendChild(document.createTextNode(`Retour`));
			cancelButton.addEventListener('click', ()=>{displayTransportWindow(type,ref,name,game,utilsWindow,teamId);});
			interactionDiv.appendChild(cancelButton);
			
			utilsWindow.display(infoDiv, p.name);
		}
		const radio = new Radio(interactDiv,activePowers,labels,icons,radioOnClick);
	}
	
	// Available powers
	{
		interactDiv.appendChild(document.createElement('hr'));
		
		const unavailable = activePowers.reduce((acc,value)=>{acc.push(value.powerId);return acc;},[]);
		const items = Object.keys(game.config.powers).filter((k)=>{
			const p = game.config.powers[k];
			
			if(type=='line' && p.target=="line"){
				return !unavailable.includes(k);
			}
			
			if(type=='station' && (p.target=="station" || p.target=="platform")){
				if(p.type=='incident' && teamId!=game.client.teamId){
					return false;
				}
				return !unavailable.includes(k);
			}
			
			return false;
		});
		
		const radioTitle = document.createElement('p');
		radioTitle.appendChild(document_createBoldNode('Boutique :'));
		interactDiv.appendChild(radioTitle);

		const labels = [];
		const icons = [];
		items.forEach((k)=>{
			labels.push(game.powers.config[k].name);
			
			const token = game.powers.getToken(k);
			icons.push(token);
		});
		const radioOnClick = (powerId)=>{
			const p = game.powers.config[powerId];
			
			const infoDiv = document.createElement('div');
			infoDiv.appendChild(getPowerConfigContent(powerId,game));
			
			infoDiv.appendChild(document.createElement('hr'));
			
			const interactionDiv = document.createElement('div');
			infoDiv.appendChild(interactionDiv);
			
			// Buy
			const buyButton = document.createElement('button');
			buyButton.appendChild(document.createTextNode(`Acheter pour ${p.cost} points`));
			buyButton.addEventListener('click', ()=>{game.buyPower(powerId,p.target=='station' ? ref.station : ref);utilsWindow.hide();});
			interactionDiv.appendChild(buyButton);
			
			// Cancel
			const cancelButton = document.createElement('button');
			cancelButton.appendChild(document.createTextNode(`Retour`));
			cancelButton.addEventListener('click', ()=>{displayTransportWindow(type,ref,name,game,utilsWindow,teamId);});
			interactionDiv.appendChild(cancelButton);
			
			utilsWindow.display(infoDiv, p.name);
		}
		const radio = new Radio(interactDiv,items,labels,icons,radioOnClick);
	}
	
	return utilsWindow.display(contentDiv,name);
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
        const visibilityControls = new VisibilityControl([this.clippedContentLayers,this.contentLayers]);
        this.infobox = new Infobox();
		this.teamInfo = new TeamInfo(game.client.teamConfig, game.state.teams[game.client.teamId]);
		this.utilsWindow = new UtilsWindow();
		this.powersList = new PowersList(game,this.utilsWindow);
		//this.shop = new Shop(game,this.utilsWindow);
		this.playersControls = new PlayersControl(game,this.utilsWindow)
		this.shop = new Shop(game,this.utilsWindow);
        
		const topRightControls = new ShrinkableCollection([visibilityControls],true,false);
		const bottomRightControls = new ShrinkableCollection([this.shop,this.playersControls],false,false);
		
        // Init map
        this.map = new ol.Map({
            target: containerID,
            controls: ol.control.defaults.defaults().extend([this.infobox, topRightControls, this.teamInfo, this.powersList, bottomRightControls, this.utilsWindow]),
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
    
    _initClickPopup(){
        const overlayDiv = document.createElement("div");
        const popup = new ol.Overlay({
            element: overlayDiv,
        });
        this.map.addOverlay(popup);
        const self = this;
        
        this.map.on('click', function (e) {
			
			self.shop.hide();
			self.utilsWindow.hide();
            
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
                    const line = self.game.library.transports[mode].lines[self.selected.get('line_id')];
                    //const color = self.game.powers.some((p)=>{return p.active && p.config.target=='line' && p.powerId=='strike' && p.target.mode==mode && p.target.line==line}) ? 'black' : line.color;
                    line.features.forEach((feature)=>{
						feature.setStyle(self.game.library.transports[mode].style(feature.get('color'),false,false));
						//feature.setStyle(self.game.library.transports[mode].style(color));
                    });
                    break;
                }
                case "station":{
					self.game.library.stations[self.selected.get('name')].forEach((f)=>{
						const mode = f.get('mode');
						//const line = self.game.library.transports[mode].lines[f.get('line_id')];
						const color = f.get('line_color');//line.color;
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
            
            // Update selected
            self.map.forEachFeatureAtPixel(e.pixel, function (f) {
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
                };
                return true;
            });
            
            if(self.selected){ 
                switch(self.selected.get('type')){
                case "line":{
					/*
					const contentDiv = getTransportWindow('line',{mode:self.selected.get('mode'),line:self.selected.get('line_id')},self.game,self.utilsWindow);
                    popover = new bootstrap.Popover(popupElement, {
                        animation: false,
                        container: popupElement,
                        content: contentDiv,
                        html: true,
                        placement: 'top',
                        title: line.name,
                    });
                    popover.show();
					*/
					const line = self.game.library.transports[self.selected.get('mode')].lines[self.selected.get('line_id')];
					const ref = {mode:self.selected.get('mode'),line:self.selected.get('line_id')};
					displayTransportWindow('line',ref,line.name,self.game,self.utilsWindow);
                    break;
                }
                case "station":{
					//const contentDiv = getTransportWindow('station',{mode:self.selected.get('mode'),line:self.selected.get('line_id'),station:self.selected.get('name')},self.game,self.utilsWindow);
                    //const line = self.game.library.transports[self.selected.get('mode')].lines[self.selected.get('line_id')];
                    
					//self.utilsWindow.display(contentDiv, self.selected.get('name'));
					const ref = {mode:self.selected.get('mode'),line:self.selected.get('line_id'),station:self.selected.get('name')};
					displayTransportWindow('station',ref,self.selected.get('name'),self.game,self.utilsWindow,self.selected.get('team'));
					/*
					popover = new bootstrap.Popover(popupElement, {
                        animation: false,
                        container: popupElement,
                        content: contentDiv,
                        html: true,
                        placement: 'top',
                        title: self.selected.get('name'),
                    });
                    popover.show();
					*/
                    break;
                }
                case "address":{
					const team = self.selected.get('team');
					const currentOwner = self.selected.get('current_owner');
					const captured = team != currentOwner;
					const contentDiv = document.createElement("div");
					{
						const p = document.createElement("p");
						contentDiv.appendChild(p);
						const pText = document.createTextNode("Equipe : "+self.game.config.teams[team].name+".");
						p.appendChild(pText);
					}
					if(captured){
						const p = document.createElement("p");
						contentDiv.appendChild(p);
						const pText = document.createTextNode("Capturée par : "+self.game.config.teams[currentOwner].name+".");
						p.appendChild(pText);
					}
					else{
						const p = document.createElement("p");
						contentDiv.appendChild(p);
						const pText = document.createTextNode("Non capturée.");
						p.appendChild(pText);
						
						if(self.game.client.teamId!=team){
							const captureButton = document.createElement("button");
							contentDiv.appendChild(captureButton);
							const captureButtonText = document.createTextNode("CAPTURER");
							captureButton.appendChild(captureButtonText);
							captureButton.onclick = ()=>{
								const addressId = self.game.state.addresses.findIndex((a)=>{return a.properties.name==self.selected.get('name')});
								self.game.capture(addressId);
								popover.dispose();
							};
						}
					}

					popover = new bootstrap.Popover(popupElement, {
                        animation: false,
                        container: popupElement,
                        content: contentDiv,
                        html: true,
                        placement: 'top',
                        title: self.selected.get('name'),
                    });
                    popover.show();
                    break;
                }
                case "player":{
                    const playerId = self.selected.get('playerId');
                    const timeSinceUpdate = Date.now()-self.game.players.states[playerId].loc.timestamp;
                    popover = new bootstrap.Popover(popupElement, {
                        animation: false,
                        container: popupElement,
                        content: "<p>Equipe : "+self.game.config.teams[self.game.config.players[playerId].team].name+"</p><p>Dernière position enregistrée il y a "+msToTime(timeSinceUpdate,"s")+".</p>",
                        html: true,
                        placement: 'top',
                        title: self.game.config.players[playerId].name,
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
                    const line = self.game.library.transports[mode].lines[highlighted.get('line_id')];
                    //const color = line.color;
                    line.features.forEach((feature)=>{
                        if(feature.get('type')=='line'){
                            feature.setStyle(self.game.library.transports[mode].style(false,false));
                        }
                    });
                    break;
                }
                case "station":{
                    const mode = highlighted.get('mode');
                    //const line = self.game.library.transports[mode].lines[highlighted.get('line_id')];
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
                    self.infobox.setContent(b);
                    self.infobox.setColor(line.color);
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
                    contentDiv.appendChild(document.createTextNode("Contrôlé par "+self.game.config.teams[self.highlighted.get('current_owner')].name));
                    self.infobox.setContent(contentDiv);
                    self.infobox.setColor(rgba(...self.highlighted.get('owner_color')));
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
                    self.infobox.setContent(contentDiv);
                    self.infobox.setColor(rgba(...self.game.config.teams[self.game.config.players[playerId].team].color));
                    break;
                }
                }
            } else {
            }
        });
    }
	
	updatePowers(){
		this.powersList.update();
	};
    
    updateLayers(){
        this.map.setLayers([this.bgLayer,this.sectorsLayer,...this.clippedContentLayers.getArray(),...this.contentLayers.getArray(),this.clipLayer]);
    }
	
	updateTeamInfo(){
		this.teamInfo.update();
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