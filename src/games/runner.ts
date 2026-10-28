import { backdrop, COLORS, label, rng, type Controls, type Game } from '../types';
export interface Rect {x:number;y:number;w:number;h:number}
export interface Obstacle extends Rect {kind:'cactus'|'tower'|'bird'}
export const RUNNER_GROUND=356;
export const RUNNER_MAX_SPEED=390;
export function runnerGap(speed:number,random:number){return Math.max(310,speed*1.65)+random*130;}
export function overlaps(a:Rect,b:Rect){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
export class RunnerGame implements Game {
  readonly width=420;readonly height=460;
  score=0;over=false;level=1;distance=0;speed=210;y=RUNNER_GROUND;velocity=0;ducking=false;
  obstacles:Obstacle[]=[];
  private random:()=>number;private untilObstacle=450;private time=0;
  constructor(seed:number){this.random=rng(seed);}
  get grounded(){return this.y>=RUNNER_GROUND;}
  get hitbox():Rect{return {x:75,y:this.y-(this.ducking?22:42)+3,w:25,h:(this.ducking?22:42)-5};}
  private spawn(){
    const value=this.random(),kind:Obstacle['kind']=this.distance>650&&value>.65?'bird':value>.35?'tower':'cactus';
    this.obstacles.push({kind,x:460,y:kind==='bird'?RUNNER_GROUND-49:RUNNER_GROUND-(kind==='tower'?51:34),w:kind==='bird'?35:kind==='tower'?25:31,h:kind==='bird'?22:kind==='tower'?51:34});
    this.untilObstacle=runnerGap(this.speed,this.random())+40;
  }
  update(dt:number,input:Controls){
    if(this.over)return;
    this.time+=dt;
    this.ducking=this.grounded&&input.held.has('down');
    if((input.pressed.has('jump')||input.pressed.has('up'))&&this.grounded&&!this.ducking){this.velocity=-610;}
    if(!this.grounded||this.velocity<0){this.velocity+=1700*dt;this.y+=this.velocity*dt;if(this.y>=RUNNER_GROUND){this.y=RUNNER_GROUND;this.velocity=0;}}
    this.speed=Math.min(RUNNER_MAX_SPEED,210+this.distance*.013);
    const travel=this.speed*dt;this.distance+=travel;this.score=Math.floor(this.distance/10);this.level=1+Math.floor(this.score/200);
    this.untilObstacle-=travel;if(this.untilObstacle<=0)this.spawn();
    for(const o of this.obstacles){o.x-=travel;if(overlaps(this.hitbox,{x:o.x+3,y:o.y+3,w:o.w-6,h:o.h-4})){this.over=true;}}
    this.obstacles=this.obstacles.filter(o=>o.x+o.w>0);
  }
  render(c:CanvasRenderingContext2D){
    backdrop(c,this.width,this.height);
    c.fillStyle='#111933';c.fillRect(0,250,420,106);
    c.fillStyle='#232655';for(let i=0;i<7;i++){const x=((i*79-this.distance*.15)%550+550)%550-70;c.fillRect(x,205-(i%3)*23,42,151+(i%3)*23);c.fillStyle='#4a3b75';c.fillRect(x+8,222-(i%3)*23,6,6);c.fillStyle='#232655';}
    c.fillStyle=COLORS.pink;c.fillRect(327,65,48,48);c.fillStyle=COLORS.bg;c.fillRect(322,83,58,4);c.fillRect(322,94,58,5);c.fillRect(322,104,58,5);
    c.strokeStyle='#343256';c.lineWidth=1;for(let i=0;i<8;i++){c.beginPath();c.moveTo(0,365+i*i*1.6);c.lineTo(420,365+i*i*1.6);c.stroke();}
    for(let i=0;i<10;i++){c.beginPath();c.moveTo(210,356);c.lineTo((i-4)*100,460);c.stroke();}
    c.fillStyle=COLORS.cyan;c.fillRect(0,RUNNER_GROUND,420,3);
    for(const o of this.obstacles){
      c.fillStyle=o.kind==='bird'?COLORS.pink:COLORS.gold;
      if(o.kind==='bird'){c.fillRect(o.x+5,o.y+8,25,11);c.fillRect(o.x+27,o.y+5,8,8);c.fillRect(o.x,o.y+9,8,5);c.fillRect(o.x+12,o.y+(Math.floor(this.time*9)%2?0:14),10,9);c.fillStyle=COLORS.bg;c.fillRect(o.x+29,o.y+7,3,3);}
      else {c.fillRect(o.x+10,o.y,12,o.h);c.fillRect(o.x,o.y+11,10,8);c.fillRect(o.x,o.y+5,6,12);c.fillRect(o.x+20,o.y+19,11,7);c.fillRect(o.x+26,o.y+11,5,12);c.fillStyle='#ab714b';c.fillRect(o.x+14,o.y+4,3,o.h-4);}
    }
    const x=72,y=this.y,h=this.ducking?22:42;c.fillStyle=this.over?COLORS.pink:COLORS.cyan;
    if(this.ducking){c.fillRect(x,y-h+5,35,13);c.fillRect(x+26,y-h,16,13);c.fillRect(x+3,y-5,6,5);c.fillRect(x+24,y-5,6,5);}
    else {c.fillRect(x+8,y-26,22,21);c.fillRect(x+20,y-42,21,19);c.fillRect(x,y-29,11,9);c.fillRect(x+27,y-21,11,5);const stride=this.grounded?Math.floor(this.time*12)%2:0;c.fillRect(x+9,y-8,6,stride?5:8);c.fillRect(x+23,y-8,6,stride?8:5);}
    c.fillStyle=COLORS.bg;c.fillRect(x+(this.ducking?35:34),y-h+4,3,3);
    label(c,'THE NIGHT NEVER STOPS',210,26,COLORS.muted,12);
    label(c,`${Math.round(this.speed)} PX / SEC · ${Math.floor(this.distance)} M`,210,438,COLORS.muted,11);
  }
}
export const createRunner=(seed:number):Game=>new RunnerGame(seed);
