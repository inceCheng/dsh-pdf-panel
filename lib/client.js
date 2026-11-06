window.__ModuleLoader__.load({
	id: "dsh-pdf-panel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
"use strict";var y=Object.defineProperty;var X=Object.getOwnPropertyDescriptor;var Y=Object.getOwnPropertyNames;var ee=Object.prototype.hasOwnProperty;var te=(e,a)=>{for(var r in a)y(e,r,{get:a[r],enumerable:!0})},ne=(e,a,r,t)=>{if(a&&typeof a=="object"||typeof a=="function")for(let d of Y(a))!ee.call(e,d)&&d!==r&&y(e,d,{get:()=>a[d],enumerable:!(t=X(a,d))||t.enumerable});return e};var ae=e=>ne(y({},"__esModule",{value:!0}),e);var ge={};te(ge,{PDF_TAB_KIND:()=>_,apply:()=>ue,inject:()=>ce,name:()=>le});module.exports=ae(ge);var j=require("react"),B=require("@deepseek-ai/dsh-client-ui-primitives");var u="pdfPanel",ie={tabTitle:"PDF \u9605\u8BFB",guideTitle:"PDF \u9605\u8BFB",guideDescription:"\u62D6\u5165 PDF \u9884\u89C8\uFF1B\u9009\u4E2D\u6587\u5B57\u53F3\u952E\u300C\u89E3\u8BFB\u300D\u300C\u7FFB\u8BD1\u300D",emptyTitle:"\u628A PDF \u62D6\u5230\u8FD9\u91CC",emptyHint:"\u4ECE\u684C\u9762\u6216\u8BBF\u8FBE\u62D6\u5165 PDF\uFF1B\u4E5F\u53EF\u4EE5\u70B9\u51FB\u4E0B\u65B9\u6309\u94AE\u9009\u62E9\u6587\u4EF6",dropActive:"\u677E\u5F00\u9F20\u6807\u6253\u5F00 PDF",chooseFile:"\u9009\u62E9 PDF \u6587\u4EF6",openAnother:"\u6253\u5F00\u5176\u4ED6 PDF",unsupported:"\u8FD9\u91CC\u53EA\u652F\u6301 PDF \u6587\u4EF6",readFailed:"\u65E0\u6CD5\u8BFB\u53D6\u8BE5 PDF\uFF0C\u8BF7\u91CD\u8BD5",viewerLoading:"\u6B63\u5728\u51C6\u5907 PDF\u2026",viewerFailed:"PDF \u52A0\u8F7D\u5931\u8D25\uFF1A{message}",retry:"\u91CD\u8BD5",actionExplain:"\u89E3\u8BFB",actionTranslate:"\u7FFB\u8BD1",actionCopy:"\u590D\u5236",copied:"\u5DF2\u590D\u5236",selectionHint:"\u9009\u4E2D\u6587\u5B57\u540E\u53EF\u53F3\u952E\u300C\u89E3\u8BFB\u300D\u6216\u300C\u7FFB\u8BD1\u300D",explainInstruction:"\u8BF7\u89E3\u8BFB\u4EE5\u4E0A\u6211\u9009\u4E2D\u7684\u5185\u5BB9\uFF1A\u8BF4\u660E\u5B83\u7684\u542B\u4E49\u3001\u80CC\u666F\u548C\u5173\u952E\u6982\u5FF5\uFF0C\u5E76\u7ED3\u5408\u4E0A\u4E0B\u6587\u6307\u51FA\u6211\u53EF\u80FD\u5FFD\u7565\u7684\u8981\u70B9\u3002",translateInstruction:"\u8BF7\u628A\u4EE5\u4E0A\u6211\u9009\u4E2D\u7684\u5185\u5BB9\u7FFB\u8BD1\u6210\u7B80\u4F53\u4E2D\u6587\uFF08\u82E5\u539F\u6587\u5DF2\u662F\u4E2D\u6587\u5219\u7FFB\u8BD1\u6210\u82F1\u6587\uFF09\uFF0C\u672F\u8BED\u4FDD\u6301\u51C6\u786E\u3002",promptLead:"\u4EE5\u4E0B\u662F\u6211\u5728 PDF \u4E2D\u9009\u4E2D\u7684\u5185\u5BB9\uFF1A",pageOf:"\u7B2C {page} / {total} \u9875",zoomIn:"\u653E\u5927",zoomOut:"\u7F29\u5C0F",fitWidth:"\u9002\u5408\u5BBD\u5EA6",actualSize:"\u5B9E\u9645\u5927\u5C0F",previousPage:"\u4E0A\u4E00\u9875",nextPage:"\u4E0B\u4E00\u9875"},oe={tabTitle:"PDF Reader",guideTitle:"PDF Reader",guideDescription:"Drop a PDF to preview it; select text and right-click \u89E3\u8BFB / \u7FFB\u8BD1",emptyTitle:"Drop a PDF here",emptyHint:"Drag a PDF from the desktop or Finder, or pick a file below",dropActive:"Release to open the PDF",chooseFile:"Choose PDF file",openAnother:"Open another PDF",unsupported:"Only PDF files are supported here",readFailed:"Could not read this PDF. Please retry.",viewerLoading:"Preparing PDF\u2026",viewerFailed:"Failed to load the PDF: {message}",retry:"Retry",actionExplain:"Explain",actionTranslate:"Translate",actionCopy:"Copy",copied:"Copied",selectionHint:"Select text, then right-click Explain or Translate",explainInstruction:"Please explain the selected passage above: its meaning, background, key concepts, and anything I might be missing in context.",translateInstruction:"Please translate the selected passage above into Simplified Chinese (or into English if it is already Chinese), keeping terminology accurate.",promptLead:"Here is the passage I selected in the PDF:",pageOf:"Page {page} / {total}",zoomIn:"Zoom in",zoomOut:"Zoom out",fitWidth:"Fit width",actualSize:"Actual size",previousPage:"Previous page",nextPage:"Next page"},k={zh:ie,en:oe};var b=new Set;function w(e,a){if(b.has(e)||document.getElementById(e)!==null){b.add(e);return}let r=document.createElement("style");r.id=e,r.dataset.plugin="dsh-pdf-panel",r.textContent=a,document.head.appendChild(r),b.add(e)}var o=require("react"),L=require("@deepseek-ai/dsh-client-ui-primitives");var v=new Map;function N(e){return v.get(e)}function z(e,a){v.set(e,a)}function E(e){v.delete(e)}function re(e){return e.replace(/\r\n/g,`
`).replace(/[ \t]+\n/g,`
`).replace(/\n{3,}/g,`

`).trim().split(`
`).map(a=>`> ${a}`).join(`
`)}function I(e,a,r,t){let d=t(a==="explain"?"explainInstruction":"translateInstruction"),p=e.captureInsertion();if(e.insertQuote(r.trim())){e.insertText(`

${d}`,e.captureInsertion());return}e.insertText(`${t("promptLead")}

${re(r)}

${d}`,p)}var i=require("react/jsx-runtime"),se=require,de=(0,o.lazy)(async()=>({default:(await se.async("./client.pdf.js")).PdfPanel}));function C(e){return e.type==="application/pdf"||/\.pdf$/i.test(e.name)}var x=class extends o.Component{state={};static getDerivedStateFromError(a){return{message:a instanceof Error?a.message:String(a)}}render(){return this.state.message!==void 0?this.props.fallback(this.state.message):this.props.children}};function A(e){let{useTabInfo:a,inputActions:r,t}=e,d=a(),p=d.tab.id,[l,M]=(0,o.useState)(()=>N(p)),[$,K]=(0,o.useState)(0),[D,c]=(0,o.useState)(),[V,g]=(0,o.useState)(!1),F=(0,o.useRef)(null),f=(0,o.useRef)(0);(0,o.useEffect)(()=>{let n=d.tab.signal,s=()=>{E(p)};return n.addEventListener("abort",s,{once:!0}),()=>{n.removeEventListener("abort",s)}},[p,d.tab.signal]);let m=(0,o.useCallback)(async n=>{if(!C(n)){c(t("unsupported"));return}try{let s=new Uint8Array(await n.arrayBuffer()),h={name:n.name,bytes:s};z(p,h),M(h),K(J=>J+1),c(void 0)}catch{c(t("readFailed"))}},[p,t]),T=(0,o.useCallback)(()=>{F.current?.click()},[]),W=(0,o.useCallback)(n=>{n.preventDefault(),n.stopPropagation(),f.current=0,g(!1);let s=Array.from(n.dataTransfer?.files??[]),h=s.find(C);if(h===void 0){s.length>0&&c(t("unsupported"));return}m(h)},[m,t]),q=(0,o.useCallback)(n=>{Array.from(n.dataTransfer?.types??[]).includes("Files")&&(n.preventDefault(),n.stopPropagation(),f.current+=1,g(!0))},[]),U=(0,o.useCallback)(n=>{n.preventDefault(),n.stopPropagation(),f.current=Math.max(0,f.current-1),f.current===0&&g(!1)},[]),Z=(0,o.useCallback)(n=>{Array.from(n.dataTransfer?.types??[]).includes("Files")&&(n.preventDefault(),n.stopPropagation(),n.dataTransfer.dropEffect="copy")},[]),G=(0,o.useMemo)(()=>({loading:t("viewerLoading"),failed:n=>t("viewerFailed",{message:n}),retry:t("retry"),pageOf:(n,s)=>t("pageOf",{page:n,total:s}),zoomIn:t("zoomIn"),zoomOut:t("zoomOut"),fitWidth:t("fitWidth"),actualSize:t("actualSize"),actionExplain:t("actionExplain"),actionTranslate:t("actionTranslate"),actionCopy:t("actionCopy"),copied:t("copied"),selectionHint:t("selectionHint")}),[t]),Q=(0,o.useCallback)((n,s)=>{I(r,n,s,t)},[r,t]);return(0,i.jsxs)("div",{className:"dsh-pdf-panel","data-dsh-pdf-panel":!0,onDrop:W,onDragEnter:q,onDragOver:Z,onDragLeave:U,children:[(0,i.jsx)("input",{ref:F,type:"file",accept:"application/pdf,.pdf",hidden:!0,"data-dsh-pdf-file-input":!0,onChange:n=>{let s=n.target.files?.[0];n.target.value="",s!==void 0&&m(s)}}),l===void 0?(0,i.jsxs)("div",{className:"dsh-pdf-panel__empty",children:[(0,i.jsx)("span",{className:"dsh-pdf-panel__glyph",children:(0,i.jsx)(L.FileTypeIcon,{kind:"pdf",size:44})}),(0,i.jsx)("div",{className:"dsh-pdf-panel__empty-title",children:t("emptyTitle")}),(0,i.jsx)("div",{className:"dsh-pdf-panel__empty-hint",children:t("emptyHint")}),(0,i.jsx)("button",{type:"button",className:"dsh-pdf-panel__primary",onClick:T,children:t("chooseFile")}),(0,i.jsx)("div",{className:"dsh-pdf-panel__hint",children:t("selectionHint")})]}):(0,i.jsxs)(i.Fragment,{children:[(0,i.jsxs)("div",{className:"dsh-pdf-panel__bar",children:[(0,i.jsx)("span",{className:"dsh-pdf-panel__file",title:l.name,children:l.name}),(0,i.jsx)("button",{type:"button",className:"dsh-pdf-panel__btn",onClick:T,children:t("openAnother")})]}),(0,i.jsx)("div",{className:"dsh-pdf-panel__viewer",children:(0,i.jsx)(x,{fallback:n=>(0,i.jsx)("div",{className:"dsh-pdf-panel__status",role:"alert",children:t("viewerFailed",{message:n})}),children:(0,i.jsx)(o.Suspense,{fallback:(0,i.jsx)("div",{className:"dsh-pdf-panel__status",children:t("viewerLoading")}),children:(0,i.jsx)(de,{bytes:l.bytes,fileName:l.name,labels:G,onPassageAction:Q},`${p}:${$}`)})})})]}),D!==void 0&&(0,i.jsxs)("div",{className:"dsh-pdf-panel__error",role:"alert","data-dsh-pdf-error":!0,children:[D,(0,i.jsx)("button",{type:"button",className:"dsh-pdf-panel__link",onClick:()=>{c(void 0)},children:t("retry")})]}),V&&(0,i.jsx)("div",{className:"dsh-pdf-panel__drop",children:t("dropActive")})]})}var R=require("@deepseek-ai/dsh-client-ui-primitives"),P=require("react/jsx-runtime");function S(e){return(0,P.jsx)("button",{type:"button",className:"dsh-pdf-header-action","aria-label":e.t("tabTitle"),title:e.t("tabTitle"),"data-dsh-pdf-header-action":!0,onClick:()=>{e.open()},children:(0,P.jsx)(R.FileTypeIcon,{kind:"pdf",size:16})})}var H=`/**
 * Right-sidebar PDF panel shell and conversation-header entry.
 * Colours come from the host theme where it exposes variables and fall back to
 * neutral values so the panel stays legible in either theme.
 */

.dsh-pdf-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  font-size: 13px;
  color: var(--dsh-text-primary, #1f2328);
}

.dsh-pdf-panel__bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 10px;
  border-bottom: 1px solid var(--dsh-border-subtle, rgba(0, 0, 0, 0.08));
}

.dsh-pdf-panel__file {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.dsh-pdf-panel__btn,
.dsh-pdf-panel__primary,
.dsh-pdf-panel__link {
  flex: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
  border-radius: 6px;
}

.dsh-pdf-panel__btn {
  border: 1px solid var(--dsh-border-subtle, rgba(0, 0, 0, 0.12));
  background: transparent;
  padding: 3px 8px;
  font-size: 12px;
}

.dsh-pdf-panel__btn:hover {
  background: var(--dsh-fill-subtle, rgba(0, 0, 0, 0.05));
}

.dsh-pdf-panel__viewer {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.dsh-pdf-panel__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 28px 20px;
  text-align: center;
}

.dsh-pdf-panel__glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dsh-text-tertiary, #8a8f98);
  margin-bottom: 2px;
}

.dsh-pdf-panel__empty-title {
  font-size: 15px;
  font-weight: 600;
}

.dsh-pdf-panel__empty-hint,
.dsh-pdf-panel__hint {
  max-width: 34em;
  font-size: 12px;
  line-height: 1.6;
  color: var(--dsh-text-secondary, #6b7280);
}

.dsh-pdf-panel__hint {
  margin-top: 4px;
  color: var(--dsh-text-tertiary, #8a8f98);
}

.dsh-pdf-panel__primary {
  margin-top: 6px;
  border: 1px solid var(--dsh-border-subtle, rgba(0, 0, 0, 0.12));
  background: var(--dsh-fill-subtle, rgba(0, 0, 0, 0.05));
  padding: 6px 14px;
}

.dsh-pdf-panel__primary:hover {
  background: var(--dsh-fill-hover, rgba(0, 0, 0, 0.08));
}

.dsh-pdf-panel__status {
  padding: 16px;
  color: var(--dsh-text-secondary, #6b7280);
  font-size: 12px;
}

.dsh-pdf-panel__error {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-top: 1px solid var(--dsh-border-subtle, rgba(0, 0, 0, 0.08));
  color: #c0392b;
  font-size: 12px;
}

.dsh-pdf-panel__link {
  border: none;
  background: transparent;
  text-decoration: underline;
  font-size: 12px;
  color: inherit;
  padding: 0;
}

.dsh-pdf-panel__drop {
  position: absolute;
  inset: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--dsh-accent, #4f8cff);
  border-radius: 10px;
  background: color-mix(in srgb, var(--dsh-accent, #4f8cff) 10%, transparent);
  color: var(--dsh-accent, #4f8cff);
  font-weight: 600;
  pointer-events: none;
  z-index: 2;
}

/* Conversation-header entry that opens the reader. */
.dsh-pdf-header-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 26px;
  min-width: 26px;
  padding: 0 6px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.dsh-pdf-header-action:hover {
  background: var(--dsh-fill-subtle, rgba(0, 0, 0, 0.06));
}

.dsh-pdf-header-action__label {
  font-size: 12px;
}
`;var le="dsh-pdf-panel",ce=["slots","locale","sidebarRightTabs","sidebarRight"],O="dsh-pdf-panel",_="pdf-panel",fe="dsh-pdf-panel-open";function he(e){return(0,j.createElement)(B.FileTypeIcon,{kind:"pdf",size:e.size??16,className:e.className})}function ue(e){w("dsh-pdf-panel/panel",H),e.effect(()=>e.locale.register(u,k),"dsh-pdf-panel: dictionaries");let a=e.locale.bind(u);e.effect(()=>e.sidebarRightTabs.register({id:O,kind:_,title:()=>a("tabTitle"),guide:[{id:"open-pdf",order:0,title:()=>a("guideTitle"),description:()=>a("guideDescription"),icon:he}]}),"dsh-pdf-panel: tab type"),e.effect(()=>e.slots.inject("sidebar.right.pane.tab",()=>e.slots.register({name:"sidebar.right.pane.tab",key:O,locale:u},A)),"dsh-pdf-panel: tab body"),e.effect(()=>e.slots.inject("conversation.session.header.utilities",()=>e.slots.register({name:"conversation.session.header.utilities",id:fe,order:-9,locale:u,inject:()=>({open:()=>{e.sidebarRight.openTab(_)}})},S)),"dsh-pdf-panel: header entry")}

		return module.exports;
	}
});
