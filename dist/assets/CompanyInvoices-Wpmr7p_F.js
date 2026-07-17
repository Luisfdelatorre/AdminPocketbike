import{r as o,j as e,a as J,Y as K,C as ee,c as te,Z as ae}from"./main-jg77UOhJ.js";import{A as se}from"./arrow-left-CSO5xapc.js";import{c as Y}from"./createLucideIcon-D2xezgGJ.js";import{C as ne}from"./circle-check-big-DfbhSQYW.js";/* empty css                 *//* empty css              */import{L as ie}from"./list-filter-4JbzJB0J.js";import{B as W}from"./building-Dy0VinhC.js";import{R as $}from"./refresh-cw-ZqkucF0Y.js";import{P as L}from"./plus-Bh0__VtC.js";import{S as _}from"./search-C1BAPe1N.js";import{X as G}from"./x-jNe2HLEK.js";import{D as oe}from"./dollar-sign-CsJ6RFSC.js";import{T as re}from"./trending-down-DiVdWKC6.js";import{C as le}from"./check-CwJvRsk4.js";import{F as ce}from"./file-text-BjDdydar.js";/**
 * @license lucide-react v0.562.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const de=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M8 13h2",key:"yr2amv"}],["path",{d:"M14 13h2",key:"un5t4a"}],["path",{d:"M8 17h2",key:"2yhykz"}],["path",{d:"M14 17h2",key:"10kma7"}]],V=Y("file-spreadsheet",de);/**
 * @license lucide-react v0.562.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pe=[["path",{d:"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",key:"143wyd"}],["path",{d:"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6",key:"1itne7"}],["rect",{x:"6",y:"14",width:"12",height:"8",rx:"1",key:"1ue0tg"}]],D=Y("printer",pe),xe=({invoice:s,onBack:w})=>{const k=()=>{window.print()},l=n=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:0}).format(n||0);new Date(s.dueDate).toLocaleDateString("es-CO");const g=new Date(s.issuedAt).toLocaleDateString("es-CO"),p=s.subtotal||0,C=s.tax||0,x=s.amountDue||0,c=s.companyId||{};return o.useEffect(()=>{const n=document.querySelector(".mobile-header h2");let i="";return n&&(i=n.innerText,n.innerText=c.name||"Factura"),()=>{n&&i&&(n.innerText=i)}},[c.name]),e.jsxs("div",{className:"invoice-preview-container",children:[e.jsxs("div",{className:"no-print",children:[e.jsxs("button",{onClick:w,style:{display:"flex",alignItems:"center",gap:"8px",padding:"10px 20px",background:"white",color:"#475569",border:"1px solid #cbd5e1",borderRadius:"8px",cursor:"pointer",fontSize:"14px",fontWeight:"500",transition:"all 0.2s",boxShadow:"0 1px 2px rgba(0,0,0,0.05)"},onMouseOver:n=>n.currentTarget.style.backgroundColor="#f8fafc",onMouseOut:n=>n.currentTarget.style.backgroundColor="white",children:[e.jsx(se,{size:16})," Volver al listado"]}),e.jsxs("button",{onClick:k,style:{display:"flex",alignItems:"center",gap:"8px",padding:"10px 20px",background:"#3b82f6",color:"white",border:"none",borderRadius:"8px",cursor:"pointer",fontSize:"14px",fontWeight:"600",transition:"all 0.2s",boxShadow:"0 4px 6px -1px rgba(59, 130, 246, 0.3)"},onMouseOver:n=>n.currentTarget.style.transform="translateY(-1px)",onMouseOut:n=>n.currentTarget.style.transform="none",children:[e.jsx(D,{size:16})," Imprimir / PDF"]})]}),e.jsxs("div",{className:"invoice-print-area",children:[e.jsxs("div",{className:"invoice-header",children:[e.jsxs("div",{className:"invoice-header-title",children:[e.jsx("h1",{children:"RESUMEN DE COMISIÓN"}),e.jsxs("div",{className:"invoice-number",children:["Factura #: ",s.invoiceNumber]})]}),e.jsxs("div",{className:"invoice-header-company-details",children:[e.jsx("div",{className:"company-name",children:"Pocketbike S.A.S"}),e.jsx("div",{className:"company-info-text",children:"NIT: 901366393-9"}),e.jsx("div",{className:"company-info-text",children:"Turbaco, Colombia"}),e.jsx("div",{className:"company-email",children:"billing@pocketbike.app"})]})]}),e.jsxs("div",{className:"invoice-info-section",children:[e.jsxs("div",{className:"invoice-info-left",children:[e.jsx("div",{className:"section-title-label",children:"Facturado a"}),e.jsx("div",{className:"company-name-bold",children:c.name||"COMPANY NAME"}),c.nit&&e.jsxs("div",{className:"info-text-row",children:["NIT: ",c.nit]}),e.jsx("div",{className:"info-text-row",children:c.address||"Address not provided"})]}),e.jsxs("div",{className:"invoice-info-right",children:[e.jsxs("div",{className:"invoice-dates-wrapper",children:[e.jsxs("div",{className:"invoice-date-col",style:{marginRight:"16px"},children:[e.jsx("div",{className:"section-title-label",style:{marginBottom:"4px"},children:"Fecha de Emisión"}),e.jsx("div",{className:"invoice-date-val",children:g})]}),e.jsxs("div",{className:"invoice-date-col",children:[e.jsx("div",{className:"section-title-label",style:{marginBottom:"4px"},children:"Periodo"}),e.jsxs("div",{className:"invoice-date-val",children:[s.month.toString().padStart(2,"0"),"/",s.year]})]})]}),e.jsxs("div",{className:"status-pill",children:[e.jsx(ne,{size:14}),"Pre-Retenido"]})]})]}),e.jsx("div",{className:"invoice-table-area desktop-only",children:e.jsxs("table",{className:"invoice-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{className:"text-left",children:"Descripción"}),e.jsx("th",{className:"text-center",children:"Transacciones"}),e.jsx("th",{className:"text-right",children:"Volumen Total"}),e.jsx("th",{className:"text-right",children:"Retenido"})]})}),e.jsx("tbody",{children:e.jsxs("tr",{children:[e.jsxs("td",{children:[e.jsx("div",{className:"item-desc-title",children:"Comisión por Procesamiento de Pagos"}),e.jsxs("div",{className:"item-desc-sub",children:["Comisión retenida del volumen total procesado para ",s.month.toString().padStart(2,"0"),"/",s.year]})]}),e.jsx("td",{className:"text-center",style:{color:"#334155"},children:s.totalTransactions}),e.jsx("td",{className:"text-right",style:{color:"#334155"},children:l(s.totalPaymentsAmount)}),e.jsx("td",{className:"text-right",style:{fontWeight:"600",color:"#0f172a"},children:l(p)})]})})]})}),e.jsxs("div",{className:"invoice-mobile-details mobile-only",children:[e.jsxs("div",{className:"mobile-detail-row header-row",children:[e.jsx("span",{className:"mobile-detail-title",children:"Descripción"}),e.jsx("span",{className:"font-semibold",style:{fontSize:"15px"},children:"Comisión por Procesamiento de Pagos"}),e.jsxs("div",{className:"item-desc-sub",style:{fontSize:"12px"},children:["Comisión retenida del volumen total procesado para ",s.month.toString().padStart(2,"0"),"/",s.year]})]}),e.jsxs("div",{className:"mobile-detail-row",children:[e.jsx("span",{children:"Transacciones"}),e.jsx("span",{className:"font-semibold",children:s.totalTransactions})]}),e.jsxs("div",{className:"mobile-detail-row",children:[e.jsx("span",{children:"Volumen Total"}),e.jsxs("span",{className:"font-semibold",children:[l(s.totalPaymentsAmount)," COP"]})]}),e.jsxs("div",{className:"mobile-detail-row",children:[e.jsx("span",{children:"Retenido"}),e.jsxs("span",{className:"font-semibold",style:{color:"#0f172a"},children:[l(p)," COP"]})]})]}),e.jsxs("div",{className:"invoice-totals-section",children:[e.jsx("div",{className:"invoice-note-container",children:e.jsxs("div",{className:"invoice-note-box",children:[e.jsx("div",{className:"invoice-note-title",children:"Nota Importante"}),e.jsxs("div",{className:"invoice-note-text",children:["Este es un resumen de las comisiones que ",e.jsx("strong",{children:"ya han sido pre-retenidas"})," de sus transacciones diarias.",e.jsx("span",{style:{color:"#dc2626",fontWeight:"600",display:"block",marginTop:"8px"},children:"No realice ninguna transferencia por este valor. No se requiere ninguna acción de su parte."})]})]})}),e.jsxs("div",{className:"invoice-totals-container",children:[e.jsxs("div",{className:"invoice-totals-row subtotal-row",children:[e.jsx("span",{style:{color:"#475569",fontWeight:"500"},children:"Subtotal"}),e.jsx("span",{style:{color:"#0f172a",fontWeight:"600"},children:l(p)})]}),e.jsxs("div",{className:"invoice-totals-row",children:[e.jsx("span",{style:{color:"#475569",fontWeight:"500"},children:"IVA"}),e.jsx("span",{style:{color:"#0f172a",fontWeight:"600"},children:l(C)})]}),e.jsxs("div",{className:"invoice-totals-row grand-total-row",children:[e.jsx("span",{className:"total-label",children:"Total Retenido"}),e.jsx("span",{className:"total-value",children:l(x)})]})]})]})]}),e.jsx("style",{dangerouslySetInnerHTML:{__html:`
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
            `}})]})},Ie=()=>{const[s,w]=o.useState([]),[k,l]=o.useState([]),[g,p]=o.useState(!0),[C,x]=o.useState(!1),[c,n]=o.useState(null),[i,m]=o.useState("all"),[h,y]=o.useState(""),[f,I]=o.useState("date"),S=new Date,[P,q]=o.useState(S.getMonth()+1),[E,H]=o.useState(S.getFullYear()),[A,F]=o.useState(""),T=J(),[u,z]=o.useState(!1),[M,U]=o.useState(null);o.useEffect(()=>{U(document.getElementById("mobile-header-actions")),v()},[]),o.useEffect(()=>{let t=window.scrollY;const a=()=>{const r=window.scrollY,j=r-t;j>10?u&&z(!1):j<-15&&(u||z(!0)),t=r};return window.addEventListener("scroll",a,{passive:!0}),()=>window.removeEventListener("scroll",a)},[u]);const v=async()=>{p(!0);try{const[t,a]=await Promise.all([K(),ee()]);t.success&&w(t.data),a.success&&(l(a.data),a.data.length>0&&F(a.data[0]._id))}catch(t){console.error("Error loading company invoices:",t)}finally{p(!1)}},Q=async t=>{t.preventDefault();try{const a=await ae({companyId:A,month:P,year:E});a.success?(alert("Factura generada con éxito"),x(!1),v()):alert(a.error||"No se pudo generar la factura")}catch(a){console.error(a),alert("Error al generar la factura")}},d=t=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:0}).format(t||0),R=t=>t?t>=1e6?`$${Math.round(t/1e6)}M`:t>=1e3?`$${Math.round(t/1e3)}k`:`$${t}`:"$0",b=s.filter(t=>{var a;if(i!=="all"){const r=i==="completed"?"PAID":"PENDING";if(t.status!==r)return!1}if(h){const r=h.toLowerCase();return t.invoiceNumber.toLowerCase().includes(r)||(((a=t.companyId)==null?void 0:a.name)||"").toLowerCase().includes(r)}return!0}),N=[...b].sort((t,a)=>{var r,j;return f==="date"?a.year!==t.year?a.year-t.year:a.month-t.month:f==="amount"?a.amountDue-t.amountDue:f==="company"?(((r=t.companyId)==null?void 0:r.name)||"").localeCompare(((j=a.companyId)==null?void 0:j.name)||""):0}),B=b.reduce((t,a)=>t+(a.totalPaymentsAmount||0),0),O=b.reduce((t,a)=>t+(a.amountDue||0),0),X=b.filter(t=>t.status==="PAID").length,Z=b.length;return c?e.jsx(xe,{invoice:c,onBack:()=>n(null)}):e.jsxs("div",{className:"payments-page",children:[e.jsx("style",{children:`
                @media (max-width: 768px) {
                    .payments-page .page-header {
                        display: none !important;
                    }
                }
            `}),M&&te.createPortal(e.jsx("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:e.jsx("button",{type:"button",className:`p-2 rounded-full transition-colors flex items-center justify-center ${u?"bg-blue-50 text-blue-600":"text-gray-500 hover:bg-gray-100"}`,onClick:()=>z(!u),id:"filterToggle",style:{border:"none",background:"none",padding:"8px"},children:e.jsx(ie,{size:20})})}),M),e.jsxs("div",{className:"page-header",children:[e.jsxs("div",{children:[e.jsxs("h1",{style:{display:"flex",alignItems:"center",gap:"10px",color:"#0f172a",margin:0,fontSize:"24px",fontWeight:"bold"},children:[e.jsx(W,{size:28,color:"#2563eb"}),"Facturas de Empresas"]}),e.jsx("p",{style:{color:"#64748b",margin:"4px 0 0 0",fontSize:"14px"},children:"Historial de facturación para sus clientes"})]}),e.jsxs("div",{style:{display:"flex",gap:"8px",alignItems:"center"},children:[e.jsxs("button",{onClick:v,className:"btn-primary",style:{display:"flex",alignItems:"center",gap:"6px"},children:[e.jsx($,{size:16})," Actualizar"]}),e.jsxs("button",{onClick:()=>x(!0),className:"btn-primary",style:{display:"flex",alignItems:"center",gap:"6px",background:"#2563eb"},children:[e.jsx(L,{size:16})," Generar Factura Mensual"]})]})]}),e.jsx("div",{className:`collapsible-content max-w-[380px] mx-auto md:hidden ${u?"expanded":""}`,id:"filterSection",children:e.jsxs("div",{className:"pt-2 pb-1",children:[e.jsxs("div",{className:"search-box",style:{maxWidth:"none",marginBottom:".5rem"},children:[e.jsx(_,{className:"search-icon",size:18}),e.jsx("input",{type:"text",placeholder:"Buscar por factura o empresa...",value:h,onChange:t=>y(t.target.value)}),h&&e.jsx("button",{type:"button",className:"clear-search",onClick:()=>y(""),children:e.jsx(G,{size:16})})]}),e.jsxs("div",{style:{display:"flex",gap:"8px",overflowX:"auto"},children:[e.jsx("button",{type:"button",style:{padding:"4px 12px",borderRadius:"9999px",fontSize:"12px",fontWeight:500,whiteSpace:"nowrap",border:i==="all"?"1px solid #2563eb":"1px solid #e5e7eb",backgroundColor:i==="all"?"#2563eb":"white",color:i==="all"?"white":"#4b5563"},onClick:()=>{m("all")},children:"Todos"}),e.jsx("button",{type:"button",style:{padding:"4px 12px",borderRadius:"9999px",fontSize:"12px",fontWeight:500,whiteSpace:"nowrap",border:i==="completed"?"1px solid #2563eb":"1px solid #e5e7eb",backgroundColor:i==="completed"?"#2563eb":"white",color:i==="completed"?"white":"#4b5563"},onClick:()=>{m("completed")},children:"Pagadas"}),e.jsx("button",{type:"button",style:{padding:"4px 12px",borderRadius:"9999px",fontSize:"12px",fontWeight:500,whiteSpace:"nowrap",border:i==="pending"?"1px solid #2563eb":"1px solid #e5e7eb",backgroundColor:i==="pending"?"#2563eb":"white",color:i==="pending"?"white":"#4b5563"},onClick:()=>{m("pending")},children:"Pendientes"})]}),e.jsxs("div",{style:{display:"flex",gap:"8px",alignItems:"center"},children:[e.jsxs("select",{className:"sort-select",value:f,onChange:t=>I(t.target.value),style:{flexGrow:1,padding:"8px 12px"},children:[e.jsx("option",{value:"date",children:"Ordenar por Fecha"}),e.jsx("option",{value:"amount",children:"Ordenar por Monto"}),e.jsx("option",{value:"company",children:"Ordenar por Empresa"})]}),e.jsx("button",{className:"filter-action-btn",onClick:v,style:{height:"38px",width:"38px",padding:0,display:"flex",alignItems:"center",justifyContent:"center"},title:"Actualizar",children:e.jsx($,{size:18})}),e.jsx("button",{className:"filter-action-btn",onClick:()=>x(!0),style:{height:"38px",width:"38px",padding:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#2563eb",color:"white"},title:"Generar Factura",children:e.jsx(L,{size:18})})]})]})}),e.jsxs("div",{className:"payment-stats",children:[e.jsxs("div",{className:"payment-stat-card",children:[e.jsx("div",{className:"stat-icon",style:{background:"#00C292"},children:e.jsx(oe,{size:20})}),e.jsxs("div",{className:"stat-info",children:[e.jsx("div",{className:"stat-label",children:"Total Recaudado"}),e.jsx("div",{className:"stat-value-container",children:e.jsxs("span",{className:"stat-number",children:[e.jsx("span",{className:"desktop-only",children:d(B)}),e.jsx("span",{className:"mobile-only",children:R(B)})]})})]})]}),e.jsxs("div",{className:"payment-stat-card",children:[e.jsx("div",{className:"stat-icon",style:{background:"#EF4444"},children:e.jsx(re,{size:20})}),e.jsxs("div",{className:"stat-info",children:[e.jsx("div",{className:"stat-label",children:"Monto a Pagar"}),e.jsx("div",{className:"stat-value-container",children:e.jsxs("span",{className:"stat-number",children:[e.jsx("span",{className:"desktop-only",children:d(O)}),e.jsx("span",{className:"mobile-only",children:R(O)})]})})]})]}),e.jsxs("div",{className:"payment-stat-card",children:[e.jsx("div",{className:"stat-icon",style:{background:"#03C9D7"},children:e.jsx(le,{size:20})}),e.jsxs("div",{className:"stat-info",children:[e.jsx("div",{className:"stat-label",children:"Pagadas"}),e.jsx("div",{className:"stat-number",children:X})]})]}),e.jsxs("div",{className:"payment-stat-card",children:[e.jsx("div",{className:"stat-icon",style:{background:"#7460EE"},children:e.jsx(ce,{size:20})}),e.jsxs("div",{className:"stat-info",children:[e.jsx("div",{className:"stat-label",children:"Total Facturas"}),e.jsx("div",{className:"stat-number",children:Z})]})]})]}),e.jsxs("div",{className:"payment-controls hidden md:flex",children:[e.jsxs("div",{className:"payment-filters",children:[e.jsx("button",{className:`filter-btn ${i==="all"?"active":""}`,onClick:()=>m("all"),children:"Todos"}),e.jsx("button",{className:`filter-btn ${i==="completed"?"active":""}`,onClick:()=>m("completed"),children:"Pagadas"}),e.jsx("button",{className:`filter-btn ${i==="pending"?"active":""}`,onClick:()=>m("pending"),children:"Pendientes"}),e.jsxs("div",{className:"search-box",children:[e.jsx(_,{className:"search-icon"}),e.jsx("input",{type:"text",placeholder:"Buscar por factura o empresa...",value:h,onChange:t=>y(t.target.value)}),h&&e.jsx("button",{className:"clear-search",onClick:()=>y(""),children:e.jsx(G,{})})]})]}),e.jsxs("select",{className:"sort-select",value:f,onChange:t=>I(t.target.value),children:[e.jsx("option",{value:"date",children:"Ordenar por Fecha"}),e.jsx("option",{value:"amount",children:"Ordenar por Monto"}),e.jsx("option",{value:"company",children:"Ordenar por Empresa"})]})]}),e.jsx("div",{className:"payments-table-container desktop-only",children:g?e.jsxs("div",{className:"loading-state",children:[e.jsx("div",{className:"spinner"}),e.jsx("p",{children:"Cargando facturas..."})]}):e.jsxs("table",{className:"payments-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Factura #"}),e.jsx("th",{children:"Empresa"}),e.jsx("th",{children:"Periodo"}),e.jsx("th",{children:"Transacciones"}),e.jsx("th",{children:"Total Recaudado"}),e.jsx("th",{children:"Monto a Pagar"}),e.jsx("th",{children:"Estado"}),e.jsx("th",{style:{textAlign:"center"},children:"Acciones"})]})}),e.jsxs("tbody",{children:[N.map(t=>{var a;return e.jsxs("tr",{children:[e.jsx("td",{className:"payment-id",children:e.jsx("code",{children:t.invoiceNumber})}),e.jsx("td",{children:e.jsx("strong",{children:((a=t.companyId)==null?void 0:a.name)||"Unknown"})}),e.jsxs("td",{className:"date",children:[t.month.toString().padStart(2,"0"),"/",t.year]}),e.jsx("td",{children:t.totalTransactions}),e.jsx("td",{className:"amount",style:{color:"#00C292"},children:d(t.totalPaymentsAmount)}),e.jsx("td",{className:"amount",style:{color:"#EF4444"},children:d(t.amountDue)}),e.jsx("td",{children:e.jsx("span",{className:`status-badge ${t.status==="PAID"?"completed":"pending"}`,children:t.status==="PAID"?"PAGADO":"PENDIENTE"})}),e.jsx("td",{style:{textAlign:"center"},children:e.jsxs("div",{style:{display:"flex",gap:"12px",justifyContent:"center"},children:[e.jsx("button",{onClick:()=>n(t),title:"Ver / Imprimir Factura",style:{background:"none",border:"none",cursor:"pointer",color:"#2563eb"},children:e.jsx(D,{size:18})}),e.jsx("button",{onClick:()=>T("/reports"),title:"Ver Detalles (Reconciliación)",style:{background:"none",border:"none",cursor:"pointer",color:"#10b981"},children:e.jsx(V,{size:18})})]})})]},t._id)}),N.length===0&&e.jsx("tr",{children:e.jsx("td",{colSpan:"8",style:{textAlign:"center",color:"#6B7280",padding:"24px"},children:"No se encontraron facturas de empresas."})})]})]})}),e.jsxs("div",{className:"invoice-cards-container mobile-only",children:[g?e.jsxs("div",{className:"loading-state",children:[e.jsx("div",{className:"spinner"}),e.jsx("p",{children:"Cargando facturas..."})]}):N.map(t=>{var a;return e.jsxs("div",{className:"invoice-card",children:[e.jsxs("div",{className:"invoice-card-row1",children:[e.jsx("span",{className:"invoice-card-number",children:t.invoiceNumber}),e.jsx("span",{className:`invoice-card-badge status-${t.status.toLowerCase()}`,children:t.status==="PAID"?"PAGADO":"PENDIENTE"}),e.jsxs("div",{className:"invoice-card-options",children:[e.jsx("button",{onClick:()=>n(t),title:"Ver / Imprimir Factura",style:{background:"transparent",border:"none",cursor:"pointer",color:"#8e8e93"},children:e.jsx(D,{size:18})}),e.jsx("button",{onClick:()=>T("/reports"),title:"Ver Detalles (Reconciliación)",style:{background:"transparent",border:"none",cursor:"pointer",color:"#10b981",marginLeft:"12px"},children:e.jsx(V,{size:18})})]})]}),e.jsxs("div",{className:"invoice-card-row2",children:[e.jsxs("span",{className:"invoice-card-amount-due",children:[d(t.amountDue)," COP"]}),e.jsxs("span",{className:"invoice-card-tx-count",children:[t.totalTransactions," transacciones"]})]}),e.jsxs("div",{className:"invoice-card-row3",children:[e.jsx("span",{className:"invoice-card-company-name",children:((a=t.companyId)==null?void 0:a.name)||"Unknown"}),e.jsxs("span",{className:"invoice-card-total-payments",children:[d(t.totalPaymentsAmount)," COP"]})]}),e.jsx("div",{className:"invoice-card-divider"}),e.jsxs("div",{className:"invoice-card-footer",children:[e.jsxs("span",{className:"invoice-card-footer-payments",children:[e.jsx("span",{style:{color:"#10b981",marginRight:"6px",fontWeight:"bold"},children:"✓"}),d(t.totalPaymentsAmount)," COP"]}),e.jsxs("span",{className:"invoice-card-footer-period",children:[e.jsx("span",{style:{marginRight:"6px"},children:"📅"}),t.month.toString().padStart(2,"0"),"/",t.year]})]})]},t._id)}),!g&&N.length===0&&e.jsxs("div",{className:"empty-state",style:{padding:"40px 20px",background:"white",borderRadius:"12px",border:"1px solid #E5E7EB"},children:[e.jsx(W,{size:48,style:{color:"#9CA3AF",marginBottom:"12px"}}),e.jsx("h3",{style:{margin:"0 0 8px 0",fontSize:"16px",color:"#374151"},children:"No se encontraron facturas"}),e.jsx("p",{style:{margin:0,fontSize:"14px",color:"#6B7280"},children:"No hay registros de facturas que coincidan con los filtros."})]})]}),C&&e.jsx("div",{style:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1e3},children:e.jsxs("div",{style:{background:"white",padding:"24px",borderRadius:"12px",width:"400px",maxWidth:"90%",boxShadow:"0 4px 6px rgba(0,0,0,0.1)"},children:[e.jsx("h2",{style:{margin:"0 0 16px 0",fontSize:"18px",color:"#1F2937",fontWeight:"600"},children:"Generar Factura Mensual"}),e.jsxs("form",{onSubmit:Q,children:[e.jsxs("div",{style:{marginBottom:"16px"},children:[e.jsx("label",{style:{display:"block",marginBottom:"8px",fontSize:"14px",color:"#4B5563",fontWeight:"500"},children:"Empresa"}),e.jsxs("select",{required:!0,value:A,onChange:t=>F(t.target.value),style:{width:"100%",padding:"8px 12px",borderRadius:"6px",border:"1px solid #D1D5DB",color:"#1F2937",background:"white",fontSize:"14px"},children:[e.jsx("option",{value:"",children:"Seleccione una empresa"}),k.map(t=>e.jsx("option",{value:t._id,children:t.name},t._id))]})]}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px",marginBottom:"24px"},children:[e.jsxs("div",{children:[e.jsx("label",{style:{display:"block",marginBottom:"8px",fontSize:"14px",color:"#4B5563",fontWeight:"500"},children:"Mes"}),e.jsx("select",{value:P,onChange:t=>q(Number(t.target.value)),style:{width:"100%",padding:"8px 12px",borderRadius:"6px",border:"1px solid #D1D5DB",color:"#1F2937",background:"white",fontSize:"14px"},children:Array.from({length:12},(t,a)=>a+1).map(t=>e.jsx("option",{value:t,children:new Date(2e3,t-1).toLocaleString("es",{month:"long"}).replace(/^\w/,a=>a.toUpperCase())},`m-${t}`))})]}),e.jsxs("div",{children:[e.jsx("label",{style:{display:"block",marginBottom:"8px",fontSize:"14px",color:"#4B5563",fontWeight:"500"},children:"Año"}),e.jsx("select",{value:E,onChange:t=>H(Number(t.target.value)),style:{width:"100%",padding:"8px 12px",borderRadius:"6px",border:"1px solid #D1D5DB",color:"#1F2937",background:"white",fontSize:"14px"},children:Array.from({length:5},(t,a)=>S.getFullYear()-2+a).map(t=>e.jsx("option",{value:t,children:t},`y-${t}`))})]})]}),e.jsxs("div",{style:{display:"flex",justifyContent:"flex-end",gap:"12px"},children:[e.jsx("button",{type:"button",onClick:()=>x(!1),style:{padding:"8px 16px",border:"1px solid #D1D5DB",background:"white",color:"#4B5563",borderRadius:"6px",cursor:"pointer",fontSize:"14px",fontWeight:"500"},children:"Cancelar"}),e.jsx("button",{type:"submit",style:{padding:"8px 16px",border:"none",background:"#2563eb",color:"white",borderRadius:"6px",cursor:"pointer",fontSize:"14px",fontWeight:"500"},children:"Generar"})]})]})]})})]})};export{Ie as default};
