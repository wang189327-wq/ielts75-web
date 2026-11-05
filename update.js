'use strict';
(function(root){
 const VERSION='1.4',CODE=24,BASE='https://wang189327-wq.github.io/ielts75-web/',RELEASE='https://github.com/wang189327-wq/ielts75-web/releases/download/';
 function validate(data){if(!data||!Number.isSafeInteger(data.versionCode)||data.versionCode<1||typeof data.versionName!=='string'||!/^\d+(\.\d+){1,2}$/.test(data.versionName)||typeof data.downloadUrl!=='string'||!data.downloadUrl.startsWith(RELEASE)||!/^https:\/\/github\.com\/wang189327-wq\/ielts75-web\/releases\/download\/v[\d.]+\/ielts75-[\d.]+-no-book\.apk$/.test(data.downloadUrl)||!/^[a-f0-9]{64}$/.test(data.sha256||''))throw Error('版本信息格式不正确');return data;}
 async function check(){const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000);try{const response=await fetch(BASE+'version.json?t='+Date.now(),{cache:'no-store',credentials:'omit',signal:abort.signal});if(!response.ok)throw Error('版本服务暂不可用（'+response.status+'）');const data=validate(await response.json());return {...data,hasUpdate:data.versionCode>CODE};}finally{clearTimeout(timer);}}
 function download(url){validate({versionCode:1,versionName:'1.0',downloadUrl:url,sha256:'0'.repeat(64)});if(root.AndroidStore?.openUpdateUrl)root.AndroidStore.openUpdateUrl(url);else window.open(url,'_blank','noopener,noreferrer');}
 root.IELTSUpdate={version:VERSION,code:CODE,check,download,validate};
 if(typeof module!=='undefined')module.exports=root.IELTSUpdate;
})(typeof window==='undefined'?globalThis:window);
