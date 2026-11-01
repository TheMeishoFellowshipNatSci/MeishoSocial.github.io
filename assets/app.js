(() => {
  const C = window.MEISHO_CONFIG;
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  let publicData = {posts:[],topics:[]};
  let idToken = sessionStorage.getItem("meisho_id_token") || "";

  function initTheme(){
    const saved=localStorage.getItem("meisho_theme");
    const theme=saved || (matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");
    setTheme(theme);
    $("#themeToggle").onclick=()=>setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark",true);
  }
  function setTheme(theme,save=false){
    document.documentElement.dataset.theme=theme;
    if(save)localStorage.setItem("meisho_theme",theme);
    $("#themeToggle").innerHTML=`<i data-lucide="${theme==="dark"?"sun":"moon"}"></i>`;
    refreshIcons();
  }
  function initLogo(){ $$('img.logo-img').forEach(x=>x.src=C.logoUrl); $("#brandImage").src=C.logoUrl; $("#headerAvatar").src=C.logoUrl; }
  function refreshIcons(){ if(window.lucide) lucide.createIcons(); }
  async function loadData(){
    try{ const r=await fetch(C.publicDataUrl+`?v=${Date.now()}`,{cache:"no-store"}); if(!r.ok)throw Error(); publicData=await r.json(); }
    catch{ publicData={posts:[],topics:[]}; }
    renderTopics(); renderPosts();
  }
  function renderTopics(){
    const list=$("#topicList"); list.innerHTML=(publicData.topics||[]).slice(0,8).map((x,i)=>`<li><b>${i+1}</b><a href="#topic-${escapeHtml(x.name)}">#${escapeHtml(x.name)}#</a><small>${Number(x.count||0)}</small></li>`).join("");
  }
  function roleBadge(role){
    if(role==="secretariat")return '<span class="verified central" title="中央運営認証"><i data-lucide="shield-check"></i></span>';
    if(role==="humanities_operator"||role==="science_operator")return '<span class="verified operator" title="系統運営認証"><i data-lucide="sparkles"></i></span>';
    if(role==="member")return '<span class="verified member" title="明照の同志">結</span>'; return "";
  }
  function formatBody(text){return escapeHtml(text).replace(/#([^#\n]{1,40})#/g,'<a class="tag" href="#topic-$1">#$1#</a>');}
  function renderPosts(){
    const list=$("#postList");
    list.innerHTML=(publicData.posts||[]).map((p,i)=>`<article class="post ${p.role==="secretariat"?"central":""}" data-role="${p.role||"user"}"><div class="post-body"><span class="avatar"><img src="${p.role==="secretariat"?C.logoUrl:""}" alt=""><span>${escapeHtml((p.penName||"名").slice(0,1))}</span></span><div class="post-main"><div class="post-head"><div><div class="post-author">${escapeHtml(p.penName||"利用者")} ${roleBadge(p.role)}</div><div class="post-meta">@${escapeHtml((p.gasshoId||"").replace("-",""))} · ${relativeTime(p.createdAt)}</div></div><button class="post-more"><i data-lucide="ellipsis"></i></button></div><div class="post-text">${formatBody(p.body||"")}</div></div></div><div class="post-actions"><button><i data-lucide="repeat-2"></i><span>共有</span> ${i+1}</button><button><i data-lucide="message-circle"></i><span>返信</span> ${i+2}</button><button class="like"><i data-lucide="heart"></i><span>いいね</span> ${11+i*4}</button><button><i data-lucide="bookmark"></i><span>保存</span></button></div></article>`).join("") || '<section class="card" style="padding:28px;text-align:center;color:var(--muted)">まだ発信はありません。</section>';
    $$(".like").forEach(b=>b.onclick=()=>b.classList.toggle("liked")); refreshIcons();
  }
  function relativeTime(v){
    if(!v)return ""; const n=Date.now()-new Date(v).getTime();
    if(n<60000)return "たった今"; if(n<3600000)return `${Math.floor(n/60000)}分前`; if(n<86400000)return `${Math.floor(n/3600000)}時間前`;
    return new Intl.DateTimeFormat("ja-JP",{timeZone:C.timeZone,month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v));
  }
  function escapeHtml(v){const d=document.createElement("div");d.textContent=String(v??"");return d.innerHTML;}
  function initComposer(){
    const text=$("#postText"), count=$("#charCount"); text.oninput=()=>count.textContent=2000-text.value.length;
    $("#publishButton").onclick=async()=>{
      if(!text.value.trim())return showNotice("正行内容を入力してください。",false);
      if(!idToken)return openLogin();
      try{
        const session=await api({action:"session",idToken}); if(!session.ok)throw Error(session.error);
        const out=await api({action:"createPost",idToken,nonce:session.data.nonce,body:text.value.trim(),replyTo:""});
        if(!out.ok)throw Error(out.error); text.value="";count.textContent="2000";showNotice("安全検査を通過しました。次回同期時に公開されます。",true);
      }catch(e){showNotice(e.message||"安全違反：信号異常。",false)}
    };
    $$(".compose-scroll").forEach(x=>x.onclick=()=>{$("#composer").scrollIntoView({behavior:"smooth"});text.focus()});
  }
  async function api(payload){const r=await fetch(C.gasUrl,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});return r.json()}
  function showNotice(message,good){const n=$("#notice");n.hidden=false;n.textContent=message;n.style.background=good?"#eaf8ef":"#fff0f0";n.style.color=good?"#168244":"#d43838";setTimeout(()=>n.hidden=true,4000)}
  function openLogin(){ $("#loginModal").hidden=false; }
  function initLogin(){
    $("#loginButton").onclick=openLogin; $("#closeLogin").onclick=()=>$("#loginModal").hidden=true;
    const boot=()=>{if(!window.google)return setTimeout(boot,150);google.accounts.id.initialize({client_id:C.googleClientId,callback:r=>{idToken=r.credential;sessionStorage.setItem("meisho_id_token",idToken);$("#loginModal").hidden=true;$("#headerName").textContent="接続済み";showNotice("Google認証に成功しました。",true)}});google.accounts.id.renderButton($("#googleButton"),{theme:document.documentElement.dataset.theme==="dark"?"filled_black":"outline",size:"large",shape:"pill",width:320,text:"continue_with"})};boot();
  }
  function initMobile(){const nav=$("#leftNav"),overlay=$("#mobileOverlay");$("#mobileMenu").onclick=()=>{nav.classList.add("open");overlay.classList.add("show")};overlay.onclick=()=>{nav.classList.remove("open");overlay.classList.remove("show")}}
  function initTabs(){ $$(".feed-tabs button").forEach(b=>b.onclick=()=>{$$(".feed-tabs button").forEach(x=>x.classList.remove("active"));b.classList.add("active");const t=b.dataset.tab;$$('.post').forEach(p=>p.hidden=t==="official"&&!['secretariat','humanities_operator','science_operator'].includes(p.dataset.role))}) }
  window.addEventListener("DOMContentLoaded",()=>{initTheme();initLogo();initComposer();initLogin();initMobile();loadData().then(initTabs);refreshIcons()});
})();
