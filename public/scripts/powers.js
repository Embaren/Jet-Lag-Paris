import {loadSVGElement, rgba} from "/scripts/utils.js";

class Power{
	constructor(powerData,config,onExpire=null){
		Object.assign(this,powerData);
		this.config=config[this.powerId];
		
		const self = this;
		this.endFn = onExpire;
		
		if(this.endDate && (this.endDate>Date.now())){
			setTimeout(()=>{
				self.deactivate();
			},this.endDate-Date.now());
		}
	}
	
	onEnding(onEnding){
		const self = this;
		if(this.endDate && (this.endDate>Date.now())){
			setTimeout(()=>{
				if(self.active){
					onEnding(self);
				}
			},this.endDate-Date.now());
		}
	}
	
	toJSON(){
		return {
			powerId: this.powerId,
			source: this.source,
			target: this.target,
			initDate: this.initDate,
			endDate: this.endDate,
			active: this.active,
		};
	}
	
	deactivate(){
		const self = this;
		if(self.active){
			self.active = false;
			if(self.endFn){self.endFn(self);}
		}
	}
}

export class Powers extends Array{
	constructor(config,list=[]){
		super(...list);
		this.config=config;
		this.tokens={};
		const self=this;
		const tokenPromises=[];
		Object.keys(config).forEach((k)=>{
			tokenPromises.push(loadSVGElement(config[k].token).then((svg)=>{
				self.tokens[k] = svg;
			}));
		});
		this.tokensReady = Promise.all(tokenPromises);
	}
	
	getToken(powerId){
		const token = this.tokens[powerId].cloneNode(true);
		switch(this.config[powerId].type){
			case "defence":
				token.getElementById('background').style['fill']=rgba(0,0,123);
				break;
			case "curse":
				token.getElementById('background').style['fill']=rgba(128,0,0);
				break;
			case "incident":
				token.getElementById('background').style['fill']=rgba(0,128,0);
				break;
		}
		return token;
	}
	
	completePower(powerId,source){
		this.forEach((p)=>{
			if(p.active && p.powerId==powerId && p.target==source){
				p.deactivate();
			}
		});
	}
	
	pushPower(powerData,onEnding){
		const power = new Power(powerData,this.config,onEnding);
		if(power.active && power.endDate){
			this.forEach((p)=>{
				if(p.active && power.powerId==p.powerId && power.target==p.target){ // Renewal
					p.deactivate();
				}
			});
		}
		if(power.active && power.config.type=='defence' && power.config.target == 'curse'){
			this.forEach((p)=>{
				if(p.active && p.config.type=='curse' && p.powerId==power.target && p.target==power.source){
					p.deactivate();
				}
			});
		}
		if(power.active && power.config.type=='defence' && power.config.target == 'station'){
			this.forEach((p)=>{
				if(p.active && ((p.config.target=='station' && p.target==power.target) || (p.config.target=='platform' && p.target.station==power.target))){
					p.deactivate();
				}
			});
		}
		this.push(power);
	}
	
	fill(data,onEnding){
		const powers = this;
		data.forEach((powerData)=>{
			powers.push(new Power(powerData,powers.config,onEnding));
		});
	}
	
	static fromJSON(config,json){
		const powers = [];
		json.forEach((powerData)=>{
			powers.push(new Power(powerData,config));
		});
		return new Powers(config, powers);
	}
	toJSON(){
		const json = [];
		this.forEach((p)=>{json.push(p.toJSON())});
		return json;
	}
}