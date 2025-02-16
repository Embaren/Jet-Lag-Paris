class Power{
	constructor(fromId){
		this.fromId = fromId;
		this.ptype = undefined;
		this.pname = undefined;
		this.initDate = Date.now();
		this.active = true;
		this.cost = 0;
	}
	
	toJSON(){
		return {
			ptype: this.ptype,
			pname: this.pname,
			fromId: this.fromId,
			initDate: this.initDate,
			cost: this.cost,
			active: this.active,
		};
	}
	
	deactivate(){
		this.active = false;
	}
	
	static fromJSON(json){
		const power = new Power(undefined);
		Object.assign(power,json);
		return power;
	}
}

// =========
// INCIDENTS
// =========
class PIncident extends Power{
	constructor(fromId, targetType, targetId){
		super(fromId);
		this.ptype = "incident";
		this.targetType = targetType;
		this.targetId = targetId;
	}
	toJSON(){
		return Object.assign(super.toJSON(),{
			targetType: this.targetType,
			targetId: this.targetId,
		});
	}
}
// ======
// EVENTS
// ======
class PEvent extends Power{
	constructor(fromId, duration, onExpire=undefined){
		super(fromId);
		this.ptype = "event";
		this.duration = duration;
		this.endDate = this.initDate+this.duration;
		const self = this;
		if(onExpire){
			setTimeout(()=>{
				if(self.active){
					self.deactivate();
					onExpire(this);
				}
			},this.duration);
		}
	}
	toJSON(){
		return Object.assign(super.toJSON(),{
			duration: this.duration,
			endDate: this.endDate,
		});
	}
}
// ======
// CURSES
// ======
class PCurse extends Power{
	constructor(fromId, targetId, completable=false){
		super(fromId);
		this.ptype = "curse";
		this.completable = completable;
		this.targetId = targetId;
		this.targetType = "player";
	}
	toJSON(){
		return Object.assign(super.toJSON(),{
			targetId: this.targetId,
			completable: this.completable,
			targetType: this.targetType,
		});
	}
}
// ========
// DEFENCES
// ========
class PDefence extends Power{
	constructor(fromId, targetType, targetId){
		super(fromId);
		this.ptype = "defence";
		this.targetType = targetType;
		this.targetId = targetId;
	}
	toJSON(){
		return Object.assign(super.toJSON(),{
			targetType: this.targetType,
			targetId: this.targetId,
		});
	}
}

class PowerUtils{
	constructor(config){
		this.config = config.powers;
		this.gameConfig = config;
		this.initClasses();
		
	}
	initClasses(){
		const config = this.config;
		// =========
		// INCIDENTS
		// =========
		class PCustomIncident extends PIncident{
			constructor(pname, fromId, targetType, targetId){
				super(fromId, targetType, targetId);
				this.pname = pname;
				this.cost = config[pname].cost;
			}
		}
		this.CustomIncident = PCustomIncident;
		// ======
		// EVENTS
		// ======
		// Ceremony
		class PCeremony extends PEvent{
			constructor(fromId, onExpire=undefined){
				super(fromId, config.ceremony.duration, onExpire);
				this.cost = config.ceremony.cost;
				this.pname = "ceremony";
			}
		}
		this.Ceremony = PCeremony;
		// Strike
		class PStrike extends PEvent{
			constructor(fromId, targetId, onExpire=undefined){
				super(fromId, config.strike.duration, onExpire);
				this.cost = config.strike.cost;
				this.pname = "strike";
			}
		}
		this.Strike = PStrike;

		// ======
		// CURSES
		// ======
		class PCustomCurse extends PCurse{
			constructor(pname, fromId, targetId, completable=false){
				super(fromId, targetId, completable);
				this.pname = pname;
				this.cost = config[pname].cost;
			}
		}
		this.CustomCurse = PCustomCurse;

		// ========
		// DEFENCES
		// ========
		class PBalance extends PDefence{
			constructor(fromId, targetId){
				super(fromId, 'curse', targetId);
				this.pname = 'balance';
				this.targetType = 'curse';
				this.cost = config.balance.cost;
			}
			toJSON(){
				return Object.assign(super.toJSON(),{
				});
			}
		}
		this.Balance = PBalance;
		class PInvestment extends PDefence{
			constructor(fromId, targetId){
				super(fromId, 'station', targetId);
				this.pname = 'investment';
				this.cost = config.investment.cost;
			}
			toJSON(){
				return Object.assign(super.toJSON(),{
				});
			}
		}
		this.Investment = PInvestment;
		class PJammer extends PDefence{
			constructor(fromId, onExpire){
				super(fromId, 'player', fromId);
				this.pname = 'jammer';
				this.cost = config.jammer.cost;
				this.duration = config.jammer.durations;
				this.endDate = this.initDate+this.duration;
				
				const self = this;
				if(onExpire){
					setTimeout(()=>{
						if(self.active){
							self.deactivate();
							onExpire(this);
						}
					},this.duration);
				}
			}
			toJSON(){
				return Object.assign(super.toJSON(),{
					duration: this.duration,
					endDate: this.endDate,
				});
			}
		}
		this.Jammer = PJammer;
		class PVibratory extends PDefence{
			constructor(fromId, onExpire){
				super(fromId, 'player', fromId);
				this.pname = 'vibratory';
				this.cost = config.vibratory.costs;
				this.duration = config.vibratory.durations;
				this.endDate = this.initDate+this.duration;
				
				const self = this;
				if(onExpire){
					setTimeout(()=>{
						if(self.active){
							self.deactivate();
							onExpire(this);
						}
					},this.duration);
				}
			}
			toJSON(){
				return Object.assign(super.toJSON(),{
					duration: this.duration,
					endDate: this.endDate,
				});
			}
		}
		this.Vibratory = PVibratory;
	}
	getTeam(playerId){
		return this.gameConfig.players[playerId].team;
	}
	create(pname,fromId,targetId=undefined){
		
		const onExpire = (power)=>{
			console.log(power.pname+" ended");
		}
		
		switch(pname){
			case "athlete":{
				return new this.CustomCurse(pname,fromId,targetId,false);
			}
			break;
			case "balance":{
				return new this.Balance(fromId,targetId);
			}
			break;
			case "ceremony":{
				return new this.Ceremony(fromId, onExpire);
			}
			break;
			case "claustrophobia":{
				return new PCustomCurse(pname,fromId,targetId,false);
			}
			break;
			case "closing":{
				return new this.CustomIncident(pname,fromId,targetId,"station");
			}
			break;
			case "colorblind":{
				return new this.CustomCurse(pname,fromId,targetId,false);
			}
			break;
			case "evacuation":{
				return new this.CustomIncident(pname,fromId,targetId,"platform");
			}
			break;
			case "first":{
				return new this.CustomCurse(pname,fromId,targetId,false);
			}
			break;
			case "gambler":{
				return new this.CustomCurse(pname,fromId,targetId,true);
			}
			break;
			case "investment":{
				return new this.Investment(fromId,targetId);
			}
			break;
			case "jammer":{
				return new this.Jammer(fromId,onExpire);
			}
			break;
			case "photobooth":{
				return new this.CustomCurse(pname,fromId,targetId,false);
			}
			break;
			case "poesy":{
				return new this.CustomCurse(pname,fromId,targetId,false);
			}
			break;
			case "strike":{
				return new this.Strike(fromId,targetId,onExpire);
			}
			break;
			case "vibratory":{
				return new this.Vibratory(fromId,onExpire);
			}
			break;
			default:
				throw new Error(`PowerUtils::new : unknown power '${pname}'`); 
		}
	}
}

class Powers extends Array{
	constructor(config,list=[]){
		super(...list);
		this.utils = new PowerUtils(config);
	}
	pushPower(pname,fromId,targetId=undefined){
		const power = this.utils.create(pname,fromId,targetId);
		
		// Renew if already active
		if(power.duration){
			const n = this.length;
			for(let i = n-1 ; i >= 0 ; i--){
				if(this[i].pname==pname && this[i].targetId==targetId){
					if(this[i].active){
						console.log(pname+" renewed");
						this[i].deactivate();
					}
					break;
				}
			}
		}
		
		// Deny if already applied
		if(power.targetType == 'curse'){
			if(this.some((p)=>{
				(power.targetType == 'curse' && p.pname==pname && p.targetId==targetId && p.active)
				|| (power.ptype == 'incident' && p.pname==pname && p.targetId==targetId && p.active)
			})){
				return false;
			}
		}
		
		this.push(power);
		return true;
	}
	getVisiblePowers(playerId){
		const utils = this.utils;
		const team = utils.getTeam(playerId);
		const powers = this.filter((power) => {
			(power.active && power.ptype=="event")
			|| team==utils.getTeam(power.fromId)
			|| power.ptype=="incident"
			|| (power.targetType=="player"
				&& team==utils.getTeam(power.targetId)
			   );
		});
		return [...powers];
	}
	toJSON(){
		const json = [];
		this.forEach((p)=>{json.push(p.toJSON())});
		return json;
	}
}

module.exports = {Powers};