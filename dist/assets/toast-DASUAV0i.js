function a(s,n,o){const e=document.getElementById("toast-container");if(!e)return;const t=document.createElement("div");t.className=`toast ${s}`;const i={success:"✅",error:"❌",warning:"⚠️",info:"ℹ️"};t.innerHTML=`
    <div class="toast-icon">${i[s]}</div>
    <div class="toast-content">
      <div class="toast-title">${n}</div>
      <div class="toast-message">${o}</div>
    </div>
  `,e.appendChild(t),setTimeout(()=>{t.style.animation="slideInRight 0.3s ease reverse",setTimeout(()=>t.remove(),300)},5e3)}export{a as s};
