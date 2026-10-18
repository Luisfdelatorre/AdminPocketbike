import{r as o,j as e,a as X,ac as J,y as K,ad as Z}from"./main-COdHEAqG.js";import{A as ee}from"./arrow-left-HCDivs0K.js";import{c as V}from"./createLucideIcon-BKaehgFQ.js";import{C as te}from"./circle-check-big-BQVVHsGj.js";import{u as ae}from"./useFilterVisibilityOnScroll-CbHncskg.js";import{P as ie}from"./PageHeader-DHuwqnQu.js";import{S as se}from"./StatusBadge-BRsao_CW.js";/* empty css                 *//* empty css              */import{P as O}from"./plus-UJZgvFL6.js";import{B as W}from"./building-6cimP1fs.js";import{S as $}from"./search-DTF0wx7Z.js";import{X as _}from"./x-T50R__zL.js";import{R as ne}from"./refresh-cw-Bh08HFVC.js";import{D as oe}from"./dollar-sign-B2SAmSgH.js";import{T as re}from"./trending-down-DZp2aGHZ.js";import{C as le}from"./check-CJR1UJZq.js";import{F as ce}from"./file-text-0Nnvu1IN.js";import"./funnel-DTZcJBAg.js";import"./circle-alert-RaRS_j6p.js";import"./loader-circle-DpMVlWrL.js";import"./clock-D_QaZ60i.js";import"./credit-card-B6JnJdK5.js";/**
 * @license lucide-react v0.562.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const de=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M8 13h2",key:"yr2amv"}],["path",{d:"M14 13h2",key:"un5t4a"}],["path",{d:"M8 17h2",key:"2yhykz"}],["path",{d:"M14 17h2",key:"10kma7"}]],L=V("file-spreadsheet",de);/**
 * @license lucide-react v0.562.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pe=[["path",{d:"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",key:"143wyd"}],["path",{d:"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6",key:"1itne7"}],["rect",{x:"6",y:"14",width:"12",height:"8",rx:"1",key:"1ue0tg"}]],S=V("printer",pe),xe=({invoice:i,onBack:v})=>{const N=()=>{window.print()},r=s=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:0}).format(s||0);new Date(i.dueDate).toLocaleDateString("es-CO");const p=new Date(i.issuedAt).toLocaleDateString("es-CO"),x=i.subtotal||0,w=i.tax||0,m=i.amountDue||0,l=i.companyId||{};return o.useEffect(()=>{const s=document.querySelector(".mobile-header h2");let n="";return s&&(n=s.innerText,s.innerText=l.name||"Factura"),()=>{s&&n&&(s.innerText=n)}},[l.name]),e.jsxs("div",{className:"invoice-preview-container",children:[e.jsxs("div",{className:"no-print",children:[e.jsxs("button",{onClick:v,style:{display:"flex",alignItems:"center",gap:"8px",padding:"10px 20px",background:"white",color:"#475569",border:"1px solid #cbd5e1",borderRadius:"8px",cursor:"pointer",fontSize:"14px",fontWeight:"500",transition:"all 0.2s",boxShadow:"0 1px 2px rgba(0,0,0,0.05)"},onMouseOver:s=>s.currentTarget.style.backgroundColor="#f8fafc",onMouseOut:s=>s.currentTarget.style.backgroundColor="white",children:[e.jsx(ee,{size:16})," Volver al listado"]}),e.jsxs("button",{onClick:N,style:{display:"flex",alignItems:"center",gap:"8px",padding:"10px 20px",background:"#3b82f6",color:"white",border:"none",borderRadius:"8px",cursor:"pointer",fontSize:"14px",fontWeight:"600",transition:"all 0.2s",boxShadow:"0 4px 6px -1px rgba(59, 130, 246, 0.3)"},onMouseOver:s=>s.currentTarget.style.transform="translateY(-1px)",onMouseOut:s=>s.currentTarget.style.transform="none",children:[e.jsx(S,{size:16})," Imprimir / PDF"]})]}),e.jsxs("div",{className:"invoice-print-area",children:[e.jsxs("div",{className:"invoice-header",children:[e.jsxs("div",{className:"invoice-header-title",children:[e.jsx("h1",{children:"RESUMEN DE COMISIÓN"}),e.jsxs("div",{className:"invoice-number",children:["Factura #: ",i.invoiceNumber]})]}),e.jsxs("div",{className:"invoice-header-company-details",children:[e.jsx("div",{className:"company-name",children:"Pocketbike S.A.S"}),e.jsx("div",{className:"company-info-text",children:"NIT: 901366393-9"}),e.jsx("div",{className:"company-info-text",children:"Turbaco, Colombia"}),e.jsx("div",{className:"company-email",children:"billing@pocketbike.app"})]})]}),e.jsxs("div",{className:"invoice-info-section",children:[e.jsxs("div",{className:"invoice-info-left",children:[e.jsx("div",{className:"section-title-label",children:"Facturado a"}),e.jsx("div",{className:"company-name-bold",children:l.name||"COMPANY NAME"}),l.nit&&e.jsxs("div",{className:"info-text-row",children:["NIT: ",l.nit]}),e.jsx("div",{className:"info-text-row",children:l.address||"Address not provided"})]}),e.jsxs("div",{className:"invoice-info-right",children:[e.jsxs("div",{className:"invoice-dates-wrapper",children:[e.jsxs("div",{className:"invoice-date-col",style:{marginRight:"16px"},children:[e.jsx("div",{className:"section-title-label",style:{marginBottom:"4px"},children:"Fecha de Emisión"}),e.jsx("div",{className:"invoice-date-val",children:p})]}),e.jsxs("div",{className:"invoice-date-col",children:[e.jsx("div",{className:"section-title-label",style:{marginBottom:"4px"},children:"Periodo"}),e.jsxs("div",{className:"invoice-date-val",children:[i.month.toString().padStart(2,"0"),"/",i.year]})]})]}),e.jsxs("div",{className:"status-pill",children:[e.jsx(te,{size:14}),"Pre-Retenido"]})]})]}),e.jsx("div",{className:"invoice-table-area desktop-only",children:e.jsxs("table",{className:"invoice-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{className:"text-left",children:"Descripción"}),e.jsx("th",{className:"text-center",children:"Transacciones"}),e.jsx("th",{className:"text-right",children:"Volumen Total"}),e.jsx("th",{className:"text-right",children:"Retenido"})]})}),e.jsx("tbody",{children:e.jsxs("tr",{children:[e.jsxs("td",{children:[e.jsx("div",{className:"item-desc-title",children:"Comisión por Procesamiento de Pagos"}),e.jsxs("div",{className:"item-desc-sub",children:["Comisión retenida del volumen total procesado para ",i.month.toString().padStart(2,"0"),"/",i.year]})]}),e.jsx("td",{className:"text-center",style:{color:"#334155"},children:i.totalTransactions}),e.jsx("td",{className:"text-right",style:{color:"#334155"},children:r(i.totalPaymentsAmount)}),e.jsx("td",{className:"text-right",style:{fontWeight:"600",color:"#0f172a"},children:r(x)})]})})]})}),e.jsxs("div",{className:"invoice-mobile-details mobile-only",children:[e.jsxs("div",{className:"mobile-detail-row header-row",children:[e.jsx("span",{className:"mobile-detail-title",children:"Descripción"}),e.jsx("span",{className:"font-semibold",style:{fontSize:"15px"},children:"Comisión por Procesamiento de Pagos"}),e.jsxs("div",{className:"item-desc-sub",style:{fontSize:"12px"},children:["Comisión retenida del volumen total procesado para ",i.month.toString().padStart(2,"0"),"/",i.year]})]}),e.jsxs("div",{className:"mobile-detail-row",children:[e.jsx("span",{children:"Transacciones"}),e.jsx("span",{className:"font-semibold",children:i.totalTransactions})]}),e.jsxs("div",{className:"mobile-detail-row",children:[e.jsx("span",{children:"Volumen Total"}),e.jsxs("span",{className:"font-semibold",children:[r(i.totalPaymentsAmount)," COP"]})]}),e.jsxs("div",{className:"mobile-detail-row",children:[e.jsx("span",{children:"Retenido"}),e.jsxs("span",{className:"font-semibold",style:{color:"#0f172a"},children:[r(x)," COP"]})]})]}),e.jsxs("div",{className:"invoice-totals-section",children:[e.jsx("div",{className:"invoice-note-container",children:e.jsxs("div",{className:"invoice-note-box",children:[e.jsx("div",{className:"invoice-note-title",children:"Nota Importante"}),e.jsxs("div",{className:"invoice-note-text",children:["Este es un resumen de las comisiones que ",e.jsx("strong",{children:"ya han sido pre-retenidas"})," de sus transacciones diarias.",e.jsx("span",{style:{color:"#dc2626",fontWeight:"600",display:"block",marginTop:"8px"},children:"No realice ninguna transferencia por este valor. No se requiere ninguna acción de su parte."})]})]})}),e.jsxs("div",{className:"invoice-totals-container",children:[e.jsxs("div",{className:"invoice-totals-row subtotal-row",children:[e.jsx("span",{style:{color:"#475569",fontWeight:"500"},children:"Subtotal"}),e.jsx("span",{style:{color:"#0f172a",fontWeight:"600"},children:r(x)})]}),e.jsxs("div",{className:"invoice-totals-row",children:[e.jsx("span",{style:{color:"#475569",fontWeight:"500"},children:"IVA"}),e.jsx("span",{style:{color:"#0f172a",fontWeight:"600"},children:r(w)})]}),e.jsxs("div",{className:"invoice-totals-row grand-total-row",children:[e.jsx("span",{className:"total-label",children:"Total Retenido"}),e.jsx("span",{className:"total-value",children:r(m)})]})]})]})]}),e.jsx("style",{dangerouslySetInnerHTML:{__html:`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                
                .invoice-preview-container {
                    background-color: #f1f5f9;
                    min-height: 100vh;
                    padding: 40px 20px;
                    font-family: 'Inter', sans-serif;
                    box-sizing: border-box;
                }
                
                .no-print {
                    max-width: 800px;
                    margin: 0 auto 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .invoice-print-area {
                    max-width: 800px;
                    margin: 0 auto;
                    background: #ffffff;
                    border-radius: 16px;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
                    overflow: hidden;
                    color: #1e293b;
                    box-sizing: border-box;
                }
                
                .invoice-header {
                    background: #0f172a;
                    padding: 40px;
                    color: white;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 20px;
                }
                
                .invoice-header-title h1 {
                    font-size: 28px;
                    margin: 0 0 8px 0;
                    font-weight: 700;
                    letter-spacing: -0.5px;
                    line-height: 1.2;
                }
                
                .invoice-header-title .invoice-number {
                    color: #94a3b8;
                    font-size: 14px;
                }
                
                .invoice-header-company-details {
                    text-align: right;
                }
                
                .invoice-header-company-details .company-name {
                    font-weight: 700;
                    font-size: 18px;
                    margin-bottom: 4px;
                }
                
                .invoice-header-company-details .company-info-text {
                    color: #94a3b8;
                    font-size: 14px;
                    margin-bottom: 2px;
                }
                
                .invoice-header-company-details .company-email {
                    color: #38bdf8;
                    font-size: 14px;
                }
                
                .invoice-info-section {
                    display: flex;
                    justify-content: space-between;
                    padding: 40px;
                    border-bottom: 1px solid #e2e8f0;
                    gap: 24px;
                }
                
                .invoice-info-left {
                    flex: 1.2;
                }
                
                .invoice-info-right {
                    flex: 1;
                    text-align: right;
                }
                
                .section-title-label {
                    font-size: 11px;
                    font-weight: 600;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 12px;
                }
                
                .company-name-bold {
                    font-weight: 700;
                    font-size: 18px;
                    color: #0f172a;
                    margin-bottom: 4px;
                }
                
                .info-text-row {
                    color: #475569;
                    font-size: 14px;
                    margin-bottom: 4px;
                }
                
                .invoice-dates-wrapper {
                    display: flex;
                    justify-content: flex-end;
                    margin-bottom: 12px;
                }
                
                .invoice-date-col {
                    text-align: left;
                }
                
                .invoice-date-val {
                    font-size: 14px;
                    font-weight: 500;
                    color: #0f172a;
                }
                
                .status-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: #ecfdf5;
                    color: #059669;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 13px;
                    font-weight: 600;
                }
                
                .invoice-table-area {
                    padding: 40px;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                
                .invoice-table {
                    width: 100%;
                    border-collapse: collapse;
                    min-width: 600px;
                }
                
                .invoice-table th {
                    padding: 0 0 16px 0;
                    color: #64748b;
                    font-weight: 600;
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 2px solid #e2e8f0;
                }
                
                .invoice-table th.text-left { text-align: left; }
                .invoice-table th.text-center { text-align: center; }
                .invoice-table th.text-right { text-align: right; }
                
                .invoice-table td {
                    padding: 20px 0;
                    border-bottom: 1px solid #f1f5f9;
                    font-size: 14px;
                }
                
                .invoice-table td.text-center { text-align: center; }
                .invoice-table td.text-right { text-align: right; }
                
                .item-desc-title {
                    font-weight: 600;
                    color: #0f172a;
                    margin-bottom: 4px;
                }
                
                .item-desc-sub {
                    font-size: 13px;
                    color: #64748b;
                }
                
                .invoice-totals-section {
                    display: flex;
                    justify-content: space-between;
                    padding: 0 40px 40px;
                    gap: 40px;
                }
                
                .invoice-note-container {
                    flex: 1.2;
                }
                
                .invoice-note-box {
                    background: #f8fafc;
                    padding: 20px;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                }
                
                .invoice-note-title {
                    font-weight: 600;
                    font-size: 14px;
                    color: #0f172a;
                    margin-bottom: 8px;
                }
                
                .invoice-note-text {
                    font-size: 13px;
                    color: #475569;
                    line-height: 1.5;
                }
                
                .invoice-totals-container {
                    width: 300px;
                    flex-shrink: 0;
                }
                
                .invoice-totals-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 16px 0;
                    border-bottom: 1px solid #e2e8f0;
                }
                
                .invoice-totals-row.subtotal-row {
                    padding-top: 0;
                }
                
                .invoice-totals-row.grand-total-row {
                    border-bottom: none;
                    padding-bottom: 0;
                    padding-top: 20px;
                    align-items: center;
                }
                
                .invoice-totals-row .total-label {
                    color: #0f172a;
                    font-weight: 700;
                    font-size: 18px;
                }
                
                .invoice-totals-row .total-value {
                    color: #2563eb;
                    font-weight: 800;
                    font-size: 24px;
                }
                
                .mobile-only {
                    display: none !important;
                }
                .desktop-only {
                    display: block !important;
                }
                
                .invoice-mobile-details {
                    padding: 24px 20px;
                    display: none;
                    flex-direction: column;
                    gap: 12px;
                    border-bottom: 1px solid #e2e8f0;
                }
                
                .mobile-detail-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 14px;
                    color: #475569;
                }
                
                .mobile-detail-row.header-row {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 4px;
                    border-bottom: 1px dashed #e2e8f0;
                    padding-bottom: 12px;
                    margin-bottom: 4px;
                }
                
                .mobile-detail-title {
                    font-size: 11px;
                    text-transform: uppercase;
                    font-weight: 600;
                    color: #64748b;
                    letter-spacing: 0.5px;
                }
                
                .font-semibold {
                    font-weight: 600;
                    color: #0f172a;
                }
                
                @media (max-width: 768px) {
                    .mobile-only {
                        display: block !important;
                    }
                    .desktop-only {
                        display: none !important;
                    }
                    .invoice-mobile-details {
                        display: flex !important;
                    }
                    
                    .invoice-preview-container {
                        padding: 80px 12px 16px;
                    }
                    .no-print {
                        margin-bottom: 16px;
                    }
                    .invoice-header {
                        flex-direction: column;
                        padding: 24px 20px;
                        gap: 20px;
                        align-items: stretch;
                    }
                    .invoice-header-title h1 {
                        font-size: 22px;
                    }
                    .invoice-header-company-details {
                        text-align: left;
                    }
                    .invoice-info-section {
                        flex-direction: column;
                        padding: 24px 20px;
                        gap: 20px;
                    }
                    .invoice-info-right {
                        text-align: left;
                    }
                    .invoice-dates-wrapper {
                        justify-content: flex-start;
                        gap: 16px;
                    }
                    .invoice-table-area {
                        padding: 20px;
                    }
                    .invoice-totals-section {
                        flex-direction: column-reverse;
                        padding: 0 20px 24px;
                        gap: 24px;
                    }
                    .invoice-totals-container {
                        width: 100%;
                    }
                }
                
                @media print {
                    /* Hide sidebar, dashboard controls, navigation header and print action buttons */
                    .admin-sidebar,
                    .sidebar-toggle,
                    .no-print,
                    .sidebar-icon-btn,
                    #mobile-header-actions,
                    .mobile-header-actions {
                        display: none !important;
                    }
                    
                    /* Reset html, body, main layout wrappers to allow normal print document flow */
                    html, body, #root, .admin-layout, .invoice-preview-container {
                        background: white !important;
                        background-color: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        min-height: auto !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        overflow: visible !important;
                        position: static !important;
                    }
                    
                    .admin-content {
                        margin-left: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        min-height: auto !important;
                        width: 100% !important;
                        position: static !important;
                    }
                    
                    /* Reset the print area card to act as a standard full-width page block */
                    .invoice-print-area {
                        margin: 0 auto !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        width: 100% !important;
                        max-width: 800px !important;
                        background: white !important;
                        position: static !important;
                    }
                }
            `}})]})},Re=()=>{const[i,v]=o.useState([]),[N,r]=o.useState([]),[p,x]=o.useState(!0),[w,m]=o.useState(!1),[l,s]=o.useState(null),[n,h]=o.useState("all"),[u,b]=o.useState(""),[g,z]=o.useState("date"),k=new Date,[D,G]=o.useState(k.getMonth()+1),[I,q]=o.useState(k.getFullYear()),[P,F]=o.useState(""),T=X(),[C,A]=o.useState(!1),[me,H]=o.useState(null);o.useEffect(()=>{H(document.getElementById("mobile-header-actions")),j()},[]),ae(A);const j=async()=>{x(!0);try{const[t,a]=await Promise.all([J(),K()]);t.success&&v(t.data),a.success&&(r(a.data),a.data.length>0&&F(a.data[0]._id))}catch(t){console.error("Error loading company invoices:",t)}finally{x(!1)}},Y=async t=>{t.preventDefault();try{const a=await Z({companyId:P,month:D,year:I});a.success?(alert("Factura generada con éxito"),m(!1),j()):alert(a.error||"No se pudo generar la factura")}catch(a){console.error(a),alert("Error al generar la factura")}},c=t=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:0}).format(t||0),E=t=>t?t>=1e6?`$${Math.round(t/1e6)}M`:t>=1e3?`$${Math.round(t/1e3)}k`:`$${t}`:"$0",f=i.filter(t=>{var a;if(n!=="all"){const d=n==="completed"?"PAID":"PENDING";if(t.status!==d)return!1}if(u){const d=u.toLowerCase();return t.invoiceNumber.toLowerCase().includes(d)||(((a=t.companyId)==null?void 0:a.name)||"").toLowerCase().includes(d)}return!0}),y=[...f].sort((t,a)=>{var d,R;return g==="date"?a.year!==t.year?a.year-t.year:a.month-t.month:g==="amount"?a.amountDue-t.amountDue:g==="company"?(((d=t.companyId)==null?void 0:d.name)||"").localeCompare(((R=a.companyId)==null?void 0:R.name)||""):0}),B=f.reduce((t,a)=>t+(a.totalPaymentsAmount||0),0),M=f.reduce((t,a)=>t+(a.amountDue||0),0),U=f.filter(t=>t.status==="PAID").length,Q=f.length;return l?e.jsx(xe,{invoice:l,onBack:()=>s(null)}):e.jsxs("div",{className:"payments-page",children:[e.jsx("style",{children:`
                @media (max-width: 768px) {
                    .payments-page .page-header {
                        display: none !important;
                    }
                }
            `}),e.jsx(ie,{title:e.jsxs("span",{style:{display:"flex",alignItems:"center",gap:"10px",color:"#0f172a",margin:0,fontSize:"24px",fontWeight:"bold"},children:[e.jsx(W,{size:28,color:"#2563eb"}),"Facturas de Empresas"]}),onRefresh:j,loading:p,refreshText:"Actualizar",onFilterToggle:()=>A(!C),showFilters:C,desktopActions:e.jsxs("button",{onClick:()=>m(!0),className:"btn-primary",children:[e.jsx(O,{size:16})," Generar Factura Mensual"]})}),e.jsx("div",{className:`collapsible-content max-w-[380px] mx-auto md:hidden ${C?"expanded":""}`,id:"filterSection",children:e.jsxs("div",{className:"pt-2 pb-1",children:[e.jsxs("div",{className:"search-box",style:{maxWidth:"none",marginBottom:".5rem"},children:[e.jsx($,{className:"search-icon",size:18}),e.jsx("input",{type:"text",placeholder:"Buscar por factura o empresa...",value:u,onChange:t=>b(t.target.value)}),u&&e.jsx("button",{type:"button",className:"clear-search",onClick:()=>b(""),children:e.jsx(_,{size:16})})]}),e.jsxs("div",{style:{display:"flex",gap:"8px",overflowX:"auto"},children:[e.jsx("button",{type:"button",style:{padding:"4px 12px",borderRadius:"9999px",fontSize:"12px",fontWeight:500,whiteSpace:"nowrap",border:n==="all"?"1px solid #2563eb":"1px solid #e5e7eb",backgroundColor:n==="all"?"#2563eb":"white",color:n==="all"?"white":"#4b5563"},onClick:()=>{h("all")},children:"Todos"}),e.jsx("button",{type:"button",style:{padding:"4px 12px",borderRadius:"9999px",fontSize:"12px",fontWeight:500,whiteSpace:"nowrap",border:n==="completed"?"1px solid #2563eb":"1px solid #e5e7eb",backgroundColor:n==="completed"?"#2563eb":"white",color:n==="completed"?"white":"#4b5563"},onClick:()=>{h("completed")},children:"Pagadas"}),e.jsx("button",{type:"button",style:{padding:"4px 12px",borderRadius:"9999px",fontSize:"12px",fontWeight:500,whiteSpace:"nowrap",border:n==="pending"?"1px solid #2563eb":"1px solid #e5e7eb",backgroundColor:n==="pending"?"#2563eb":"white",color:n==="pending"?"white":"#4b5563"},onClick:()=>{h("pending")},children:"Pendientes"})]}),e.jsxs("div",{style:{display:"flex",gap:"8px",alignItems:"center"},children:[e.jsxs("select",{className:"sort-select",value:g,onChange:t=>z(t.target.value),style:{flexGrow:1,padding:"8px 12px"},children:[e.jsx("option",{value:"date",children:"Ordenar por Fecha"}),e.jsx("option",{value:"amount",children:"Ordenar por Monto"}),e.jsx("option",{value:"company",children:"Ordenar por Empresa"})]}),e.jsx("button",{className:"filter-action-btn",onClick:j,style:{height:"38px",width:"38px",padding:0,display:"flex",alignItems:"center",justifyContent:"center"},title:"Actualizar",children:e.jsx(ne,{size:18})}),e.jsx("button",{className:"filter-action-btn filter-action-btn--primary",onClick:()=>m(!0),style:{height:"38px",width:"38px",padding:0,display:"flex",alignItems:"center",justifyContent:"center"},title:"Generar Factura",children:e.jsx(O,{size:18})})]})]})}),e.jsxs("div",{className:"payment-stats",children:[e.jsxs("div",{className:"payment-stat-card",children:[e.jsx("div",{className:"stat-icon",style:{background:"#00C292"},children:e.jsx(oe,{size:20})}),e.jsxs("div",{className:"stat-info",children:[e.jsx("div",{className:"stat-label",children:"Total Recaudado"}),e.jsx("div",{className:"stat-value-container",children:e.jsxs("span",{className:"stat-number",children:[e.jsx("span",{className:"desktop-only",children:c(B)}),e.jsx("span",{className:"mobile-only",children:E(B)})]})})]})]}),e.jsxs("div",{className:"payment-stat-card",children:[e.jsx("div",{className:"stat-icon",style:{background:"#EF4444"},children:e.jsx(re,{size:20})}),e.jsxs("div",{className:"stat-info",children:[e.jsx("div",{className:"stat-label",children:"Monto a Pagar"}),e.jsx("div",{className:"stat-value-container",children:e.jsxs("span",{className:"stat-number",children:[e.jsx("span",{className:"desktop-only",children:c(M)}),e.jsx("span",{className:"mobile-only",children:E(M)})]})})]})]}),e.jsxs("div",{className:"payment-stat-card",children:[e.jsx("div",{className:"stat-icon",style:{background:"var(--brand-teal)"},children:e.jsx(le,{size:20})}),e.jsxs("div",{className:"stat-info",children:[e.jsx("div",{className:"stat-label",children:"Pagadas"}),e.jsx("div",{className:"stat-number",children:U})]})]}),e.jsxs("div",{className:"payment-stat-card",children:[e.jsx("div",{className:"stat-icon",style:{background:"#7460EE"},children:e.jsx(ce,{size:20})}),e.jsxs("div",{className:"stat-info",children:[e.jsx("div",{className:"stat-label",children:"Total Facturas"}),e.jsx("div",{className:"stat-number",children:Q})]})]})]}),e.jsxs("div",{className:"payment-controls hidden md:flex",children:[e.jsxs("div",{className:"payment-filters",children:[e.jsx("button",{className:`filter-btn ${n==="all"?"active":""}`,onClick:()=>h("all"),children:"Todos"}),e.jsx("button",{className:`filter-btn ${n==="completed"?"active":""}`,onClick:()=>h("completed"),children:"Pagadas"}),e.jsx("button",{className:`filter-btn ${n==="pending"?"active":""}`,onClick:()=>h("pending"),children:"Pendientes"}),e.jsxs("div",{className:"search-box",children:[e.jsx($,{className:"search-icon"}),e.jsx("input",{type:"text",placeholder:"Buscar por factura o empresa...",value:u,onChange:t=>b(t.target.value)}),u&&e.jsx("button",{className:"clear-search",onClick:()=>b(""),children:e.jsx(_,{})})]})]}),e.jsxs("select",{className:"sort-select",value:g,onChange:t=>z(t.target.value),children:[e.jsx("option",{value:"date",children:"Ordenar por Fecha"}),e.jsx("option",{value:"amount",children:"Ordenar por Monto"}),e.jsx("option",{value:"company",children:"Ordenar por Empresa"})]})]}),e.jsx("div",{className:"payments-table-container desktop-only",children:p?e.jsxs("div",{className:"loading-state",children:[e.jsx("div",{className:"spinner"}),e.jsx("p",{children:"Cargando facturas..."})]}):e.jsxs("table",{className:"payments-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Factura #"}),e.jsx("th",{children:"Empresa"}),e.jsx("th",{children:"Periodo"}),e.jsx("th",{children:"Transacciones"}),e.jsx("th",{children:"Total Recaudado"}),e.jsx("th",{children:"Monto a Pagar"}),e.jsx("th",{children:"Estado"}),e.jsx("th",{style:{textAlign:"center"},children:"Acciones"})]})}),e.jsxs("tbody",{children:[y.map(t=>{var a;return e.jsxs("tr",{children:[e.jsx("td",{className:"payment-id",children:e.jsx("code",{children:t.invoiceNumber})}),e.jsx("td",{children:e.jsx("strong",{children:((a=t.companyId)==null?void 0:a.name)||"Unknown"})}),e.jsxs("td",{className:"date",children:[t.month.toString().padStart(2,"0"),"/",t.year]}),e.jsx("td",{children:t.totalTransactions}),e.jsx("td",{className:"amount",style:{color:"#00C292"},children:c(t.totalPaymentsAmount)}),e.jsx("td",{className:"amount",style:{color:"#EF4444"},children:c(t.amountDue)}),e.jsx("td",{children:e.jsx(se,{status:t.status})}),e.jsx("td",{style:{textAlign:"center"},children:e.jsxs("div",{style:{display:"flex",gap:"12px",justifyContent:"center"},children:[e.jsx("button",{onClick:()=>s(t),title:"Ver / Imprimir Factura",style:{background:"none",border:"none",cursor:"pointer",color:"#2563eb"},children:e.jsx(S,{size:18})}),e.jsx("button",{onClick:()=>T("/reports"),title:"Ver Detalles (Reconciliación)",style:{background:"none",border:"none",cursor:"pointer",color:"#10b981"},children:e.jsx(L,{size:18})})]})})]},t._id)}),y.length===0&&e.jsx("tr",{children:e.jsx("td",{colSpan:"8",style:{textAlign:"center",color:"#6B7280",padding:"24px"},children:"No se encontraron facturas de empresas."})})]})]})}),e.jsxs("div",{className:"invoice-cards-container mobile-only",children:[p?e.jsxs("div",{className:"loading-state",children:[e.jsx("div",{className:"spinner"}),e.jsx("p",{children:"Cargando facturas..."})]}):y.map(t=>{var a;return e.jsxs("div",{className:"invoice-card",children:[e.jsxs("div",{className:"invoice-card-row1",children:[e.jsx("span",{className:"invoice-card-number",children:t.invoiceNumber}),e.jsx("span",{className:`invoice-card-badge status-${t.status.toLowerCase()}`,children:t.status==="PAID"?"PAGADO":"PENDIENTE"}),e.jsxs("div",{className:"invoice-card-options",children:[e.jsx("button",{onClick:()=>s(t),title:"Ver / Imprimir Factura",style:{background:"transparent",border:"none",cursor:"pointer",color:"#8e8e93"},children:e.jsx(S,{size:18})}),e.jsx("button",{onClick:()=>T("/reports"),title:"Ver Detalles (Reconciliación)",style:{background:"transparent",border:"none",cursor:"pointer",color:"#10b981",marginLeft:"12px"},children:e.jsx(L,{size:18})})]})]}),e.jsxs("div",{className:"invoice-card-row2",children:[e.jsxs("span",{className:"invoice-card-amount-due",children:[c(t.amountDue)," COP"]}),e.jsxs("span",{className:"invoice-card-tx-count",children:[t.totalTransactions," transacciones"]})]}),e.jsxs("div",{className:"invoice-card-row3",children:[e.jsx("span",{className:"invoice-card-company-name",children:((a=t.companyId)==null?void 0:a.name)||"Unknown"}),e.jsxs("span",{className:"invoice-card-total-payments",children:[c(t.totalPaymentsAmount)," COP"]})]}),e.jsx("div",{className:"invoice-card-divider"}),e.jsxs("div",{className:"invoice-card-footer",children:[e.jsxs("span",{className:"invoice-card-footer-payments",children:[e.jsx("span",{style:{color:"#10b981",marginRight:"6px",fontWeight:"bold"},children:"✓"}),c(t.totalPaymentsAmount)," COP"]}),e.jsxs("span",{className:"invoice-card-footer-period",children:[e.jsx("span",{style:{marginRight:"6px"},children:"📅"}),t.month.toString().padStart(2,"0"),"/",t.year]})]})]},t._id)}),!p&&y.length===0&&e.jsxs("div",{className:"empty-state",style:{padding:"40px 20px",background:"white",borderRadius:"12px",border:"1px solid #E5E7EB"},children:[e.jsx(W,{size:48,style:{color:"#9CA3AF",marginBottom:"12px"}}),e.jsx("h3",{style:{margin:"0 0 8px 0",fontSize:"16px",color:"#374151"},children:"No se encontraron facturas"}),e.jsx("p",{style:{margin:0,fontSize:"14px",color:"#6B7280"},children:"No hay registros de facturas que coincidan con los filtros."})]})]}),w&&e.jsx("div",{style:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1e3},children:e.jsxs("div",{style:{background:"white",padding:"24px",borderRadius:"12px",width:"400px",maxWidth:"90%",boxShadow:"0 4px 6px rgba(0,0,0,0.1)"},children:[e.jsx("h2",{style:{margin:"0 0 16px 0",fontSize:"18px",color:"#1F2937",fontWeight:"600"},children:"Generar Factura Mensual"}),e.jsxs("form",{onSubmit:Y,children:[e.jsxs("div",{style:{marginBottom:"16px"},children:[e.jsx("label",{style:{display:"block",marginBottom:"8px",fontSize:"14px",color:"#4B5563",fontWeight:"500"},children:"Empresa"}),e.jsxs("select",{required:!0,value:P,onChange:t=>F(t.target.value),style:{width:"100%",padding:"8px 12px",borderRadius:"6px",border:"1px solid #D1D5DB",color:"#1F2937",background:"white",fontSize:"14px"},children:[e.jsx("option",{value:"",children:"Seleccione una empresa"}),N.map(t=>e.jsx("option",{value:t._id,children:t.name},t._id))]})]}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px",marginBottom:"24px"},children:[e.jsxs("div",{children:[e.jsx("label",{style:{display:"block",marginBottom:"8px",fontSize:"14px",color:"#4B5563",fontWeight:"500"},children:"Mes"}),e.jsx("select",{value:D,onChange:t=>G(Number(t.target.value)),style:{width:"100%",padding:"8px 12px",borderRadius:"6px",border:"1px solid #D1D5DB",color:"#1F2937",background:"white",fontSize:"14px"},children:Array.from({length:12},(t,a)=>a+1).map(t=>e.jsx("option",{value:t,children:new Date(2e3,t-1).toLocaleString("es",{month:"long"}).replace(/^\w/,a=>a.toUpperCase())},`m-${t}`))})]}),e.jsxs("div",{children:[e.jsx("label",{style:{display:"block",marginBottom:"8px",fontSize:"14px",color:"#4B5563",fontWeight:"500"},children:"Año"}),e.jsx("select",{value:I,onChange:t=>q(Number(t.target.value)),style:{width:"100%",padding:"8px 12px",borderRadius:"6px",border:"1px solid #D1D5DB",color:"#1F2937",background:"white",fontSize:"14px"},children:Array.from({length:5},(t,a)=>k.getFullYear()-2+a).map(t=>e.jsx("option",{value:t,children:t},`y-${t}`))})]})]}),e.jsxs("div",{style:{display:"flex",justifyContent:"flex-end",gap:"12px"},children:[e.jsx("button",{type:"button",onClick:()=>m(!1),style:{padding:"8px 16px",border:"1px solid #D1D5DB",background:"white",color:"#4B5563",borderRadius:"6px",cursor:"pointer",fontSize:"14px",fontWeight:"500"},children:"Cancelar"}),e.jsx("button",{type:"submit",className:"btn-primary",children:"Generar"})]})]})]})})]})};export{Re as default};
