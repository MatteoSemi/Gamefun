import type { GameId } from './types';
/** Original representative card art, rendered locally at device resolution. */
export function preview(canvas:HTMLCanvasElement,id:GameId){
 const dpr=Math.min(devicePixelRatio||1,3);canvas.width=420*dpr;canvas.height=200*dpr;const c=canvas.getContext('2d')!;c.scale(dpr,dpr);c.fillStyle='#0d1428';c.fillRect(0,0,420,200);
 const block=(x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
 if(id==='maze'){
  for(let y=0;y<7;y++)for(let x=0;x<15;x++){if(y%3===0||x%4===0){block(28+x*25,16+y*25,21,21,'#292f67');c.strokeStyle='#6259d9';c.strokeRect(30+x*25,18+y*25,17,17);}else block(36+x*25,24+y*25,3,3,'#ffda79');}
  c.fillStyle='#ffda79';c.beginPath();c.moveTo(180,130);c.arc(180,130,13,.4,Math.PI*2-.4);c.fill();
  for(let i=0;i<2;i++){block(260+i*37,62,20,20,i?'#69f6e1':'#ff6eab');block(264+i*37,58,12,4,i?'#69f6e1':'#ff6eab');block(264+i*37,67,4,5,'#10162c');block(273+i*37,67,4,5,'#10162c');}
 }else if(id==='snake'){
  c.strokeStyle='#1c2940';for(let x=0;x<420;x+=22){c.beginPath();c.moveTo(x,0);c.lineTo(x,200);c.stroke();}for(let y=0;y<200;y+=22){c.beginPath();c.moveTo(0,y);c.lineTo(420,y);c.stroke();}
  const cells=[[4,5],[4,4],[4,3],[5,3],[6,3],[7,3],[8,3],[8,4],[8,5],[9,5],[10,5],[11,5],[11,4],[11,3],[11,2],[12,2]];for(const [x,y] of cells)block(26+x*22,y*22+3,19,19,'#69f6e1');block(26+12*22,47,19,19,'#ffda79');block(305,50,3,4,'#0d1428');block(305,59,3,4,'#0d1428');block(102,140,15,15,'#ff6eab');block(109,135,3,5,'#ffda79');
 }else if(id==='runner'){
  for(let i=0;i<8;i++)block(i*65,70+(i%3)*17,43,95,'#22254a');c.fillStyle='#ff6eab';c.beginPath();c.arc(329,55,27,0,Math.PI*2);c.fill();for(let y=58;y<83;y+=7)block(298,y,64,3,'#0d1428');block(0,164,420,3,'#69f6e1');block(114,119,27,35,'#69f6e1');block(133,100,31,26,'#69f6e1');block(102,123,15,10,'#69f6e1');block(117,153,7,12,'#69f6e1');block(134,153,7,10,'#69f6e1');block(154,106,4,4,'#0d1428');block(284,121,12,43,'#ffda79');block(271,131,14,7,'#ffda79');block(271,124,5,12,'#ffda79');block(296,140,12,7,'#ffda79');block(304,131,5,12,'#ffda79');
 }else if(id==='road'){
  for(let row=0;row<5;row++){block(0,row*40,420,40,row===0?'#123b58':row===4||row===1?'#294f44':'#202439');if(row===2||row===3){for(let x=0;x<420;x+=45)block(x,row*40+38,22,2,'#7d7553');for(let x=40+(row%2)*85;x<420;x+=205){block(x,row*40+6,65,27,row===2?'#ff6eab':'#a49bff');block(x+12,row*40+10,38,18,'#18233b');block(x+44,row*40+10,9,18,'#accadd');}}}
  for(let x=10;x<420;x+=155){block(x,5,105,29,'#916342');block(x+5,8,95,4,'#c38b56');}block(195,164,23,25,'#ffda79');block(192,160,8,7,'#ffda79');block(213,160,8,7,'#ffda79');block(196,163,4,4,'#10243a');block(213,163,4,4,'#10243a');
 }else{
  for(let y=0;y<4;y++)for(let x=0;x<9;x++)if(!(y===3&&x>3&&x<7)){block(25+x*42,19+y*22,37,16,['#ff6eab','#b196ff','#ffda79','#69f6e1'][y]);block(26+x*42,20+y*22,35,3,'#ffffff40');}
  block(159,173,88,8,'#69f6e1');block(269,129,9,9,'#fff4c9');c.strokeStyle='#ffda7955';c.beginPath();c.moveTo(214,167);c.lineTo(268,136);c.stroke();
 }
}
