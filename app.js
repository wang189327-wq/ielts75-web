'use strict';
const C=IELTS,$=id=>document.getElementById(id),host=$('content');
const appearanceKey='ielts75-appearance',themes={mist:{label:'清新灰白',page:'#f5f8f8',card:'#ffffff'},cream:{label:'暖米色',page:'#f4eddd',card:'#fffaf0'},green:{label:'浅豆绿',page:'#e7f1e7',card:'#f5faf2'},pink:{label:'柔和粉',page:'#f6e9ed',card:'#fff7f9'}};
let appearance={size:16,theme:'mist'};
try{const saved=JSON.parse(localStorage.getItem(appearanceKey)||'{}');if([14,16,18,20,22].includes(saved.size))appearance.size=saved.size;if(Object.hasOwn(themes,saved.theme))appearance.theme=saved.theme;}catch{}
function applyAppearance(save=false){const theme=themes[appearance.theme],style=document.documentElement.style;style.setProperty('--reading-scale',String(appearance.size/16));style.setProperty('--paper',theme.page);style.setProperty('--card-background',theme.card);if(save)try{localStorage.setItem(appearanceKey,JSON.stringify(appearance));}catch{toast('显示设置保存失败，请检查设备空间。');}}
applyAppearance();
let librarySentence='',libraryQuery='',libraryCard=null;
let historyDate='',historyCard=null;
let storageMode=localStorage.getItem('ielts75-mode')||'',webImportKind='deck';
let state,tab='learn',queue=[],session=null,importKind='deck',toastTimer,reviewOptions={modes:['meaning'],scope:'all',count:20,date:''};
let cloudSavedSignature='',cloudSavedState=null,exitPending=false,cloudDeckCache='';
const cloudMode=()=>storageMode==='cloud'&&!!window.IELTSSync?.config().enabled&&!!window.IELTSSync?.config().token;
const progressSignature=s=>JSON.stringify({learned:s?.learned||{},results:s?.results||[]});
function rememberCloudSaved(s){cloudSavedSignature=progressSignature(s);cloudSavedState=s;}
window.onCloudSyncSaved=s=>rememberCloudSaved(s);
window.hasUnsavedCloudProgress=()=>cloudMode()&&progressSignature(state)!==cloudSavedSignature;
function finishApp(){if(window.AndroidStore?.exitApp)AndroidStore.exitApp();else toast('可以关闭此页面了。');}
window.requestAppExit=(after=finishApp)=>{
 if(exitPending||$('exit-save-dialog'))return;if(window.IELTSSync?.status().running){toast('正在同步，请完成后再退出。');return;}
 if(!window.hasUnsavedCloudProgress()){after();return;}
 const dialog=el('dialog');dialog.id='exit-save-dialog';const text=el('p','','是否保存本次学习记录'),yes=btn('是',async()=>{exitPending=true;yes.disabled=true;leave.disabled=true;try{await window.IELTSSync.sync();if(window.hasUnsavedCloudProgress())throw Error('仍有新增记录未保存，请重试');dialog.close();dialog.remove();after();}catch(e){toast('保存未完成：'+e.message+'。请重试，或选择退出。');}finally{exitPending=false;yes.disabled=false;leave.disabled=false;}},'primary'),leave=btn('退出',()=>{if(cloudSavedState){state=cloudSavedState;session=null;rebuildQueue();}dialog.close();dialog.remove();after();});
 append(dialog,text,append(el('div','actions'),yes,leave));document.body.append(dialog);dialog.addEventListener('cancel',()=>dialog.remove());dialog.showModal();
};
window.addEventListener('beforeunload',e=>{if(window.hasUnsavedCloudProgress()){e.preventDefault();e.returnValue='';}});
const names={meaning:'看词回忆词义',spelling:'中文回忆拼写',cloze:'句子填空',conversion:'词性转换'};
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function btn(text,action,cls=''){const b=el('button',cls,text);b.onclick=action;return b;}
function append(parent,...children){children.filter(x=>x!==null&&x!==undefined).forEach(x=>parent.append(x));return parent;}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4500);}
window.onNativeStatus=t=>toast(t);
function persist(next){try{C.validateState(next);if(cloudMode()){const deckRaw=JSON.stringify(next.deck);if(deckRaw!==cloudDeckCache){if(window.AndroidStore?.saveBook){if(!AndroidStore.saveBook(deckRaw))throw Error('本地图书保存失败');}else if(window.BrowserStore)BrowserStore.put('cloud-book',deckRaw);cloudDeckCache=deckRaw;}state=next;return true;}const raw=JSON.stringify(next);if(window.AndroidStore){if(!AndroidStore.save(raw))throw Error('本地保存失败，请先导出备份并检查手机空间。');}else if(window.BrowserStore){BrowserStore.save(raw);}else localStorage.setItem('ielts75-state-v1',raw);state=next;return true;}catch(e){toast(e.message);return false;}}
function rebuildQueue(){queue=C.learningQueue(state);}
function speak(text,locale){if(window.AndroidStore)AndroidStore.speak(text,locale);else if('speechSynthesis' in window){const u=new SpeechSynthesisUtterance(text);u.lang=locale;u.rate=.85;speechSynthesis.cancel();speechSynthesis.speak(u);}else toast('设备没有可用语音，请检查语音设置。');}
function setTab(t){if(t===tab)return;if(session&&session.index<session.questions.length&&!confirm('本轮复习尚未结束，已提交的结果会保留。离开本轮？'))return;session=null;tab=t;if(t!=='library')libraryCard=null;if(t!=='review'){historyDate='';historyCard=null;}render();window.scrollTo(0,0);}
function render(){for(const name of ['learn','review','library','settings']){$('tab-'+name).classList.toggle('active',tab===name);$('tab-'+name).setAttribute('aria-current',tab===name?'page':'false');}host.replaceChildren();if(!storageMode){renderStorageChoice();return;}if(!state){renderEmptyBook();return;}if(tab==='learn')renderLearn();else if(tab==='library')renderLibrary();else if(tab==='settings')renderSettings();else if(session)renderQuestion();else renderReview();}
function section(title,...nodes){return append(el('section','section'),el('h3','',title),...nodes);}
function richExample(text,word){const p=el('p','example'),i=text.toLowerCase().indexOf(word.toLowerCase());if(i<0){p.textContent=text;return p;}append(p,document.createTextNode(text.slice(0,i)),el('strong','',text.slice(i,i+word.length)),document.createTextNode(text.slice(i+word.length)));return p;}
function sourceText(c){return 'Sentence '+String(c.source.sentence).padStart(2,'0')+' · 原书第'+c.source.printedPage+'页 · 阅读器'+c.source.readerPage+'页';}
function cleanNote(text){return (text||'').replace(/原书兼列[^。\n]*(?:。|$)/g,'').replace(/本卡|此卡/g,'').replace(/原书(另有搭配|同义关联|同根|参考词|记忆提示|联想提示|词根提示|合成词提示|词根联想|同义区|联想)/g,'$1').replace(/[^。\n]*音标[^。\n]*(?:。|$)/g,'').replace(/原书/g,'').replace(/来源|样本卡片/g,'').replace(/；{2,}/g,'；').trim();}
function addSupplement(c,parent){
 const s=c.supplementary||{},text=s.morphology?.text?.trim(),family=s.family||[],note=cleanNote(s.notes),formation=s.wordFormationNote?.trim();
 if(!text&&!family.length&&!note&&!formation)return;
 const details=el('details','vocabulary-extension');details.open=true;append(details,el('summary','','词汇拓展'));const body=el('div','supplement');
 if(text){const block=el('section','extension-section');append(block,el('h3','','词根词缀'));for(const line of text.split('\n'))if(line.trim())append(block,el('p','morphology-text',line));append(body,block);}
 if(family.length){const block=el('section','extension-section');append(block,el('h3','','Word Family'));family.forEach(f=>append(block,el('p','',f.word+'  '+f.pos+'  '+f.meaning)));append(body,block);}
 if(note||formation){const block=el('section','extension-section');append(block,el('h3','','用法与构词补充'));if(note)append(block,el('p','',note));if(formation)append(block,el('p','',formation));append(body,block);}
 append(details,body);append(parent,details);
}
function addSingleCard(c,parent){const card=el('article','card');append(card,el('div','eyebrow','Sentence '+String(c.source.sentence).padStart(2,'0')));append(card,append(el('div','word-row'),el('h2','word',c.word)));
 append(card,append(el('div','audio-row'),btn('▶ 英音',()=>speak(c.word,'en-GB'),'audio'),btn('▶ 美音',()=>speak(c.word,'en-US'),'audio')));
 append(card,section('Chinese Meaning',append(el('p','meaning'),el('span','meaning-pos',c.pos+' '),el('span','meaning-text',c.meaning))),section('English Definition',el('p','',c.definition)),section('Example',richExample(c.example,c.word),el('p','translation',c.exampleZh),btn('▶ 朗读例句',()=>speak(c.example,'en-GB'),'audio')));
 const coll=section('Key Collocations');c.collocations.forEach(x=>append(coll,append(el('div','collocation'),el('span','',x.en),el('span','',x.zh))));append(card,coll);append(parent,card);addSupplement(c,parent);
}
function addCard(c,parent){
 const senses=[c,...(c.additionalSenses||[])];if(senses.length===1){addSingleCard(c,parent);return;}
 const wrap=el('div');append(parent,wrap);const select=el('select');select.setAttribute('aria-label','选择词义和句子');
 senses.forEach((sense,i)=>{const option=el('option','','Sentence '+String(sense.source.sentence).padStart(2,'0')+' · '+sense.pos+' · '+sense.meaning);option.value=String(i);append(select,option);});
 const wanted=tab==='library'?Number(librarySentence):tab==='learn'&&state.learningPlan?.scope==='sentence'?state.learningPlan.sentence:0;const selected=wanted?senses.findIndex(x=>x.source.sentence===wanted):0;select.value=String(Math.max(selected,0));
 const body=el('div');append(wrap,select,body);function update(){body.replaceChildren();addSingleCard(senses[Number(select.value)],body);}select.onchange=update;update();
}
function renderLibrary(){
 if(libraryCard){const c=state.deck.cards.find(x=>x.id===libraryCard);if(c){append(host,btn('‹ 返回单词库',()=>{libraryCard=null;render();window.scrollTo(0,0);},'text-button back-library'));addCard(c,host);return;}libraryCard=null;}
 append(host,el('h1','page-title','单词库'));
 const filter=el('section','library-filter');const input=el('input');input.type='search';input.id='library-search';input.placeholder='输入英文单词搜索';input.value=libraryQuery;input.autocomplete='off';input.setAttribute('aria-label','搜索英文单词');
 const select=el('select');select.id='sentence-filter';select.setAttribute('aria-label','按句子筛选');const all=el('option','','全部句子');all.value='';append(select,all);for(let i=1;i<=100;i++){const count=state.deck.cards.filter(c=>C.sentenceNumbers(c).includes(i)).length;const o=el('option','','Sentence '+String(i).padStart(2,'0')+' · '+count+'词'+(state.deck.cards.filter(c=>C.sentenceNumbers(c).includes(i)).every(c=>state.learned[c.id])&&count?' · 已学完':''));o.value=String(i);append(select,o);}select.value=librarySentence;
 const count=el('p','muted');count.id='library-count';const list=el('div','word-list');list.id='library-list';
 function update(){const query=libraryQuery.trim().toLowerCase();const cards=state.deck.cards.filter(c=>(!librarySentence||C.sentenceNumbers(c).includes(Number(librarySentence)))&&c.word.toLowerCase().includes(query)).sort((a,b)=>a.order-b.order);count.textContent='共 '+state.deck.cards.length+' 个词 · 当前 '+cards.length+' 个';list.replaceChildren();if(!cards.length){append(list,el('p','empty muted','没有匹配的单词'));return;}for(const c of cards){const b=btn(c.word,()=>{libraryCard=c.id;render();window.scrollTo(0,0);},'library-word');b.lang='en';append(list,b);}}
 input.oninput=()=>{libraryQuery=input.value;update();};select.onchange=()=>{librarySentence=select.value;update();};append(filter,input,select);append(host,filter,count,list);update();
}
const collapsedSettings=new Set(['词库资源','学习进度','本地学习记录','基础设置']);
const expandedBookResources=new Set();
function renderBookResources(){
 const panel=append(el('section','panel'),el('h2','','词库资源')),list=el('div','book-resource-list');
 // List-shaped resource UI; the current data model supplies the installed book.
 const books=state?.deck?[state.deck]:[];
 for(const book of books){
  const bookId=String(book.bookId),title=bookId==='124850'?'100个句子记完7000个雅思单词':book.title;
  const item=el('div','book-resource'),detail=el('div','book-resource-details');detail.id='book-resource-'+bookId.replace(/[^a-zA-Z0-9_-]/g,'-');
  const cover=el('span','book-cover'),image=el('img');image.alt=title+'封面';image.width=86;image.height=130;
  if(bookId==='124850'){image.src='covers/book-124850.png';image.onerror=()=>{image.remove();cover.append(el('span','book-cover-fallback',title));};cover.append(image);}else cover.append(el('span','book-cover-fallback',title));
  const open=btn('',()=>{detail.hidden=!detail.hidden;open.setAttribute('aria-expanded',String(!detail.hidden));if(detail.hidden)expandedBookResources.delete(bookId);else expandedBookResources.add(bookId);},'book-resource-open');open.setAttribute('aria-label','查看《'+title+'》');open.setAttribute('aria-controls',detail.id);detail.hidden=!expandedBookResources.has(bookId);open.setAttribute('aria-expanded',String(!detail.hidden));append(open,cover,el('span','book-resource-title',title));
  append(detail,el('p','book-resource-count','已收录 '+book.cards.length+' 张词卡'),btn('学习本书',()=>{if(state.deck.bookId!==book.bookId)return;librarySentence='';libraryQuery='';libraryCard=null;setTab('library');},'primary wide'));
  append(item,open,detail);append(list,item);
 }
 append(panel,list);return panel;
}
function makeSettingsCollapsible(){
 for(const panel of host.querySelectorAll('.panel')){
  if(panel.querySelector(':scope > .settings-card-head'))continue;
  const title=panel.querySelector(':scope > h2');if(!title)continue;
  const key=title.textContent,head=el('div','settings-card-head'),body=el('div','settings-card-body');
  const toggle=btn('',()=>{const closed=!body.hidden;body.hidden=closed;toggle.setAttribute('aria-expanded',String(!closed));toggle.setAttribute('aria-label',(closed?'展开':'收起')+key);panel.classList.toggle('settings-collapsed',closed);if(closed)collapsedSettings.add(key);else collapsedSettings.delete(key);},'settings-card-toggle');
  const icon=el('span','fold-icon','▲');icon.setAttribute('aria-hidden','true');toggle.append(icon);
  const closed=collapsedSettings.has(key);body.hidden=closed;toggle.setAttribute('aria-expanded',String(!closed));toggle.setAttribute('aria-label',(closed?'展开':'收起')+key);panel.classList.toggle('settings-collapsed',closed);
  for(const node of [...panel.childNodes])if(node!==title)body.append(node);
  append(head,title,toggle);panel.replaceChildren(head,body);
 }
}
function renderSettings(){
 append(host,el('h1','page-title','设置'),renderBookResources());
 if(storageMode==='cloud')renderSyncSettings();
 if(!cloudMode()){
  append(host,append(el('section','panel'),el('h2','','本地学习记录'),btn('导出完整备份',exportBackup,'wide primary'),btn('从备份恢复',()=>requestImport('restore'),'wide'),btn('查看自动备份',showBackupHistory,'wide'),el('p','muted','自动保留最近7个有保存记录的日期，每日更新一份；恢复前另留保护副本（最近7次）。自动副本在应用内部，卸载或清除数据会删除。请定期导出到Documents，再复制到电脑或U盘。')));
 }
 append(host,renderAppearanceSettings());
 if(storageMode!=='cloud')append(host,btn('启用云端进度同步',()=>{storageMode='cloud';localStorage.setItem('ielts75-mode','cloud');render();},'wide'));
 makeSettingsCollapsible();
}
function renderStorageChoice(){
 const panel=el('section','panel');append(panel,el('h1','page-title','选择使用方式'),el('p','','书籍与词卡保存在本设备，按你的需要选择进度保存方式。'),btn('仅本地使用 · 无需账号',()=>{storageMode='local';localStorage.setItem('ielts75-mode','local');window.IELTSSync?.disconnect();render();},'primary wide'),btn('云端同步进度 · 多设备共用账号',()=>{storageMode='cloud';localStorage.setItem('ielts75-mode','cloud');tab='settings';render();},'wide'));append(host,panel);
}
function renderEmptyBook(){
 const panel=el('section','panel');append(panel,el('h1','page-title','添加本地图书'),el('p','','网页版不附带书籍内容。请从设备中导入已整理的JSON词库，或导入完整备份。'),el('p','muted','当前不提供OCR，无法直接识别PDF、图片或EPUB。上传只写入本浏览器本地存储，不会把书籍上传到服务器。'),btn('选择JSON词库',()=>requestImport('deck'),'primary wide'),btn('恢复完整备份',()=>requestImport('restore'),'wide'));append(host,panel);if(storageMode==='cloud')renderSyncSettings();else append(host,btn('切换使用方式',()=>{storageMode='';render();},'text-button'));
}
function renderAppearanceSettings(){
 const panel=el('section','panel');append(panel,el('h2','','基础设置'),el('p','muted','字号与背景色仅保存在本机，调整后立即生效。'));
 const size=el('input');size.type='range';size.id='reading-size';size.min='14';size.max='22';size.step='2';size.value=appearance.size;size.setAttribute('aria-label','阅读字号');
 const output=el('output','',appearance.size+' px');output.htmlFor=size.id;size.oninput=()=>{appearance.size=Number(size.value);output.textContent=appearance.size+' px';applyAppearance(true);};
 const colors=el('select');colors.id='reading-theme';colors.setAttribute('aria-label','背景色');for(const [value,theme]of Object.entries(themes)){const option=el('option','',theme.label);option.value=value;colors.append(option);}colors.value=appearance.theme;colors.onchange=()=>{appearance.theme=colors.value;applyAppearance(true);};
 append(panel,append(el('label','appearance-field'),el('span','','字号'),size,output),append(el('label','appearance-field'),el('span','','背景色'),colors));const version=btn('检查版本',async()=>{if(version.disabled)return;version.disabled=true;version.textContent='正在检查…';try{const info=await IELTSUpdate.check();if(!info.hasUpdate){toast('当前已是最新版本 '+IELTSUpdate.version);return;}const dialog=el('dialog');append(dialog,el('h2','','发现新版本 '+info.versionName),el('p','',info.notes||'可下载新版安装包，覆盖安装。'),el('p','muted','更新包不附带书籍，将继续使用本机已有词库。请先保存未同步的学习记录，安装时不要卸载。'),btn('下载更新',()=>{IELTSUpdate.download(info.downloadUrl);dialog.close();dialog.remove();},'primary wide'),btn('稍后',()=>{dialog.close();dialog.remove();},'wide'));dialog.addEventListener('cancel',()=>dialog.remove());document.body.append(dialog);dialog.showModal();}catch(e){toast(e.name==='AbortError'?'检查更新超时，请稍后再试。':'检查更新失败：'+e.message);}finally{version.disabled=false;version.textContent='检查版本';}},'wide');append(panel,el('p','muted','当前版本 '+IELTSUpdate.version),version);return panel;
}
function renderSyncSettings(){
 const cloud=window.IELTSSync;if(!cloud)return;const cfg=cloud.config(),panel=el('section','panel');append(panel,el('h2','','学习进度'));
 if(storageMode==='local'){append(panel,el('p','','当前：仅本地使用，无需账号。'),btn('启用云端进度同步',()=>{storageMode='cloud';localStorage.setItem('ielts75-mode','cloud');render();},'wide'));append(host,panel);return;}
 if(cfg.enabled&&cfg.token){append(panel,el('p','','账号：'+cfg.username),el('p','muted',cfg.lastSync?'上次同步：'+new Date(cfg.lastSync).toLocaleString():'尚未同步'),btn('立即同步进度',async()=>{try{await cloud.sync();toast('学习进度已同步');render();}catch{}},'primary wide'),btn('退出账号，改为仅本地使用',()=>window.requestAppExit(async()=>{cloud.disconnect();storageMode='local';localStorage.setItem('ielts75-mode','local');const raw=window.AndroidStore?AndroidStore.load():window.BrowserStore?await BrowserStore.load():localStorage.getItem('ielts75-state-v1');state=raw?C.validateState(JSON.parse(raw)):C.emptyState(state.deck);session=null;rebuildQueue();render();}),'wide'));append(host,panel);return;}
 const fields={};for(const [name,label,type]of [['api','云端服务器地址','url'],['username','账号','text'],['password','密码（至少10位）','password'],['registrationCode','注册邀请码（仅注册时填写）','password']]){const input=el('input');input.type=type;input.id='sync-'+name;input.placeholder=label;input.setAttribute('aria-label',label);input.autocomplete=name==='password'?'current-password':name==='username'?'username':'off';if(name==='api')input.value=cfg.api||window.IELTS75_DEFAULT_API||'';if(name==='username')input.value=cfg.username||'';fields[name]=input;append(panel,append(el('label','sync-field'),el('span','',label),input));}
 const connect=async register=>{const action=panel.querySelectorAll('button');action.forEach(b=>b.disabled=true);try{await cloud.login({...Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.value])),register});toast(register?'账号已注册':'已登录');rememberCloudSaved(state);render();}catch(e){toast(e.message);}finally{action.forEach(b=>b.disabled=false);}};
 append(panel,btn('登录账号',()=>connect(false),'primary wide'),btn('注册一个账号',()=>connect(true),'wide'),btn('改为仅本地使用',()=>{cloud.disconnect();storageMode='local';localStorage.setItem('ielts75-mode','local');render();},'text-button'));append(host,panel);
}
window.ieltsSyncState=()=>state;
window.ieltsApplySync=(next,migrate=false)=>{const merged=migrate?next:C.mergeProgress(state,next);if(!persist(merged))return false;rebuildQueue();if(!session)render();return true;};
function renderLearningOptions(){
 const plan=state.learningPlan,remaining=state.deck.cards.filter(c=>!state.learned[c.id]);
 const details=el('details','learning-options');details.id='learning-options';details.open=false;
 append(details,el('summary','','学习安排'+(plan?' · '+(plan.scope==='sentence'?'Sentence '+String(plan.sentence).padStart(2,'0'):plan.ids.length+'个新词'):' · 点击选择')));
 const form=el('div','learning-form');
 const byCount=el('input');byCount.type='radio';byCount.name='learn-scope';byCount.value='count';byCount.checked=false;
 const count=el('input');count.type='number';count.id='learn-count';count.min='1';count.max=String(remaining.length);count.inputMode='numeric';count.value='';count.placeholder='输入数量';count.setAttribute('aria-label','新词数量');
 append(form,append(el('label','check-row'),byCount,el('span','','按数量学习')),append(el('div','inline-field'),el('span','','本次学习'),count,el('span','','个新词')));
 const bySentence=el('input');bySentence.type='radio';bySentence.name='learn-scope';bySentence.value='sentence';bySentence.checked=false;
 const select=el('select');select.id='learn-sentence';select.setAttribute('aria-label','选择新词Sentence');
 const counts=new Map();for(const c of remaining)for(const n of C.sentenceNumbers(c))counts.set(n,(counts.get(n)||0)+1);
 const placeholder=el('option','','请选择Sentence');placeholder.value='';append(select,placeholder);const statuses=new Map(C.sentenceProgress(state).map(x=>[x.sentence,x]));for(let n=1;n<=100;n++){const status=statuses.get(n);const o=el('option','','Sentence '+String(n).padStart(2,'0')+' · '+(status?.complete?'已学完':('未学'+(counts.get(n)||0)+'词')));o.value=String(n);append(select,o);}select.value='';
 append(form,append(el('label','check-row'),bySentence,el('span','','按Sentence学习')),select,el('p','muted learning-reminder','按书本顺序学习，仅学习未标记学会的词；\n按Sentence会选择该句全部未学词。'));
 const start=btn('开始本次学习',()=>{try{if(!byCount.checked&&!bySentence.checked)throw Error('请先勾选学习方式。');const next=C.startLearningPlan(state,{scope:bySentence.checked?'sentence':'count',count:Number(count.value),sentence:Number(select.value)});if(persist(next)){rebuildQueue();render();window.scrollTo(0,0);showLaunchAnimation();}}catch(e){toast(e.message);}},'primary wide');
 function update(){start.disabled=!remaining.length||(!byCount.checked&&!bySentence.checked)||(byCount.checked&&(!Number.isSafeInteger(Number(count.value))||Number(count.value)<1||Number(count.value)>remaining.length))||(bySentence.checked&&!counts.get(Number(select.value)));}
 byCount.onchange=update;bySentence.onchange=update;count.onfocus=()=>{byCount.checked=true;update();};count.oninput=()=>{byCount.checked=true;update();};select.onfocus=()=>{bySentence.checked=true;update();};select.onchange=()=>{bySentence.checked=true;update();};update();append(form,start);append(details,form);append(host,details);
}
function renderLearn(){
 const today=C.localDate(),learned=Object.keys(state.learned).length,todayN=C.learnedOn(state,today).length,percent=learned/state.deck.cards.length*100;
 const stats=el('div','stats');append(stats,el('span','','全书进度 '+(percent===0?'0':percent<1?percent.toFixed(2):percent.toFixed(1))+'%'),el('span','','今日已学 '+todayN+' · 累计 '+learned+'/'+state.deck.cards.length));const progress=el('progress');progress.max=state.deck.cards.length;progress.value=learned;progress.setAttribute('aria-label','全书学习进度');append(host,stats,progress);
 renderLearningOptions();
 if(state.learningPlan?.startedByUser){const p=state.learningPlan,done=p.ids.filter(id=>state.learned[id]).length;append(host,el('p','muted batch-progress','本次已学 '+done+'/'+p.ids.length+' · 待学 '+queue.length));}
 if(!state.learningPlan?.startedByUser){const preview=state.deck.cards.find(c=>!state.learned[c.id]);if(preview){addCard(preview,host);const skip=btn('暂不熟悉',()=>{}),learn=btn('学会了，下一个',()=>{},'primary');skip.disabled=true;learn.disabled=true;append(host,append(el('div','actions'),skip,learn));}return;}
 if(!queue.length){append(host,append(el('div','panel empty'),el('h2','',state.learningPlan?'本次新词学完了':'全书新词已学完'),el('p','','可以在上方选择下一次学习安排，或去复习已学单词。'),btn('去复习',()=>setTab('review'),'primary wide')));return;}
 const c=state.deck.cards.find(x=>x.id===queue[0]);addCard(c,host);
 append(host,append(el('div','actions'),btn('暂不熟悉',()=>{if(queue.length>1){if(persist(C.deferNewWord(state))){rebuildQueue();render();window.scrollTo(0,0);}}else toast('这是本次最后一个未学词，可以继续阅读后再标记。');}),btn('学会了，下一个',()=>{if(persist(C.learnNextWord(state))){rebuildQueue();render();window.scrollTo(0,0);}},'primary')));
}
function showLaunchAnimation(){
 document.getElementById('launch-animation')?.remove();const overlay=el('div','launch-animation');overlay.id='launch-animation';overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');const text=el('strong','','Are you ready?');const skip=btn('跳过',()=>finish(),'text-button');append(overlay,el('div','launch-spark','✦'),text,skip);document.body.append(overlay);let timer1,timer2;function finish(){clearTimeout(timer1);clearTimeout(timer2);overlay.remove();}const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;timer1=setTimeout(()=>{text.textContent='GO!';overlay.classList.add('go');},reduced?50:500);timer2=setTimeout(finish,reduced?150:1050);
}
function renderHistoryDay(){
 const cards=C.learnedOn(state,historyDate);
 if(historyCard){const c=cards.find(c=>c.id===historyCard);if(c){append(host,btn('‹ 返回当日单词',()=>{historyCard=null;render();window.scrollTo(0,0);},'text-button back-library'));addCard(c,host);return;}historyCard=null;}
 append(host,btn('‹ 返回学习记录',()=>{historyDate='';historyCard=null;render();window.scrollTo(0,0);},'text-button back-library'),el('h1','page-title',historyDate+' 学习的单词'),el('p','muted','共 '+cards.length+' 个新词 · 按书本顺序'));
 const list=el('div','word-list');list.id='history-word-list';for(const c of cards){const b=btn(c.word,()=>{historyCard=c.id;render();window.scrollTo(0,0);},'library-word');b.lang='en';append(list,b);}if(!cards.length)append(list,el('p','muted','该日期暂无已学词。'));append(host,list);
}
function renderReview(){
 if(historyDate){renderHistoryDay();return;}
 const total=Object.keys(state.learned).length;const panel=el('section','panel');append(panel,el('h2','','按自己的节奏复习'),el('p','muted','已学 '+total+' 个词 · 单选或多选练习方式'));
 append(panel,el('div','subheading','练习方式'));
 const hints={meaning:'先回忆中文，再翻答案自评',spelling:'根据中文释义输入英文',cloze:'在英文例句中补全单词',conversion:'练习词族中的名词、动词等转换'};
 C.MODES.forEach(mode=>{const label=el('label','check-row');const input=el('input');input.type='checkbox';input.value=mode;input.name='mode';input.checked=reviewOptions.modes.includes(mode);input.onchange=()=>{reviewOptions.modes=[...panel.querySelectorAll('input[name=mode]:checked')].map(x=>x.value);};append(label,input,append(el('span'),document.createTextNode(names[mode]),el('small','',hints[mode])));append(panel,label);});
 append(panel,el('div','subheading','选择复习范围'));
 const all=el('input');all.type='radio';all.name='scope';all.value='all';all.checked=reviewOptions.scope==='all';append(panel,append(el('label','check-row'),all,el('span','','从全部已学词中随机抽取')));
 const count=el('input');count.type='number';count.id='review-count';count.min='1';count.max=String(total);count.inputMode='numeric';count.value=String(Math.min(reviewOptions.count,total)||1);count.oninput=()=>reviewOptions.count=Number(count.value);append(panel,append(el('div','inline-field'),el('span','','随机复习'),count,el('span','','个词（不重复）')));
 const byDate=el('input');byDate.type='radio';byDate.name='scope';byDate.value='date';byDate.checked=reviewOptions.scope==='date';append(panel,append(el('label','check-row'),byDate,el('span','','只复习某日学习的单词')));
 const select=el('select');select.id='review-date';select.setAttribute('aria-label','学习日期');const dates=[...new Set(Object.values(state.learned).map(r=>r.date))].sort().reverse();dates.forEach(d=>{const o=el('option','',d+' · '+Object.values(state.learned).filter(r=>r.date===d).length+'词');o.value=d;append(select,o);});if(!dates.length)append(select,el('option','','暂无学习记录'));if(dates.includes(reviewOptions.date))select.value=reviewOptions.date;select.onchange=()=>reviewOptions.date=select.value;append(panel,select);
 function updateScope(){reviewOptions.scope=all.checked?'all':'date';count.disabled=!all.checked;select.disabled=all.checked;}all.onchange=updateScope;byDate.onchange=updateScope;updateScope();
 const start=btn('开始复习',()=>{try{const cards=C.selectWords(state,{scope:reviewOptions.scope,count:Number(count.value),date:select.value});const built=C.buildQuestions(cards,reviewOptions.modes);session={...built,index:0,wordCount:cards.length,answers:[],revealed:false};render();window.scrollTo(0,0);}catch(e){toast(e.message);}},'primary wide');start.disabled=total===0;append(panel,start);if(!total)append(panel,el('div','notice','先在“新词学习”中标记学会的单词，才会加入复习范围。'));append(panel,el('p','muted','多选会对每个词依次练习所选题型。不适用的填空或词性转换题会跳过并说明。'));append(host,panel);
 const recent=el('section','panel');append(recent,el('h2','','学习记录'));dates.forEach(d=>append(recent,btn(d+' · '+C.learnedOn(state,d).length+' 个新词 ›',()=>{historyDate=d;historyCard=null;render();window.scrollTo(0,0);},'wide history-day')));if(!dates.length)append(recent,el('p','muted','学过的每个词会记录首次学习日期。'));const r=state.results.filter(x=>x.date===C.localDate());if(r.length)append(recent,el('p','muted','今日已提交 '+r.length+' 题，其中答对／自评记得 '+r.filter(x=>x.correct).length+' 题'));append(host,recent);
}
function renderQuestion(){
 if(session.index>=session.questions.length){renderResults();return;}
 const q=session.questions[session.index],c=C.questionCard(state.deck,q);
 const line=el('div','row');append(line,el('span','eyebrow',names[q.mode]),btn('结束本轮',()=>{if(confirm('结束本轮？已提交结果会保留。')){session=null;render();}},'text-button'));append(host,line,el('div','stats',(session.index+1)+' / '+session.questions.length+' 题 · '+session.wordCount+' 个词'));
 const prog=el('progress');prog.max=session.questions.length;prog.value=session.index;append(host,prog);
 const skip=session.skipped.conversion+session.skipped.cloze;if(skip)append(host,el('div','notice','已跳过 '+session.skipped.conversion+' 道不适用的词性转换题、'+session.skipped.cloze+' 道不适用的填空题。'));
 const panel=el('section','panel');append(panel,el('div','eyebrow',sourceText(c)),el('div','quiz-prompt'+(q.mode==='meaning'?' word-prompt':''),q.prompt));
 if(q.selfGrade){append(panel,el('p','muted','先在心里说出意思，再查看答案。'));if(!session.revealed)append(panel,btn('查看答案',()=>{session.revealed=true;render();},'primary wide'));else{append(panel,append(el('div','answer-box'),el('strong','',c.meaning),el('p','',c.definition)),append(el('div','actions'),btn('没记住',()=>submitResult(false)),btn('记得',()=>submitResult(true),'primary')));}}
 else if(!session.revealed){const input=el('input','answer-input');input.type='text';input.id='answer';input.autocomplete='off';input.autocapitalize='none';input.spellcheck=false;input.placeholder='输入英文答案';input.setAttribute('aria-label','英文答案');append(panel,input);const check=()=>{if(!input.value.trim()){toast('请输入答案，或点击“不会，查看答案”。');return;}session.userAnswer=input.value;session.correct=C.checkAnswer(input.value,q.answers);if(!recordResult(session.correct))return;session.revealed=true;render();};input.onkeydown=e=>{if(e.key==='Enter')check();};append(panel,btn('提交答案',check,'primary wide'),btn('不会，查看答案',()=>{session.userAnswer='（未作答）';session.correct=false;if(!recordResult(false))return;session.revealed=true;render();},'wide'));}
 else{const box=el('div','answer-box'+(session.correct?'':' wrong'));append(box,el('strong','',session.correct?'回答正确':'再记一次'),el('p','','你的答案：'+session.userAnswer),el('p','','参考答案：'+q.answers.join(' / ')),el('p','',c.meaning),el('p','',c.example),el('p','translation',c.exampleZh));append(panel,box,btn('▶ 听读单词',()=>speak(c.word,'en-GB'),'audio'),btn('下一题',()=>submitResult(session.correct),'primary wide'));}
 append(host,panel);
}
function recordResult(correct){if(session.recorded)return true;const q=session.questions[session.index];const r={id:q.id,mode:q.mode,correct:!!correct,date:C.localDate(),at:new Date().toISOString(),eventId:crypto.randomUUID()};if(!persist({...state,results:[...state.results,r].slice(-50000)}))return false;session.answers.push({...r,prompt:q.prompt,answer:q.answers.join(' / ')});session.recorded=true;return true;}
function submitResult(correct){if(!recordResult(correct))return;session.index++;session.recorded=false;session.revealed=false;session.userAnswer='';render();window.scrollTo(0,0);}
function renderResults(){const answers=session.answers,correct=answers.filter(x=>x.correct).length,wrong=answers.filter(x=>!x.correct);const panel=el('section','panel');append(panel,el('h2','','本轮复习完成'),append(el('div','result-grid'),append(el('div'),el('b','',String(answers.length)),el('small','','完成题数')),append(el('div'),el('b','',String(correct)),el('small','','答对／自评记得'))),el('p','muted','已自动保存到本机。词义回忆题采用你的自评结果。'));if(wrong.length){append(panel,el('div','subheading','本轮需要再记的内容'));wrong.forEach(r=>{const c=state.deck.cards.find(x=>x.id===r.id);append(panel,append(el('div','wrong-row'),el('b','',c.word+' · '+names[r.mode]),el('p','',r.answer)));});}else append(panel,el('div','notice','本轮全部答对／自评记得，之后仍可以再次复习。'));append(panel,btn('返回复习设置',()=>{session=null;render();},'primary wide'));append(host,panel);}
function showBackupHistory(){
 if(!window.AndroidStore||!AndroidStore.backupList){toast('自动备份需使用支持此功能的安卓版本。');return;}
 let panel=$('backup-history-panel');if(panel)panel.remove();panel=el('section','panel');panel.id='backup-history-panel';append(panel,el('h2','','自动备份'),el('p','muted','daily为每日副本，protected为恢复前保护副本。恢复将替换当前学习数据。'));
 try{const names=JSON.parse(AndroidStore.backupList());if(!names.length)append(panel,el('p','','暂无自动备份。'));for(const name of names)append(panel,btn(name,()=>{const raw=AndroidStore.readBackup(name);if(raw)window.onNativeImport(raw,'restore');},'wide'));}catch(e){toast('无法读取备份列表：'+e.message);}
 append(host,panel);makeSettingsCollapsible();panel.scrollIntoView();
}
function requestImport(kind){importKind=kind;if(window.AndroidStore)AndroidStore.importFile(kind);else{$('file-picker').value='';$('file-picker').click();}}
window.onNativeImport=function(raw,kind){try{const data=JSON.parse(raw.replace(/^\uFEFF/,''));if(!state){const next=kind==='restore'?C.validateState(data):C.emptyState(C.validateDeck(data));if(persist(next)){rebuildQueue();render();toast('词库已保存到本地');}return;}if(kind==='restore'){C.validateState(data);if(data.deck.bookId!==state.deck.bookId)throw Error('这不是当前单词书的备份。');if(!confirm('恢复备份将替换当前词库和学习记录。建议先导出当前备份。确认恢复？'))return;if(window.AndroidStore&&AndroidStore.protectCurrent&&!AndroidStore.protectCurrent())return;if(!window.AndroidStore){if(window.BrowserStore)BrowserStore.put('before-restore',JSON.stringify(state));else localStorage.setItem('ielts75-before-restore',JSON.stringify(state));}if(persist(data)){session=null;rebuildQueue();render();toast('备份已恢复，恢复前记录已保留');}}else{const m=C.mergeDeck(state,data);if(!confirm('将新增 '+m.added+' 个词，更新 '+m.updated+' 个词。学习记录保留，确认导入？'))return;if(persist(m.state)){session=null;rebuildQueue();render();toast('词库已导入，已有学习记录已保留');}}}catch(e){toast('导入失败：'+e.message);}};
function exportBackup(){const raw=JSON.stringify(state,null,2);const name='雅思7.5-完整备份-'+C.localDate()+'.json';if(window.AndroidStore)AndroidStore.exportFile(raw,name);else{const a=document.createElement('a');const u=URL.createObjectURL(new Blob([raw],{type:'application/json'}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}}
async function updateBundledDeck(){
 try{
  const response=await fetch('deck.json');if(!response.ok)return;const raw=await response.json();if(!raw.cards?.length)return;const bundled=C.validateDeck(raw);
  if(state.deck.revision===bundled.revision||state.bundledRevision===bundled.revision)return;
  const merged=C.mergeDeck(state,bundled);
  if(window.AndroidStore){if(!AndroidStore.protectCurrent||!AndroidStore.protectCurrent()){toast('更新前保护副本未能保存，保留当前词库和学习记录。');return;}}
  else if(window.BrowserStore)await BrowserStore.put('before-update',JSON.stringify(state));else localStorage.setItem('ielts75-before-update',JSON.stringify(state));
  if(persist({...merged.state,bundledRevision:bundled.revision}))toast('内置词库已更新，原有学习和复习记录已保留。');
 }catch(e){toast('内置词库更新失败，已保留当前记录：'+e.message);}
}
$('file-picker').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>30*1024*1024){toast('文件过大，最多支持30MB。');return;}window.onNativeImport(await f.text(),importKind);};
for(const name of ['learn','review','library','settings'])$('tab-'+name).onclick=()=>setTab(name);
(async function init(){try{const raw=window.AndroidStore?AndroidStore.load():window.BrowserStore?await BrowserStore.load():localStorage.getItem('ielts75-state-v1');if(raw){try{state=C.validateState(JSON.parse(raw));}catch(e){host.textContent='本地记录无法读取，已保留原始文件。请先使用下方按钮导出，再尝试恢复有效备份。';append(host,btn('导出原始记录',()=>{if(window.AndroidStore)AndroidStore.exportFile(raw,'雅思7.5-待恢复原始记录.json');else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([raw]));a.download='雅思7.5-待恢复原始记录.json';a.click();}}),btn('从备份恢复',()=>requestImport('restore')));window.onNativeImport=(text)=>{try{const next=C.validateState(JSON.parse(text));if(confirm('确认使用这份备份恢复？')&&persist(next)){rebuildQueue();render();}}catch(err){toast(err.message);}};return;}await updateBundledDeck();}else{const response=await fetch('deck.json');if(response.ok){const d=await response.json();if(d.cards?.length){state=C.emptyState(d);if(!persist(state))throw Error('无法初始化本地存储。');}}}if(cloudMode()&&!state){const cached=window.AndroidStore?.loadBook?AndroidStore.loadBook():window.BrowserStore?await BrowserStore.get('cloud-book'):null;if(cached)state=C.emptyState(C.validateDeck(JSON.parse(cached)));}if(cloudMode()&&state){const book=window.AndroidStore?.loadBook?AndroidStore.loadBook():window.BrowserStore?await BrowserStore.get('cloud-book'):null;if(book){state=C.emptyState(C.validateDeck(JSON.parse(book)));}else state=C.emptyState(state.deck);cloudDeckCache=JSON.stringify(state.deck);}if(state)rebuildQueue();render();if(cloudMode()){rememberCloudSaved(state);toast('云端模式：点击“立即同步进度”读取已保存记录；本次未同步记录仅在内存中。');}}catch(e){host.textContent='启动失败：'+e.message;}})();
