class Power{
	constructor(powerId,powersConfig,source,target,onExpire=null){
		this.powerId = powerId;
		this.config = powersConfig[powerId];
		this.source = source;
		this.target = target;
		this.initDate = Date.now();
		this.endDate = this.config.endingCondition=="duration" ? this.initDate+this.config.duration : null;
		this.dice = this.config.dice ? Math.floor(Math.random() * this.config.dice)+1 : null;
		this.active = true;
		
		const self = this;
		this.onEnding((p)=>{p.deactivate();if(onExpire){onExpire(p);}});
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
			dice: this.dice,
		};
	}
	
	deactivate(){
		this.active = false;
	}
	
	static create(powerId,powersConfig,source,target,onEnding=null){
		const power = new Power(powerId,powersConfig,source,target,onEnding);
		return power;
	}
	
	static fromJSON(json,powersConfig,onEnding=null){
		const power = new Power(json.powerId,powersConfig,json.source,json.target,onEnding);
		Object.assign(power,json);
		return power;
	}
}

class PowerUtils{
	constructor(config){
		this.config = config.powers;
		this.gameConfig = config;
		
	}
	getTeam(playerId){
		if(playerId=='admin'){
			return -1;
		}
		return this.gameConfig.players[playerId].team;
	}
	create(powerId,source,target=null){		
		const onEnding = (power)=>{
			console.log(power.config.name+" ended");
		}
		
		return Power.create(powerId, this.config, source, target, onEnding);
	}
	getCost(powerId){
		return this.config[powerId].cost;
	}
	getTargetType(powerId){
		return this.config[powerId].target;
	}
	getEndingCondition(powerId){
		return this.config[powerId].endingCondition;
	}
	getType(powerId){
		return this.config[powerId].type;
	}
	check(powerId){
		return (powerId in this.config);
	}
}

class Powers extends Array{
	constructor(config,list=[]){
		super(...list);
		this.utils = new PowerUtils(config);
	}
	complete(powerId,target){
		if(!(this.utils.check(powerId))){
			return {status:false, reason:"invalid_id"};
		}
		
		if(this.utils.getEndingCondition(powerId)!='manual'){
			return {status:false, reason:"not_completable"};
		}
		
		const valid = this.filter((p)=>{
			return p.active && p.target==target && p.powerId==p.powerId;
		});
		if(valid.length==0){
			return {status:false, reason:"no_active"};
		}
		valid.forEach((p)=>{
			p.deactivate();
		});
		return {status:true};
	}
	pushPower(powerId,source,target=null){
		if(!this.utils.check(powerId)){
			return {"status":false,"reason":"invalid_id"};
		}
		
		const config = this.utils.config[powerId];
		
		if(config.target!='none' && target==null){
			return {"status":false,"reason":"missing_target"};
		}
		if(config.target=='curse' && source=='admin'){
			return {"status":false,"reason":"admin_curse"};
		}
		if(config.target=='curse' && !(this.utils.check(target) && this.utils.getType(target)=='curse')){
			return {"status":false,"reason":"target_curse"};
		}
		
		const power = this.utils.create(powerId,source,target);
		
		// Renew if already active
		if(power.endDate){
			const n = this.length;
			for(let i = n-1 ; i >= 0 ; i--){
				if(this[i].powerId==powerId && JSON.stringify(this[i].target)==JSON.stringify(target)){
					if(this[i].active){
						console.log(power.config.name+" renewed");
						this[i].deactivate();
					}
					break;
				}
			}
		}
		
		// Deny if already applied
		if(config.target == 'curse'){
			if(this.some((p)=>{
				return p.config.target == 'curse'
				&& p.powerId==powerId
				&& p.source==source
				&& p.target==target
				&& p.active;
			})){
				return {"status":false,"reason":"exists"};
			}
		}
		else{
			if(this.some((p)=>{
				return p.powerId==powerId
				&& JSON.stringify(p.target)==JSON.stringify(target)
				&& p.active
			})){
				return {"status":false,"reason":"exists"};
			}
		}
		
		// Deny if blocked
		if(config.type == 'curse'){
			if(this.some((p)=>{
				return p.config.target == 'curse'
				&& p.config.type == 'defence'
				&& p.source==target
				&& p.target==powerId
				&& p.active;
			})){
				return {"status":false,"reason":"blocked"};
			}
		}
		if(config.target == 'station' || config.target=='platform'){
			const targetStation = config.target == 'station' ? target : target.station;
			if(this.some((p)=>{
				return p.config.target == 'station'
				&& p.config.type == 'defence'
				&& p.target==targetStation
				&& p.active;
			})){
				return {"status":false,"reason":"blocked"};
			}
		}
		
		// Deactivate newly blocked powers
		if(config.type=='defence' && config.target == 'curse'){
			this.forEach((p)=>{
				if(p.active && p.config.type=='curse' && p.target==source && p.powerId==target){
					p.deactivate();
				}
			});
		}
		if(config.type=='defence' && config.target == 'station'){
			this.forEach((p)=>{
				if(p.active && ((p.config.target=='station' && p.target==target) || (p.config.target=='platform' && p.target.station==target))){
					p.deactivate();
				}
			});
		}
				
		this.push(power);
		return {"status":true,"power":power};
	}
	
	getVisiblePowers(playerId){
		if(playerId=='admin'){
			return [...this];
		}
		const powers = this.filter((p) => {
			return p.active;
		});
		/*
		// OPTION: Filter powers by source and target
		const utils = this.utils;
		const team = utils.getTeam(playerId);
		const powers = this.filter((power) => {
			return (power.active && power.config.type=="event")
			|| (power.active && power.config.type=="incident")
			|| (power.source!='admin' && team==utils.getTeam(power.source))
			|| (power.config.target=="player"
				&& team==utils.getTeam(power.target)
			   );
		})
		*/
		return [...powers];
	}
	toJSON(){
		const json = [];
		this.forEach((p)=>{json.push(p.toJSON())});
		return json;
	}
}

module.exports = {Powers};