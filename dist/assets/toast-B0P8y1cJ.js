function m(o,a,d){let e="info",t="",n="";const c=["success","error","warning","info"];c.includes(o)?(e=o,t=a||"",n=d||""):c.includes(a)?(e=a,t=e.charAt(0).toUpperCase()+e.slice(1),n=o||""):(e="info",t=o||"",n=a||"");let s=document.getElementById("toast-container");s||(s=document.createElement("div"),s.id="toast-container",s.className="toast-container",document.body.appendChild(s)),s.style.zIndex="99999";const i=document.createElement("div");i.className=`toast ${e}`;const l={success:"✅",error:"❌",warning:"⚠️",info:"ℹ️"};i.innerHTML=`
    <div class="toast-icon">${l[e]||"ℹ️"}</div>
    <div class="toast-content">
      ${t?`<div class="toast-title">${t}</div>`:""}
      ${n?`<div class="toast-message">${n}</div>`:""}
    </div>
  `,s.appendChild(i),setTimeout(()=>{i.style.animation="slideInRight 0.3s ease reverse",setTimeout(()=>i.remove(),300)},5e3)}export{m as s};
