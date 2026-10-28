import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../src/session';
import { Records } from '../src/storage';
import type { Input } from '../src/input';
import type { Controls, Game } from '../src/types';

const blank: Controls = {held: new Set(), pressed: new Set()};
class StubInput {
  enabled=false; clears=0; ticks=0; calls:number[]=[];
  byPlayer: Controls[]=[blank,blank];
  get active(){return this.enabled;}
  set active(value:boolean){this.enabled=value;if(!value)this.clear();}
  clear(){this.clears++;this.byPlayer=[blank,blank];}
  controls(player:number){this.calls.push(player);return this.byPlayer[player];}
  endTick(){this.ticks++;}
}
class CountingGame implements Game {
 readonly width=10;readonly height=10;score=0;over=false;updates=0;counter=0;
 constructor(public seed:number){}
 update(dt:number,input:Controls){this.updates++;this.counter+=dt;if(input.pressed.has('up'))this.score+=10;}
 render(){}
}
function setup(mode:'solo'|'duo'='duo'){
 const input=new StubInput(),records=new Records(null);
 const session=new Session('snake',mode,seed=>new CountingGame(seed),input as unknown as Input,records,1234);
 return {session,input,records,worlds:session.worlds as CountingGame[]};
}
function run(session:Session){session.start();session.tick(3);assert.equal(session.phase,'running');}

test('session shares countdown, seed and starting state without sharing world objects',()=>{
 const {session,input,worlds}=setup();
 assert.equal(session.phase,'ready');assert.equal(input.active,false);
 assert.equal(worlds.length,2);assert.notEqual(worlds[0],worlds[1]);
 assert.equal(worlds[0].seed,1234);assert.equal(worlds[1].seed,1234);
 session.start();session.tick(2.9);
 assert.equal(session.phase,'countdown');assert.equal(worlds[0].updates,0);assert.equal(worlds[1].updates,0);
 session.tick(.11);assert.equal(session.phase,'running');assert.equal(input.active,true);
 session.tick(1/60);assert.equal(worlds[0].updates,1);assert.equal(worlds[1].updates,1);
});

test('session routes simultaneous controls to independent worlds',()=>{
 const {session,input,worlds}=setup();run(session);
 input.byPlayer=[{held:new Set(['up']),pressed:new Set(['up'])},blank];
 session.tick(1/60);
 assert.equal(worlds[0].score,10);assert.equal(worlds[1].score,0);
 assert.deepEqual(input.calls,[0,1]);assert.equal(input.ticks,1);
});

test('individual elimination freezes that world while survivor keeps playing',()=>{
 const {session,input,worlds}=setup();run(session);
 session.tick(1/60);worlds[0].over=true;
 const firstUpdates=worlds[0].updates,firstCounter=worlds[0].counter;
 input.byPlayer=[blank,{held:new Set(['up']),pressed:new Set(['up'])}];
 session.tick(1/60);session.tick(1/60);
 assert.equal(session.phase,'running');assert.equal(worlds[0].updates,firstUpdates);assert.equal(worlds[0].counter,firstCounter);
 assert.equal(worlds[1].updates,3);assert.equal(worlds[1].score,20);
 worlds[1].over=true;session.tick(1/60);
 assert.equal(session.phase,'finished');assert.equal(input.active,false);assert.equal(session.result,'Player 2 wins');
});

test('results distinguish winners and draws and rematch recreates both worlds',()=>{
 const {session,worlds}=setup();run(session);
 worlds[0].score=80;worlds[1].score=10;worlds.forEach(w=>w.over=true);session.tick(1/60);
 assert.equal(session.result,'Player 1 wins');
 session.reset();assert.equal(session.phase,'countdown');assert.equal(session.countdown,3);
 assert.notEqual(session.worlds[0],worlds[0]);assert.equal(session.worlds[0].score,0);assert.equal(session.worlds[1].over,false);
 assert.equal((session.worlds[0] as CountingGame).seed,(session.worlds[1] as CountingGame).seed);
 session.tick(3);session.worlds.forEach(w=>{w.score=40;w.over=true;});session.tick(1/60);
 assert.equal(session.result,'Draw — evenly matched');
});

test('pause clears held inputs, freezes both worlds, and requires explicit resume',()=>{
 const {session,input,worlds}=setup();run(session);
 input.byPlayer=[{held:new Set(['up']),pressed:new Set(['up'])},blank];
 const clears=input.clears;session.pause();assert.equal(session.phase,'paused');assert.equal(input.active,false);assert(input.clears>clears);
 for(let i=0;i<60;i++)session.tick(1/60);
 assert.equal(worlds[0].updates,0);assert.equal(worlds[1].updates,0);
 session.pause();assert.equal(session.phase,'paused');session.resume();
 assert.equal(session.phase,'running');assert.equal(input.active,true);session.tick(1/60);assert.equal(worlds[0].score,0);
});

test('countdown pause preserves remaining time and resume restarts only the countdown',()=>{
 const {session,input,worlds}=setup();session.start();session.tick(1);session.pause();
 session.tick(5);assert.equal(session.countdown,2);session.resume();assert.equal(session.phase,'countdown');assert.equal(input.active,false);
 session.tick(2);assert.equal(session.phase,'running');assert.equal(worlds[0].updates,0);
});

test('records save promptly and stay monotonic through reset, home and mode separation',()=>{
 const {session,input,worlds,records}=setup();run(session);
 input.byPlayer=[{held:new Set(),pressed:new Set(['up'])},blank];session.tick(1/60);
 assert.equal(records.best('snake','duo'),10);assert.equal(records.best('snake','solo'),0);
 worlds[1].score=90;session.pause();assert.equal(records.best('snake','duo'),90);
 session.reset();session.tick(3);session.tick(1/60);assert.equal(records.best('snake','duo'),90);
 session.worlds[0].score=120;session.stop();assert.equal(records.best('snake','duo'),120);assert.deepEqual(session.worlds,[]);assert.equal(input.active,false);
});

test('solo outcome reports full-board victory and normal run completion separately',()=>{
 const {session}=setup('solo');assert.equal(session.worlds.length,1);assert.equal(session.result,'Run complete');
 (session.worlds[0] as Game&{won:boolean}).won=true;assert.equal(session.result,'Board complete!');
});
