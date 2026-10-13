'use strict';
// Local-only interactions. No tracking, upload endpoint or checkout.
const $ = id => document.getElementById(id);
const chapters = [...document.querySelectorAll('[data-chapter]')];
const scenes = {
  forest: { title:'木漏れ日', number:'01 / FOREST', image:'assets/komorebi-desk.jpg', copy:'葉の間から差し込む光と、鳥の声。' },
  rain: { title:'雨の庭', number:'02 / RAIN', image:'assets/komorebi-rain.jpg', copy:'静かな雨音と、水面に広がる光の波紋。' },
  sky: { title:'故郷の空', number:'03 / HOME', image:'assets/komorebi-space.jpg', copy:'あなたの大切な風景を、遠い場所でもそばに。' }
};
let scene='forest', photoURL=null, photoSequence=0;
let presenting=false, chapterIndex=0, entryHash='', entryScroll=0, toastTimer;
let soundOn=false, audioContext, audioBus, audioNodes=[], birdTimer, soundSequence=0;
function toast(message) { $('toast').textContent=message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('show'),5000); }
function closeMenu() { $('mobile-nav').hidden=true; $('menu-toggle').setAttribute('aria-expanded','false'); }
$('menu-toggle').addEventListener('click',()=>{const open=$('mobile-nav').hidden; $('mobile-nav').hidden=!open; $('menu-toggle').setAttribute('aria-expanded',String(open));});
$('mobile-nav').addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
const rooms={home:['窓がなくても、壁に広がる木漏れ日を。','地下の住まいに木漏れ日の光が広がるコンセプト画像'],space:['長い旅の夜にも、地球のぬくもりを。','宇宙の部屋で地球と自然の光を楽しむコンセプト画像'],washitsu:['小さな部屋にも、自然の気配をそっと。','和室の机にこもれびの種を置いたコンセプト画像']};
document.querySelectorAll('[data-room]').forEach(button=>button.addEventListener('click',()=>{const room=button.dataset.room; document.querySelectorAll('[data-room]').forEach(item=>item.setAttribute('aria-pressed',String(item===button))); $('room-image').src=`assets/komorebi-${room}.jpg`; $('room-image').alt=rooms[room][1]; $('room-description').textContent=rooms[room][0];}));
function updateScene(next) {
  if(!scenes[next])return;
  scene=next;
  document.querySelectorAll('.scene-choice').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scene===scene)));
  $('nature-preview').dataset.scene=scene;
  $('experience').dataset.scene=scene;
  $('nature-image').src=scene==='sky'&&photoURL?photoURL:scenes[scene].image;
  $('nature-image').alt=scene==='sky'&&photoURL?'この画面で選んだ空の写真':`${scenes[scene].title}のコンセプト画像`;
  $('scene-number').textContent=scenes[scene].number; $('preview-title').textContent=scenes[scene].title; $('preview-copy').textContent=scenes[scene].copy;
  $('sky-personalize').hidden=scene!=='sky';
  if(soundOn)startSound();
}
document.querySelectorAll('.scene-choice').forEach(button=>button.addEventListener('click',()=>updateScene(button.dataset.scene)));
$('brightness').addEventListener('input',()=>{$('nature-image').style.filter=`brightness(${$('brightness').value/100})`; $('brightness-value').value=`${$('brightness').value}%`;});
$('volume').addEventListener('input',()=>{$('volume-value').value=`${$('volume').value}%`; if(audioBus)audioBus.gain.setTargetAtTime(Number($('volume').value)/100*0.22,audioContext.currentTime,0.08);});
// Validate local image decoding. Revoke replaced object URLs without transmitting files.
$('sky-photo').addEventListener('change',async()=>{
  const ticket=++photoSequence, file=$('sky-photo').files[0]; if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){$('photo-status').textContent='10 MB以下のJPEG・PNG・WebPを選んでください。'; $('sky-photo').value=''; return;}
  const candidate=URL.createObjectURL(file), image=new Image(); image.src=candidate;
  try{await image.decode(); if(ticket!==photoSequence){URL.revokeObjectURL(candidate);return;} if(photoURL)URL.revokeObjectURL(photoURL); photoURL=candidate; $('reset-photo').hidden=false; $('photo-status').textContent='あなたの風景を表示しています。写真は外部へ送信しません。'; updateScene(scene);}
  catch{URL.revokeObjectURL(candidate); if(ticket===photoSequence)$('photo-status').textContent='この画像を開けませんでした。別の写真を選んでください。';}
});
$('reset-photo').addEventListener('click',()=>{++photoSequence; if(photoURL)URL.revokeObjectURL(photoURL); photoURL=null; $('sky-photo').value=''; $('reset-photo').hidden=true; $('photo-status').textContent='写真はこの画面だけで表示します。外部へ送信しません。'; updateScene(scene);});
// Soft synthesized ambience, initiated only by pressing the sound button.
function disposeSoundNodes(){clearTimeout(birdTimer); audioNodes.forEach(node=>{try{node.stop();}catch{} node.disconnect();}); audioNodes=[];}
function setSoundUI(on){soundOn=on; $('sound-toggle').setAttribute('aria-pressed',String(on)); $('sound-toggle').textContent=on?'音を止める ♫':'音を聴く ♪';}
function stopSound(){++soundSequence; disposeSoundNodes(); if(audioContext&&audioContext.state==='running')audioContext.suspend().catch(()=>{}); setSoundUI(false);}
function chirp(){
  if(!soundOn||scene!=='forest'||document.hidden)return;
  const oscillator=audioContext.createOscillator(), envelope=audioContext.createGain(), now=audioContext.currentTime;
  oscillator.type='sine'; oscillator.frequency.setValueAtTime(1800+Math.random()*700,now); oscillator.frequency.exponentialRampToValueAtTime(3100,now+.09); oscillator.frequency.exponentialRampToValueAtTime(1600,now+.22);
  envelope.gain.setValueAtTime(0,now); envelope.gain.linearRampToValueAtTime(.13,now+.025); envelope.gain.exponentialRampToValueAtTime(.001,now+.25);
  oscillator.connect(envelope).connect(audioBus); oscillator.start(now); oscillator.stop(now+.3); audioNodes.push(oscillator);
  oscillator.onended=()=>{oscillator.disconnect(); envelope.disconnect(); audioNodes=audioNodes.filter(node=>node!==oscillator);};
  birdTimer=setTimeout(chirp,1600+Math.random()*1700);
}
async function startSound(){
  const ticket=++soundSequence;
  try{
    const Audio=window.AudioContext||window.webkitAudioContext; if(!Audio)throw new Error('unsupported');
    if(!audioContext){audioContext=new Audio(); audioBus=audioContext.createGain(); audioBus.connect(audioContext.destination);}
    await audioContext.resume(); if(ticket!==soundSequence)return;
    disposeSoundNodes(); audioBus.gain.setValueAtTime(Number($('volume').value)/100*.22,audioContext.currentTime);
    const noise=audioContext.createBuffer(1,audioContext.sampleRate*3,audioContext.sampleRate), data=noise.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    const source=audioContext.createBufferSource(); source.buffer=noise; source.loop=true;
    const filter=audioContext.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=scene==='rain'?1600:scene==='forest'?500:220;
    const gain=audioContext.createGain(); gain.gain.value=scene==='rain'?.8:.35;
    source.connect(filter).connect(gain).connect(audioBus); source.start(); audioNodes.push(source); source.onended=()=>{filter.disconnect();gain.disconnect();};
    setSoundUI(true); $('audio-status').textContent=`${scenes[scene].title}の合成音を再生中。実際の製品音源ではありません。`; if(scene==='forest')chirp();
  }catch{stopSound(); $('audio-status').textContent='このブラウザーでは音を再生できません。光の体験はそのまま楽しめます。';}
}
$('sound-toggle').addEventListener('click',()=>{if(soundOn){stopSound();$('audio-status').textContent='音を停止しました。光と音は、製品の雰囲気を伝えるコンセプトデモです。';}else startSound();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&soundOn){stopSound();$('audio-status').textContent='画面を離れたため、音を停止しました。';}});
window.addEventListener('pagehide',()=>{stopSound();++photoSequence;if(photoURL)URL.revokeObjectURL(photoURL);photoURL=null;$('sky-photo').value='';$('reset-photo').hidden=true;if(scene==='sky')updateScene('sky');});
// Keep range keys and dialog keys native. Chapters change only on an explicit action.
function showChapter(index,focus=true){
  chapterIndex=Math.max(0,Math.min(chapters.length-1,index)); chapters.forEach((chapter,i)=>chapter.classList.toggle('is-current',i===chapterIndex));
  $('chapter-position').textContent=`${String(chapterIndex+1).padStart(2,'0')} / ${String(chapters.length).padStart(2,'0')}`; $('chapter-label').textContent=chapters[chapterIndex].dataset.chapter;
  $('chapter-prev').disabled=chapterIndex===0; $('chapter-next').disabled=chapterIndex===chapters.length-1;
  if(chapters[chapterIndex].id!=='experience'&&soundOn)stopSound();
  if(focus){window.scrollTo({top:0,behavior:'instant'});chapters[chapterIndex].querySelector('h1,h2').focus({preventScroll:true});}
}
function setPresentation(on){
  if(on===presenting)return; presenting=on; closeMenu();
  if(on){entryScroll=window.scrollY;entryHash=location.hash;const visible=chapters.reduce((best,chapter,i)=>Math.abs(chapter.getBoundingClientRect().top-86)<best.distance?{index:i,distance:Math.abs(chapter.getBoundingClientRect().top-86)}:best,{index:0,distance:Infinity});chapterIndex=visible.index;}
  document.body.classList.toggle('is-presenting',on);$('presentation-controls').hidden=!on;$('present-toggle').setAttribute('aria-pressed',String(on));$('present-toggle').textContent=on?'発表を終了':'発表モード';
  if(on)showChapter(chapterIndex);
  else{stopSound();chapters.forEach(chapter=>chapter.classList.remove('is-current'));if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});history.replaceState(null,'',`${location.pathname}${location.search}${entryHash}`);window.scrollTo({top:entryScroll,behavior:'instant'});$('present-toggle').focus({preventScroll:true});}
}
$('present-toggle').addEventListener('click',()=>setPresentation(!presenting));$('presentation-exit').addEventListener('click',()=>setPresentation(false));$('chapter-prev').addEventListener('click',()=>showChapter(chapterIndex-1));$('chapter-next').addEventListener('click',()=>showChapter(chapterIndex+1));
$('fullscreen-toggle').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('全画面はこのブラウザーでは使えません。発表モードはそのまま使えます。');}});
document.addEventListener('fullscreenchange',()=>{$('fullscreen-toggle').textContent=document.fullscreenElement?'全画面を終了':'全画面';});
document.addEventListener('keydown',event=>{
  if(!presenting||$('support-dialog').open)return;
  if(event.key==='Escape'){setPresentation(false);return;}
  if(event.target.closest('input,textarea,select,button,a,summary,[contenteditable="true"]'))return;
  if(['ArrowRight','PageDown',' '].includes(event.key)){event.preventDefault();showChapter(chapterIndex+1);}
  else if(['ArrowLeft','PageUp'].includes(event.key)){event.preventDefault();showChapter(chapterIndex-1);}
  else if(event.key==='Home'){event.preventDefault();showChapter(0);}else if(event.key==='End'){event.preventDefault();showChapter(chapters.length-1);}
});
document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{if(!presenting)return;const index=chapters.findIndex(chapter=>`#${chapter.id}`===link.getAttribute('href'));if(index>=0){event.preventDefault();showChapter(index);}}));
if('IntersectionObserver'in window){const navObserver=new IntersectionObserver(entries=>{if(presenting)return;entries.forEach(entry=>{if(!entry.isIntersecting)return;document.querySelectorAll('.desktop-nav a').forEach(link=>{if(link.getAttribute('href')===`#${entry.target.id}`)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});});},{rootMargin:'-15% 0px -55% 0px',threshold:0});chapters.forEach(chapter=>navObserver.observe(chapter));}
let selectedPlan='',supportTrigger;
document.querySelectorAll('.support').forEach(button=>button.addEventListener('click',()=>{selectedPlan=button.dataset.plan;supportTrigger=button;$('dialog-title').textContent=selectedPlan;$('dialog-price').textContent=`¥${button.dataset.price}（税込）`;$('support-dialog').returnValue='';$('support-dialog').showModal();}));
$('support-dialog').addEventListener('close',()=>{if($('support-dialog').returnValue==='confirm')toast(`「${selectedPlan}」への応援、ありがとうございます。一緒に、小さな森を育てましょう。`);supportTrigger?.focus({preventScroll:true});});
$('support-dialog').addEventListener('click',event=>{if(event.target!==$('support-dialog'))return;const rect=$('support-dialog').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$('support-dialog').close('cancel');});
