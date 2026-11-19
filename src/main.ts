import './style.css';
import { puzzles, type Puzzle } from './puzzles.ts';
import { GameController, activePhase, failureVisual, formatTime, keyEdit } from './game.ts';
import { AudioEngine, auditAudio, auditAmbience } from './audio.ts';
import { GameScene } from './scene.ts';
const $ = <T extends HTMLElement = HTMLElement>(id:string) => document.getElementById(id) as T;
const game = new GameController(); const audio = new AudioEngine(game); let world:GameScene; let loaded=false, menu=false, starting=false, previousPhase=''; let lastDOM='';
const input=$<HTMLInputElement>('answer');
game.onEffects = effects => {audio.effects(effects);world?.effects(effects);};
audio.onInterruption = () => pause('Audio was interrupted. Resume to reconnect.');
function pause(reason:string) {if(activePhase(game.state.phase)&&!game.state.paused) {game.dispatch({type:'pause'},reason);render();}}
async function start(muted=false) {
  if(!loaded||starting)return; starting=true;
  try {
    if(muted){audio.muted=true;audio.setVolume(audio.volume);}else await audio.unlock();
    syncMuteUI();$('audio-error').hidden=true;$('muted-start').hidden=true;game.dispatch({type:'start'}); menu=false; $('teacher-menu').hidden=true; $('menu-button').setAttribute('aria-expanded','false'); lastDOM='';world.wake();render();
  } catch(error) {$('audio-error').textContent=String(error);$('audio-error').hidden=false;$('muted-start').hidden=false;}
  finally{starting=false;}
}
async function resume() {try{if(!audio.muted)await audio.unlock();game.dispatch({type:'resume'});world.wake();menu=false;$('teacher-menu').hidden=true;$('menu-button').setAttribute('aria-expanded','false');render();input.focus();}catch{$('pause-reason').textContent='Audio unavailable. Mute using M, then Resume.';}}
function title() {world.wake();game.dispatch({type:'title'});menu=false;$('teacher-menu').hidden=true;$('menu-button').setAttribute('aria-expanded','false');render();}
function toggleMenu() {menu=!menu;if(menu)pause('Teacher controls are open. Close them, then Resume.');$('teacher-menu').hidden=!menu;$('menu-button').setAttribute('aria-expanded',String(menu));if(menu)$('close-menu').focus();else{render();if(game.state.paused)$('resume').focus();}}
function announce(text:string){$('announcement').textContent=text;}
async function fullscreen() {try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{announce('Fullscreen unavailable. Windowed mode remains active.');}restoreAnswerFocus();}
function restoreAnswerFocus(){if(game.state.phase==='playing'&&!game.state.paused&&!menu)input.focus({preventScroll:true});}
function mute(){audio.toggleMute();syncMuteUI();restoreAnswerFocus();}
function syncMuteUI(){$('mute').innerHTML=`♪ <span>${audio.muted?'MUTED':'AUDIO ON'}</span>`;$('mute').setAttribute('aria-label',audio.muted?'Unmute audio':'Mute audio');$('mute').setAttribute('aria-pressed',String(audio.muted));}
$('start').onclick=()=>void start();$('muted-start').onclick=()=>void start(true);$('resume').onclick=()=>void resume();$('pause-button').onclick=()=>game.state.paused?void resume():pause('Resume when the room is ready.');
$('fullscreen').onclick=()=>void fullscreen();$('mute').onclick=mute;$('menu-button').onclick=toggleMenu;$('close-menu').onclick=toggleMenu;
$('reveal').onclick=()=>{game.dispatch({type:'reveal'});render();};
document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b=>b.onclick=()=>b.dataset.action==='title'?title():void start(audio.muted));
$<HTMLInputElement>('volume').oninput=e=>audio.setVolume(Number((e.target as HTMLInputElement).value));
// One answer-input owner. Native editing/paste cannot bypass the full-string grammar.
input.addEventListener('beforeinput',e=>e.preventDefault());
input.addEventListener('paste',e=>{e.preventDefault();if(game.state.phase==='playing'&&!game.state.paused&&!menu){const text=e.clipboardData?.getData('text')??'';game.dispatch({type:'edit',value:text});render();}});
input.addEventListener('input',()=>{input.value=game.state.answer;});
window.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||e.isComposing)return;
  const target=e.target as HTMLElement; const controls=target instanceof HTMLButtonElement || target instanceof HTMLSelectElement || (target instanceof HTMLInputElement && target!==input);
  if(e.code==='Escape'&&menu){toggleMenu();return;}
  if(menu)return;
  if(e.code==='KeyP'&&e.shiftKey&&!e.repeat){e.preventDefault();game.state.paused?void resume():pause('Paused by teacher.');return;}
  if(e.code==='KeyM'&&!e.repeat){mute();return;}
  if(e.code==='KeyF'&&!e.repeat){void fullscreen();return;}
  if(e.code==='KeyT'&&!e.repeat){toggleMenu();return;}
  if(e.code==='KeyR'&&!e.repeat){if(e.shiftKey&&['success','missionFailed','educationalReveal'].includes(game.state.phase))void start(audio.muted);else if(!e.shiftKey&&game.state.phase==='missionFailed')game.dispatch({type:'reveal'});render();return;}
  if(controls)return;
  if(e.key==='Enter'&&!e.repeat&&game.state.phase==='ready'){e.preventDefault();void start();return;}
  if(e.key==='Enter'&&!e.repeat&&game.state.paused){e.preventDefault();void resume();return;}
  game.sample(); if(game.state.paused||game.state.phase!=='playing')return;
  if(e.key==='Enter'){e.preventDefault();if(!e.repeat)game.dispatch({type:'submit'});render();return;}
  const numericKey=/^Numpad[0-9]$/.test(e.code)?e.code.slice(-1):e.code==='NumpadDecimal'?'.':e.key;
  const value=keyEdit(game.state.answer,numericKey,e.repeat);
  if(value!==null){e.preventDefault();game.dispatch({type:'edit',value});render();}
});
const challengeCode = $('challenge-code');
const codeColumns = Math.max(...puzzles.flatMap(puzzle => puzzle.code.split('\n').map(line => line.length)));
challengeCode.style.setProperty('--code-columns', String(codeColumns));

function renderCode(target: HTMLElement, source: string) {
  if (target.textContent === source) return;
  const tokens = source.split(/([A-Za-z]+|\d+(?:\.\d+)?|[(,])/);
  target.replaceChildren(...tokens.filter(Boolean).flatMap(token => {
    if (token === '(' || token === ',') return [document.createTextNode(token), document.createElement('wbr')];
    const className = /^\d/.test(token) ? 'code-number'
      : ['int', 'double', 'Math', 'Console'].includes(token) ? 'code-type'
      : /^[A-Za-z]/.test(token) && token !== 'result' ? 'code-method'
      : '';
    if (!className) return [document.createTextNode(token)];
    const span = document.createElement('span');
    span.className = className;
    span.textContent = token;
    return [span];
  }));
}

function revealPuzzle(puzzle: Puzzle) {
  const card = $('reveal-card');
  if (card.childElementCount) return;
  card.innerHTML = [
    '<div class="eyebrow">DEFUSE THE BOMB // DEBRIEF</div>',
    '<pre class="solution-code"><code id="reveal-code"></code></pre>',
    '<h2 id="reveal-output"></h2>',
    '<p class="reveal-prompt">WHY?</p>',
    '<p class="reveal-note"></p>',
    '<div class="actions"><button id="reveal-rematch">RESTART GAME</button><button id="reveal-title">END GAME</button></div>',
  ].join('');
  renderCode($('reveal-code'), puzzle.code);
  $('reveal-output').textContent = `Code output: ${puzzle.displayAnswer}`;
  card.querySelector('.reveal-note')!.textContent = puzzle.explanation;
  $('reveal-rematch').onclick = () => void start(audio.muted);
  $('reveal-title').onclick = title;
}

function render(){
 const s=game.state, t=game.time(), elapsed=t-s.entered; const playing=['playing','incorrectFeedback'].includes(s.phase);
 const failure=s.phase==='failureTransition'; const terminal=['missionFailed','educationalReveal'].includes(s.phase);
 let black=terminal?1:failure?failureVisual(elapsed).black:s.phase==='intro'?1-Math.max(0,Math.min(1,(elapsed-250)/1150)):0;
 $('blackout').style.opacity=String(black);$('blackout').style.zIndex=s.phase==='intro'?'2':'20';
 $('hud').style.opacity=s.phase==='intro'?String(Math.max(0,Math.min(1,(elapsed-1400)/600))):'1';
 $('failure').style.opacity=failure?String(failureVisual(elapsed).title):'1';
 const signature=[s.runId,s.phase,s.answer,s.paused,formatTime(game.remaining),loaded,menu].join('|');if(signature===lastDOM)return;lastDOM=signature;
 $('loading').hidden=loaded;$('ready').hidden=s.phase!=='ready'||!loaded;
 $('hud').hidden=!(playing||s.phase==='intro'||failure);$('hud').classList.toggle('denied',s.phase==='incorrectFeedback');
 if (!$('hud').hidden) renderCode(challengeCode, s.puzzle.code);
 input.value=s.answer;input.disabled=!playing||s.paused||s.phase==='incorrectFeedback';
 $('feedback').textContent=s.phase==='incorrectFeedback'?'ACCESS DENIED // −10 SECONDS':'';
 $('success').hidden=s.phase!=='success';$('failure').hidden=!(failure||s.phase==='missionFailed');$('failure-actions').hidden=s.phase!=='missionFailed';
 $('pause').hidden=!s.paused;$('pause-reason').textContent='Resume when ready';
 $('pause-button').hidden=!activePhase(s.phase);$('accessible-timer').textContent=`Time remaining: ${formatTime(game.remaining)}`;
 $('reveal-card').hidden=s.phase!=='educationalReveal';
 // The debrief is created only after the teacher reveals it.
 if (s.phase === 'educationalReveal') revealPuzzle(s.puzzle);
 else if ($('reveal-card').childElementCount) $('reveal-card').replaceChildren();
 document.body.classList.toggle('failed',terminal);document.body.classList.toggle('transition',failure);
 if(s.phase!==previousPhase){if(s.phase==='playing'&&!s.paused&&!menu)input.focus({preventScroll:true});if(['success','missionFailed','educationalReveal'].includes(s.phase))announce(s.phase==='success'?'DEVICE DEFUSED':s.phase==='missionFailed'?'MISSION FAILED':`Code output: ${s.puzzle.displayAnswer}. ${s.puzzle.explanation}`);previousPhase=s.phase;}
}
async function load(){
 try{
   world?.dispose();world=new GameScene($<HTMLCanvasElement>('scene'),game,audio);
   await Promise.all([world.load(text=>{$('load-message').textContent=text;}),document.fonts.ready]);world.resize();
   loaded=true;render();world.start(()=>{game.sample();world.update();render();world.scene.render();const s=game.state;if(s.paused||s.phase==='ready'||s.phase==='missionFailed'||s.phase==='educationalReveal'||(s.phase==='success'&&game.time()-s.entered>1200))world.sleep();});
 }catch(error){console.error(error);$('load-message').textContent=`DEVICE LOAD FAILED — ${String(error)}`;$('retry').hidden=false;}
}
$<HTMLCanvasElement>('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();pause('Graphics context lost. Reload to recover.');$('pause-reason').textContent='Graphics context lost. Reload the page to recover.';});
$('retry').onclick=()=>{$('retry').hidden=true;void load();};
window.addEventListener('pagehide',()=>{audio.dispose();world?.dispose();});
// Read-only diagnostics, useful for local rehearsal and browser verification. No test clock or answer override.
Object.defineProperty(window,'counterCode',{value:{snapshot:()=>({...game.state,time:game.time(),remaining:game.remaining}),audio:()=>audio.diagnostics(),audioAudit:auditAudio,ambienceAudit:auditAmbience,scene:()=>world?.stats(),...(location.search.includes('bake-environment')?{bakeEnvironment:async()=>Array.from(new Uint8Array(await world.bakeEnvironment()))}:{}),surface:(x:number,y:number)=>{const p=world.scene.pick(x,y);return {point:p?.pickedPoint?.asArray(),normal:p?.getNormal(true)?.asArray(),mesh:p?.pickedMesh?.name};}},writable:false});
void load();
