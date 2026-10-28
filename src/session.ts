import { Input } from './input';
import { Records } from './storage';
import type { Game, GameFactory, GameId } from './types';
export type Mode='solo'|'duo';
export type Phase='ready'|'countdown'|'running'|'paused'|'finished';
/** UI-independent session: one fixed-step coordinator, two independent seeded worlds. */
export class Session {
 worlds:Game[]=[];phase:Phase='ready';countdown=3;seed:number;
 private resumePhase:'running'|'countdown'='running';
 constructor(public id:GameId,public mode:Mode,private factory:GameFactory,private input:Input,private records:Records,seed=(Date.now()>>>0)){this.seed=seed;this.reset(false);}
 reset(start=true){this.save();this.input.active=false;this.worlds=Array.from({length:this.mode==='duo'?2:1},()=>this.factory(this.seed));this.countdown=3;this.phase=start?'countdown':'ready';}
 start(){this.countdown=3;this.phase='countdown';this.input.active=false;}
 pause(){if(this.phase==='running'||this.phase==='countdown'){this.resumePhase=this.phase;this.phase='paused';this.input.active=false;this.save();}}
 resume(){if(this.phase==='paused'){this.phase=this.resumePhase;this.input.clear();this.input.active=this.phase==='running';}}
 save(){for(const world of this.worlds)this.records.save(this.id,this.mode,world.score);}
 stop(){this.save();this.input.active=false;this.worlds=[];}
 tick(dt:number){
  if(this.phase==='countdown'){this.countdown-=dt;if(this.countdown<=0){this.phase='running';this.input.active=true;}return;}
  if(this.phase!=='running')return;
  for(let i=0;i<this.worlds.length;i++){const world=this.worlds[i];const controls=this.input.controls(i as 0|1,this.mode,this.id);if(!world.over){const before=world.score;world.update(dt,controls);if(world.score!==before||world.over)this.records.save(this.id,this.mode,world.score);}}
  this.input.endTick();
  if(this.worlds.every(w=>w.over)){this.phase='finished';this.input.active=false;this.save();}
 }
 get result(){if(this.worlds.length===1)return (this.worlds[0] as Game&{won?:boolean}).won?'Board complete!':'Run complete';const [a,b]=this.worlds;return a.score===b.score?'Draw — evenly matched':`Player ${a.score>b.score?1:2} wins`;}
}
