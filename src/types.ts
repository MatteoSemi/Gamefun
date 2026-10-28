export type GameId = 'maze' | 'snake' | 'runner' | 'road' | 'breakout';
export type Action = 'up' | 'down' | 'left' | 'right' | 'jump' | 'launch';
export interface Controls { held: ReadonlySet<Action>; pressed: ReadonlySet<Action>; }
export interface Game {
 readonly width: number; readonly height: number;
 score: number; over: boolean; lives?: number; level?: number;
 update(dt: number, input: Controls): void;
 render(ctx: CanvasRenderingContext2D): void;
}
export type GameFactory = (seed: number) => Game;
export function rng(seed: number): () => number { let n=seed>>>0; return ()=>{ n+=0x6D2B79F5; let t=n; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
export const COLORS={bg:'#090e21',wall:'#5751da',cyan:'#69f6e1',pink:'#ff6eab',gold:'#ffda79',muted:'#99a8c7'};
export function backdrop(c:CanvasRenderingContext2D,w:number,h:number){c.fillStyle=COLORS.bg;c.fillRect(0,0,w,h);}
export function label(c:CanvasRenderingContext2D,text:string,x:number,y:number,color=COLORS.gold,size=14){c.fillStyle=color;c.font=`bold ${size}px monospace`;c.textAlign='center';c.fillText(text,x,y);}
