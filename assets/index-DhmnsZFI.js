(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))n(o);new MutationObserver(o=>{for(const d of o)if(d.type==="childList")for(const l of d.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&n(l)}).observe(document,{childList:!0,subtree:!0});function a(o){const d={};return o.integrity&&(d.integrity=o.integrity),o.referrerPolicy&&(d.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?d.credentials="include":o.crossOrigin==="anonymous"?d.credentials="omit":d.credentials="same-origin",d}function n(o){if(o.ep)return;o.ep=!0;const d=a(o);fetch(o.href,d)}})();const be=[{id:"housing",name:"Housing",color:"#8F3150",sortOrder:0,archived:!1,system:!1},{id:"food",name:"Food",color:"#D16A45",sortOrder:1,archived:!1,system:!1},{id:"transportation",name:"Transportation",color:"#3F7391",sortOrder:2,archived:!1,system:!1},{id:"tuition-school",name:"Tuition & school",color:"#72558A",sortOrder:3,archived:!1,system:!1},{id:"travel",name:"Travel",color:"#267D70",sortOrder:4,archived:!1,system:!1},{id:"social",name:"Social",color:"#B14E79",sortOrder:5,archived:!1,system:!1},{id:"health",name:"Health",color:"#56814A",sortOrder:6,archived:!1,system:!1},{id:"miscellaneous",name:"Miscellaneous",color:"#8A7770",sortOrder:7,archived:!1,system:!1},{id:"uncategorized",name:"Uncategorized",color:"#9A9694",sortOrder:8,archived:!1,system:!0}],se={id:"primary",mbaStartDate:null,graduationDate:null,availableFundsCents:null,incompleteMonths:[]};class re extends Error{constructor(t){super(t),this.name="TransactionValidationError"}}function Pe(e){const t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(e);if(!t)return!1;const[,a,n,o]=t,d=new Date(Date.UTC(Number(a),Number(n)-1,Number(o)));return d.getUTCFullYear()===Number(a)&&d.getUTCMonth()===Number(n)-1&&d.getUTCDate()===Number(o)}function Te(e){if(!e.id.trim())throw new re("A transaction ID is required.");if(!Number.isSafeInteger(e.amountCents)||e.amountCents<=0)throw new re("Amount must be a positive whole number of cents.");if(!Pe(e.date))throw new re("Date must be a valid calendar date.");if(!e.categoryId.trim())throw new re("A category is required.");if(!Number.isFinite(Date.parse(e.createdAt)))throw new re("Created time must be valid.")}const Fe="hbs-student-budget",_e=1,p={transactions:"transactions",categories:"categories",settings:"settings"};class ve extends Error{constructor(t,a){super(`Local storage could not ${t}.`,{cause:a}),this.name="StorageOperationError"}}class te extends Error{constructor(t){super(t),this.name="CategoryOperationError"}}function J(e){return new Promise((t,a)=>{e.addEventListener("success",()=>t(e.result),{once:!0}),e.addEventListener("error",()=>a(e.error),{once:!0})})}function z(e){return new Promise((t,a)=>{e.addEventListener("complete",()=>t(),{once:!0}),e.addEventListener("abort",()=>a(e.error),{once:!0}),e.addEventListener("error",()=>a(e.error),{once:!0})})}function Be(){return new Promise((e,t)=>{if(!("indexedDB"in globalThis)){t(new Error("IndexedDB is unavailable."));return}const a=indexedDB.open(Fe,_e);a.addEventListener("upgradeneeded",()=>{const n=a.result;n.objectStoreNames.contains(p.transactions)||n.createObjectStore(p.transactions,{keyPath:"id"}),n.objectStoreNames.contains(p.categories)||n.createObjectStore(p.categories,{keyPath:"id"}),n.objectStoreNames.contains(p.settings)||n.createObjectStore(p.settings,{keyPath:"id"})},{once:!0}),a.addEventListener("success",()=>e(a.result),{once:!0}),a.addEventListener("error",()=>t(a.error),{once:!0}),a.addEventListener("blocked",()=>t(new Error("Database upgrade was blocked.")),{once:!0})})}class Re{constructor(t=Be){this.provideDatabase=t}provideDatabase;async perform(t,a){let n;try{return n=await this.provideDatabase(),await a(n)}catch(o){throw o instanceof ve||o instanceof te?o:new ve(t,o)}finally{n?.close()}}async initialize(){return this.perform("initialize",async t=>{const a=t.transaction(p.categories,"readonly"),n=z(a),o=await J(a.objectStore(p.categories).count());if(await n,o===0){const E=t.transaction(p.categories,"readwrite"),M=z(E),L=E.objectStore(p.categories);be.forEach(C=>L.put(C)),await M}const d=t.transaction(p.settings,"readonly"),l=z(d),v=await J(d.objectStore(p.settings).get(se.id));if(await l,!v){const E=t.transaction(p.settings,"readwrite"),M=z(E);E.objectStore(p.settings).put(se),await M}})}async getCategories(t=!0){return this.perform("read categories",async a=>{const n=a.transaction(p.categories,"readonly"),o=z(n),d=await J(n.objectStore(p.categories).getAll());return await o,d.filter(l=>t||!l.archived).sort((l,v)=>l.sortOrder-v.sortOrder)})}async saveCategory(t){return this.perform("save a category",async a=>{const n=a.transaction(p.categories,"readwrite"),o=z(n);n.objectStore(p.categories).put(t),await o})}async saveCategories(t){return this.perform("save categories",async a=>{const n=a.transaction(p.categories,"readwrite"),o=z(n),d=n.objectStore(p.categories);t.forEach(l=>d.put(l)),await o})}async deleteCategory(t,a){return this.perform("delete a category",async n=>{const o=n.transaction([p.categories,p.transactions],"readwrite"),d=z(o),l=o.objectStore(p.categories),v=o.objectStore(p.transactions),E=J(l.get(t)),M=a?J(l.get(a)):Promise.resolve(void 0),L=J(v.getAll()),[C,k,F]=await Promise.all([E,M,L]);if(!C)throw new te("The category no longer exists.");if(C.system)throw new te("System categories cannot be deleted.");const O=F.filter(T=>T.categoryId===t);if(O.length>0){if(!a||!k)throw new te("Choose where existing transactions should move.");if(k.id===C.id||k.archived)throw new te("Choose a different active category.");O.forEach(T=>{v.put({...T,categoryId:k.id})})}l.delete(t),await d})}async reassignTransactions(t,a){if(t.length!==0)return this.perform("recategorize transactions",async n=>{const o=n.transaction([p.categories,p.transactions],"readwrite"),d=z(o),l=o.objectStore(p.categories),v=o.objectStore(p.transactions),E=J(l.get(a)),M=t.map(k=>J(v.get(k))),[L,C]=await Promise.all([E,Promise.all(M)]);if(!L||L.archived)throw new te("Choose an active category.");if(C.some(k=>!k))throw new te("One or more transactions no longer exist.");C.forEach(k=>{v.put({...k,categoryId:a})}),await d})}async saveTransaction(t){return Te(t),this.perform("save a transaction",async a=>{const n=a.transaction(p.transactions,"readwrite"),o=z(n);n.objectStore(p.transactions).put(t),await o})}async getTransactions(){return this.perform("read transactions",async t=>{const a=t.transaction(p.transactions,"readonly"),n=z(a),o=await J(a.objectStore(p.transactions).getAll());return await n,o.sort((d,l)=>l.date.localeCompare(d.date))})}async deleteTransaction(t){return this.perform("delete a transaction",async a=>{const n=a.transaction(p.transactions,"readwrite"),o=z(n);n.objectStore(p.transactions).delete(t),await o})}async getSettings(){return this.perform("read settings",async t=>{const a=t.transaction(p.settings,"readonly"),n=z(a),o=await J(a.objectStore(p.settings).get(se.id));return await n,o??{...se}})}async saveSettings(t){return this.perform("save settings",async a=>{const n=a.transaction(p.settings,"readwrite"),o=z(n);n.objectStore(p.settings).put(t),await o})}async replaceAllData(t){return this.perform("restore a backup",async a=>{const n=a.transaction([p.transactions,p.categories,p.settings],"readwrite"),o=z(n),d=n.objectStore(p.transactions),l=n.objectStore(p.categories),v=n.objectStore(p.settings);d.clear(),l.clear(),v.clear(),t.transactions.forEach(E=>d.put(E)),t.categories.forEach(E=>l.put(E)),v.put(t.settings),await o})}async resetAllData(){return this.perform("delete all data",async t=>{const a=t.transaction([p.transactions,p.categories,p.settings],"readwrite"),n=z(a),o=a.objectStore(p.transactions),d=a.objectStore(p.categories),l=a.objectStore(p.settings);o.clear(),d.clear(),l.clear(),be.forEach(v=>d.put(v)),l.put(se),await n})}}const D=new Re,ye=["#8F3150","#D16A45","#3F7391","#72558A","#267D70","#B14E79"];function H(e){const t=document.querySelector(e);if(!t)throw new Error(`Required category control is missing: ${e}`);return t}function we(e){typeof e.showModal=="function"?e.showModal():e.setAttribute("open","")}function ge(e){typeof e.close=="function"?e.close():e.removeAttribute("open")}function Ie(){return crypto.randomUUID?.()??`category-${Date.now()}-${Math.random().toString(16).slice(2)}`}function qe(){const e=H("#open-categories"),t=H("#category-dialog"),a=H("#close-categories"),n=H("#new-category-form"),o=H("#new-category-name"),d=H("#category-list"),l=H("#category-feedback"),v=H("#delete-category-dialog"),E=H("#delete-category-copy"),M=H("#replacement-category-field"),L=H("#replacement-category"),C=H("#delete-category-error"),k=H("#cancel-delete-category"),F=H("#confirm-delete-category");let O=[],T=null;function y(m="",u=!1){l.textContent=m,l.hidden=m.length===0,l.classList.toggle("view-feedback--error",u)}function j(){window.dispatchEvent(new CustomEvent("budget:categories-changed"))}function P(m,u){const s=m.trim().toLocaleLowerCase();return O.some(r=>r.id!==u&&r.name.toLocaleLowerCase()===s)}function U(m,u,s){const r=document.createElement("button");return r.type="button",r.className="category-action",r.dataset.action=u,r.dataset.categoryId=s.id,r.textContent=m,r.setAttribute("aria-label",`${m} ${s.name}`),r}function W(m,u){const s=document.createElement("article");s.className=m.archived?"category-row category-row--archived":"category-row",s.dataset.categoryId=m.id;const r=document.createElement("span");r.className="category-swatch",r.style.backgroundColor=m.color,r.setAttribute("aria-hidden","true");const i=document.createElement("input");i.type="text",i.maxLength=40,i.value=m.name,i.dataset.nameInput=m.id,i.setAttribute("aria-label",`Name for ${m.name}`),i.disabled=m.system;const h=document.createElement("div");if(h.className="category-row__actions",m.system){const c=document.createElement("small");c.className="system-badge",c.textContent="System",h.append(c)}else{h.append(U("Save","rename",m));const c=u.filter(b=>!b.system),x=c.findIndex(b=>b.id===m.id),g=U("↑","up",m),f=U("↓","down",m);g.disabled=x<=0,f.disabled=x===c.length-1,h.append(g,f),h.append(U(m.archived?"Restore":"Archive","archive",m),U("Delete","delete",m))}return s.append(r,i,h),s}function A(){const m=O.filter(r=>!r.archived),u=O.filter(r=>r.archived),s=[];if(m.length>0){const r=document.createElement("h3");r.className="category-list__heading",r.textContent="Available for new entries",s.push(r,...m.map(i=>W(i,m)))}if(u.length>0){const r=document.createElement("h3");r.className="category-list__heading",r.textContent="Archived history",s.push(r,...u.map(i=>W(i,u)))}d.replaceChildren(...s)}async function S(){try{O=await D.getCategories(),A()}catch{y("Categories are unavailable. No data was changed.",!0)}}async function w(m,u){try{Array.isArray(m)?await D.saveCategories(m):await D.saveCategory(m),y(u),await S(),j()}catch{y("The category change could not be saved. Nothing changed.",!0)}}e.addEventListener("click",()=>{y(),S(),we(t)}),a.addEventListener("click",()=>ge(t)),n.addEventListener("submit",m=>{m.preventDefault();const u=o.value.trim();if(!u){y("Enter a category name.",!0);return}if(P(u)){y("A category with that name already exists.",!0);return}const s={id:Ie(),name:u,color:ye[O.length%ye.length],sortOrder:Math.max(-1,...O.map(r=>r.sortOrder))+1,archived:!1,system:!1};o.value="",w(s,`${u} added.`)}),d.addEventListener("click",m=>{const u=m.target.closest("[data-action]");if(!u)return;const s=O.find(r=>r.id===u.dataset.categoryId);if(s){if(u.dataset.action==="rename"){const i=d.querySelector(`[data-name-input="${s.id}"]`)?.value.trim()??"";i?P(i,s.id)?y("A category with that name already exists.",!0):w({...s,name:i},`${s.name} renamed to ${i}.`):y("A category name cannot be blank.",!0);return}if(u.dataset.action==="archive"){w({...s,archived:!s.archived},s.archived?`${s.name} restored.`:`${s.name} archived.`);return}if(u.dataset.action==="up"||u.dataset.action==="down"){const r=O.filter(x=>x.archived===s.archived&&!x.system),i=r.findIndex(x=>x.id===s.id),h=u.dataset.action==="up"?i-1:i+1,c=r[h];if(!c)return;w([{...s,sortOrder:c.sortOrder},{...c,sortOrder:s.sortOrder}],`${s.name} reordered.`);return}u.dataset.action==="delete"&&Promise.all([D.getTransactions(),D.getCategories(!1)]).then(([r,i])=>{const h=r.filter(c=>c.categoryId===s.id).length;T={category:s,affectedCount:h},E.textContent=h>0?`${s.name} has ${h} ${h===1?"transaction":"transactions"}. Choose where to move them before deleting it.`:`${s.name} has no transactions. Deleting it will remove it from category options.`,M.hidden=h===0,L.replaceChildren(new Option("Choose category",""),...i.filter(c=>c.id!==s.id).map(c=>new Option(c.name,c.id))),C.hidden=!0,we(v)}).catch(()=>y("The category details could not be loaded.",!0))}}),k.addEventListener("click",()=>{T=null,ge(v)}),F.addEventListener("click",async()=>{if(T){if(T.affectedCount>0&&!L.value){C.textContent="Choose where the existing transactions should move.",C.hidden=!1;return}F.disabled=!0;try{await D.deleteCategory(T.category.id,T.affectedCount>0?L.value:void 0);const m=T.category.name;T=null,ge(v),y(`${m} deleted; transaction history was preserved.`),await S(),j()}catch{C.textContent="The category could not be deleted. Nothing changed.",C.hidden=!1}finally{F.disabled=!1}}}),S()}function ie(e=new Date){const t=e.getFullYear(),a=String(e.getMonth()+1).padStart(2,"0"),n=String(e.getDate()).padStart(2,"0");return`${t}-${a}-${n}`}function fe(e){const t=e.trim().replaceAll(",","").replace(/^\$/,"");if(!/^\d+(?:\.\d{1,2})?$/.test(t))return null;const[a,n=""]=t.split("."),o=Number(a)*100+Number(n.padEnd(2,"0"));return Number.isSafeInteger(o)&&o>0?o:null}function Ue(e,t=ie()){return e>t}function ze(e,t){return t.some(a=>a.amountCents===e.amountCents&&a.date===e.date&&a.categoryId===e.categoryId&&a.direction===e.direction)}function R(e){const t=document.querySelector(e);if(!t)throw new Error(`Required entry control is missing: ${e}`);return t}function pe(e){const t=new Date(`${e}T12:00:00`);return new Intl.DateTimeFormat(void 0,{month:"short",day:"numeric",year:"numeric"}).format(t)}function Ye(){return crypto.randomUUID?.()??`transaction-${Date.now()}-${Math.random().toString(16).slice(2)}`}function Ve(e){typeof e.showModal=="function"?e.showModal():e.setAttribute("open","")}function Ce(e){typeof e.close=="function"?e.close():e.removeAttribute("open")}function He(e){const t=R("#entry-form"),a=R("#amount"),n=R("#category"),o=R("#date"),d=R("#description"),l=R("#direction"),v=R("#date-mode-today"),E=R("#date-mode-earlier"),M=R("#historical-date"),L=R("#selected-date-pill"),C=R("#save-expense"),k=R("#entry-message"),F=R("#entry-success"),O=R("#entry-success-text"),T=R("#add-another"),y=R("#entry-done"),j=R("#entry-warning-dialog"),P=R("#entry-warning-text"),U=R("#warning-cancel"),W=R("#warning-confirm");let A="today",S=null,w=[...e];const m=[a,n,o,d,l,v,E,C];function u(f){m.forEach(b=>{b.disabled=f})}function s(f="",b="neutral"){k.textContent=f,k.hidden=f.length===0,k.classList.toggle("entry-message--error",b==="error")}function r(f){A=f;const b=ie();v.setAttribute("aria-pressed",String(f==="today")),E.setAttribute("aria-pressed",String(f==="historical")),M.hidden=f==="today",f==="today"?(o.value=b,L.textContent="Today"):(o.value||(o.value=b),L.textContent=pe(o.value))}function i(f){const b=n.value;w=[...f],n.replaceChildren(new Option("Select category",""),...w.map(N=>new Option(N.name,N.id))),w.some(N=>N.id===b)&&(n.value=b)}function h(f){a.value="",n.value="",d.value="",l.value="outgoing",s(),F.hidden=!0,t.classList.remove("entry-form--saved"),u(!1),f||r("today"),a.focus()}function c(){const f=fe(a.value);return f===null?(s("Enter a valid USD amount greater than $0.","error"),a.focus(),null):n.value?o.value?{id:Ye(),amountCents:f,date:o.value,description:d.value.trim()||void 0,direction:l.value,categoryId:n.value,source:"manual",createdAt:new Date().toISOString(),excludedFromProjection:!1}:(s("Choose a transaction date before saving.","error"),o.focus(),null):(s("Choose a category before saving.","error"),n.focus(),null)}async function x(f){Ce(j),S=null,u(!0),C.textContent="Saving…",s();try{await D.saveTransaction(f);const b=w.find(Y=>Y.id===f.categoryId)?.name,N=new Intl.NumberFormat(void 0,{style:"currency",currency:"USD"}).format(f.amountCents/100);O.textContent=`${N} · ${b??"Uncategorized"} · ${pe(f.date)}`,F.hidden=!1,t.classList.add("entry-form--saved"),window.dispatchEvent(new CustomEvent("budget:transaction-saved"))}catch{u(!1),s("This entry could not be saved locally. Nothing was added.","error")}finally{C.textContent="Save expense"}}async function g(){const f=c();if(f){C.disabled=!0;try{const b=await D.getTransactions(),N=[];if(Ue(f.date)&&N.push("This date is in the future."),ze(f,b)&&N.push("A transaction with the same amount, date, category, and type already exists."),N.length>0){S=f,P.textContent=`${N.join(" ")} Save it anyway?`,Ve(j);return}await x(f)}catch{s("The app could not check existing entries. Nothing was saved.","error")}finally{t.classList.contains("entry-form--saved")||(C.disabled=!1)}}}i(e),o.value=ie(),r("today"),u(!1),v.addEventListener("click",()=>r("today")),E.addEventListener("click",()=>{r("historical"),o.focus(),o.showPicker?.()}),o.addEventListener("change",()=>{A==="historical"&&o.value&&(L.textContent=pe(o.value))}),t.addEventListener("submit",f=>{f.preventDefault(),g()}),T.addEventListener("click",()=>h(A==="historical")),y.addEventListener("click",()=>h(!1)),U.addEventListener("click",()=>{S=null,Ce(j),C.disabled=!1}),W.addEventListener("click",()=>{S&&x(S)}),j.addEventListener("cancel",()=>{S=null,C.disabled=!1}),window.addEventListener("budget:categories-changed",()=>{D.getCategories(!1).then(i).catch(()=>{s("Updated categories could not be loaded. Try reopening the app.","error")})})}function We(e,t){return e.date.slice(0,7)===t}function Ge(e,t){return e.reduce((a,n)=>(n.direction!=="outgoing"||!We(n,t)||(a[n.categoryId]=(a[n.categoryId]??0)+n.amountCents),a),{})}const Ke=365.25/12;function Z(e){return e.slice(0,7)}function Ee(e){const[t,a]=e.split("-").map(Number),n=new Date(Date.UTC(t,a-2,1));return`${n.getUTCFullYear()}-${String(n.getUTCMonth()+1).padStart(2,"0")}`}function Je(e){return e.reduce((t,a)=>{if(a.direction!=="outgoing")return t;const n=Z(a.date);return t[n]=(t[n]??0)+a.amountCents,t},{})}function Se(e){return new Date(`${e}T12:00:00`)}function Qe(e,t,a){const n=Z(a),o=!!(t.mbaStartDate&&t.graduationDate),d=y=>o&&y.date>=t.mbaStartDate&&y.date<=t.graduationDate,l=e.reduce((y,j)=>j.direction!=="outgoing"||!d(j)||j.date>a?y:y+j.amountCents,0);if(!o||t.mbaStartDate>t.graduationDate)return{completeMonths:[],runRateCents:null,annualProjectionCents:null,actualProgramOutflowCents:l,remainingMonths:null,remainingProjectionCents:null,totalProgramProjectionCents:null,fundingBalanceCents:null};const v=e.reduce((y,j)=>{const P=Z(j.date);return j.direction!=="outgoing"||j.excludedFromProjection||!d(j)||P>=n||t.incompleteMonths.includes(P)||(y[P]=(y[P]??0)+j.amountCents),y},{}),E=Object.keys(v).sort(),M=E.length===0?null:Math.round(E.reduce((y,j)=>y+v[j],0)/E.length),L=Se(t.graduationDate),C=Se(a),k=Math.max(0,(L.getTime()-C.getTime()+864e5)/864e5/Ke),F=M===null?null:Math.round(M*k),O=F===null?null:l+F,T=F===null||t.availableFundsCents===null?null:t.availableFundsCents-F;return{completeMonths:E,runRateCents:M,annualProjectionCents:M===null?null:M*12,actualProgramOutflowCents:l,remainingMonths:k,remainingProjectionCents:F,totalProgramProjectionCents:O,fundingBalanceCents:T}}function $(e){const t=document.querySelector(e);if(!t)throw new Error(`Required overview control is missing: ${e}`);return t}function Xe(e){typeof e.showModal=="function"?e.showModal():e.setAttribute("open","")}function ke(e){typeof e.close=="function"?e.close():e.removeAttribute("open")}function Q(e){return e===null?"—":new Intl.NumberFormat(void 0,{style:"currency",currency:"USD",maximumFractionDigits:0}).format(e/100)}function ne(e){return new Intl.DateTimeFormat(void 0,{month:"short",year:"numeric"}).format(new Date(`${e}-15T12:00:00`))}function Ze(e){const t=e.trim();return t?/^\$?0(?:\.0{1,2})?$/.test(t)?0:fe(t)??void 0:null}function et(){const e=$("#overview-month"),t=$("#overview-feedback"),a=$("#actual-month-outflow"),n=$("#month-comparison"),o=$("#monthly-run-rate"),d=$("#run-rate-months"),l=$("#funding-outlook"),v=$("#funding-label"),E=$("#annual-projection"),M=$("#remaining-projection"),L=$("#total-program-projection"),C=$("#actual-program-outflow"),k=$("#projection-assumptions"),F=$("#category-breakdown"),O=$("#empty-breakdown"),T=$("#toggle-month-complete"),y=$("#edit-projection-settings"),j=$("#open-projection-settings"),P=$("#projection-settings-summary"),U=$("#projection-settings-dialog"),W=$("#close-projection-settings"),A=$("#projection-settings-form"),S=$("#mba-start-date"),w=$("#graduation-date"),m=$("#available-funds"),u=$("#projection-settings-error");let s=Z(ie()),r=null;function i(g="",f=!1){t.textContent=g,t.hidden=g.length===0,t.classList.toggle("view-feedback--error",f)}function h(g,f){const b=Object.entries(g).sort(([,Y],[,q])=>q-Y),N=Math.max(1,...b.map(([,Y])=>Y));O.hidden=b.length>0,F.replaceChildren(...b.map(([Y,q])=>{const X=f.find(Me=>Me.id===Y),V=document.createElement("div");V.className="breakdown-row";const ee=document.createElement("div"),ce=document.createElement("span");ce.textContent=X?.name??"Uncategorized";const I=document.createElement("strong");I.textContent=Q(q),ee.append(ce,I);const K=document.createElement("div");K.className="breakdown-row__track";const ue=document.createElement("span");return ue.style.width=`${Math.max(3,q/N*100)}%`,ue.style.backgroundColor=X?.color??"#9A9694",K.append(ue),V.append(ee,K),V}))}async function c(){try{const[g,f,b]=await Promise.all([D.getTransactions(),D.getCategories(),D.getSettings()]);r=b;const N=Z(ie()),Y=Je(g),q=[...new Set([N,...Object.keys(Y)])].sort().reverse();q.includes(s)||(s=q[0]),e.replaceChildren(...q.map(K=>new Option(ne(K),K,!1,K===s))),e.value=s;const X=Y[s]??0,V=Y[Ee(s)];if(a.textContent=Q(X),V===void 0||V===0)n.textContent=X===0?"No outgoing transactions recorded.":"No prior-month comparison available.";else{const K=(X-V)/V*100;n.textContent=`${K>=0?"+":""}${K.toFixed(0)}% from ${ne(Ee(s))}`}h(Ge(g,s),f);const ee=s===N,ce=b.incompleteMonths.includes(s);T.disabled=ee,T.textContent=ee?"Current month is partial":ce?"Mark complete":"Mark incomplete";const I=Qe(g,b,ie());o.textContent=Q(I.runRateCents),d.textContent=I.completeMonths.length>0?`${I.completeMonths.length} complete ${I.completeMonths.length===1?"month":"months"}`:"No complete month available",E.textContent=Q(I.annualProjectionCents),M.textContent=Q(I.remainingProjectionCents),L.textContent=Q(I.totalProgramProjectionCents),C.textContent=Q(I.actualProgramOutflowCents),l.classList.remove("positive","negative"),I.fundingBalanceCents===null?(l.textContent="—",v.textContent=b.availableFundsCents===null?"Add available funds":"Forecast unavailable"):I.fundingBalanceCents>=0?(l.textContent=Q(I.fundingBalanceCents),v.textContent="Projected surplus",l.classList.add("positive")):(l.textContent=Q(Math.abs(I.fundingBalanceCents)),v.textContent="Additional cash needed",l.classList.add("negative")),!b.mbaStartDate||!b.graduationDate?(k.textContent="Add planning start and end dates to calculate a forecast.",P.textContent="Set the period used by projections"):I.runRateCents===null?(k.textContent="Forecast unavailable until at least one past month with spending is marked complete.",P.textContent=`${ne(Z(b.mbaStartDate))}–${ne(Z(b.graduationDate))}`):(k.textContent=`Based on ${I.completeMonths.map(ne).join(", ")} and ${I.remainingMonths?.toFixed(1)} months remaining. Projection exclusions do not change actual totals.`,P.textContent=`${ne(Z(b.mbaStartDate))}–${ne(Z(b.graduationDate))}${b.availableFundsCents===null?"":` · ${Q(b.availableFundsCents)} available`}`)}catch{i("Overview data is unavailable. No data was changed.",!0)}}function x(){r&&(S.value=r.mbaStartDate??"",w.value=r.graduationDate??"",m.value=r.availableFundsCents===null?"":(r.availableFundsCents/100).toFixed(2),u.hidden=!0,Xe(U))}e.addEventListener("change",()=>{s=e.value,c()}),T.addEventListener("click",async()=>{if(!r||T.disabled)return;const g=new Set(r.incompleteMonths);g.has(s)?g.delete(s):g.add(s);try{await D.saveSettings({...r,incompleteMonths:[...g].sort()}),i(g.has(s)?"Month excluded from the run rate.":"Month included in the run rate."),await c()}catch{i("The month status could not be changed. Nothing changed.",!0)}}),y.addEventListener("click",x),j.addEventListener("click",x),W.addEventListener("click",()=>ke(U)),A.addEventListener("submit",async g=>{if(g.preventDefault(),!r)return;const f=Ze(m.value);if(!S.value||!w.value){u.textContent="Enter both planning dates.",u.hidden=!1;return}if(S.value>w.value){u.textContent="The planning end date must be after the start date.",u.hidden=!1;return}if(f===void 0){u.textContent="Enter a valid USD amount for available funds, or leave it blank.",u.hidden=!1;return}try{await D.saveSettings({...r,mbaStartDate:S.value,graduationDate:w.value,availableFundsCents:f}),ke(U),i("Projection inputs updated."),await c()}catch{u.textContent="Projection inputs could not be saved. Nothing changed.",u.hidden=!1}}),window.addEventListener("budget:transaction-saved",()=>{c()}),window.addEventListener("budget:transactions-changed",()=>{c()}),window.addEventListener("budget:categories-changed",()=>{c()}),c()}const je=1;class G extends Error{constructor(t){super(t),this.name="BackupValidationError"}}function de(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)}function tt(e){if(typeof e!="string")return!1;const t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(e);if(!t)return!1;const a=new Date(Date.UTC(Number(t[1]),Number(t[2])-1,Number(t[3])));return a.getUTCFullYear()===Number(t[1])&&a.getUTCMonth()===Number(t[2])-1&&a.getUTCDate()===Number(t[3])}function nt(e){if(typeof e!="string")return!1;const t=/^(\d{4})-(\d{2})$/.exec(e);return!!(t&&Number(t[2])>=1&&Number(t[2])<=12)}function at(e){if(!de(e))throw new G("A category record is invalid.");if(typeof e.id!="string"||!e.id.trim()||e.id.length>120||typeof e.name!="string"||!e.name.trim()||e.name.length>40||typeof e.color!="string"||!/^#[0-9a-f]{6}$/i.test(e.color)||!Number.isSafeInteger(e.sortOrder)||Number(e.sortOrder)<0||typeof e.archived!="boolean"||typeof e.system!="boolean")throw new G("A category record is invalid.")}function ot(e){if(!de(e)||e.id!=="primary")throw new G("Backup settings are invalid.");const t=a=>a===null||tt(a);if(!t(e.mbaStartDate)||!t(e.graduationDate)||!(e.availableFundsCents===null||Number.isSafeInteger(e.availableFundsCents)&&Number(e.availableFundsCents)>=0)||!Array.isArray(e.incompleteMonths)||!e.incompleteMonths.every(nt)||new Set(e.incompleteMonths).size!==e.incompleteMonths.length)throw new G("Backup settings are invalid.")}function it(e,t,a,n=new Date().toISOString()){return{schemaVersion:je,exportedAt:n,transactions:[...e],categories:[...t],settings:a}}function st(e){if(!de(e)||e.schemaVersion!==je)throw new G("This backup version is not supported.");if(!Array.isArray(e.transactions)||!Array.isArray(e.categories))throw new G("Backup records are missing.");if(typeof e.exportedAt!="string"||!Number.isFinite(Date.parse(e.exportedAt)))throw new G("The backup date is invalid.");e.categories.forEach(at),ot(e.settings),e.transactions.forEach(n=>{if(!de(n)||typeof n.id!="string"||typeof n.amountCents!="number"||typeof n.date!="string"||typeof n.categoryId!="string"||typeof n.createdAt!="string"||n.description!==void 0&&(typeof n.description!="string"||n.description.length>120)||n.direction!=="outgoing"&&n.direction!=="incoming"||n.source!=="manual"||typeof n.excludedFromProjection!="boolean")throw new G("A transaction record is invalid.");try{Te(n)}catch{throw new G("A transaction record is invalid.")}});const t=new Set(e.categories.map(n=>n.id)),a=new Set(e.transactions.map(n=>n.id));if(t.size!==e.categories.length||a.size!==e.transactions.length)throw new G("The backup contains duplicate record IDs.");if(!e.categories.some(n=>n.id==="uncategorized"&&n.system&&!n.archived))throw new G("The required Uncategorized category is missing.");if(e.transactions.some(n=>!t.has(n.categoryId)))throw new G("A transaction refers to a missing category.");return e}function _(e){const t=document.querySelector(e);if(!t)throw new Error(`Required element not found: ${e}`);return t}function me(e){e.open||e.showModal()}function ae(e){e.open&&e.close()}function De(){window.dispatchEvent(new CustomEvent("budget:categories-changed")),window.dispatchEvent(new CustomEvent("budget:transactions-changed"))}function rt(e=new Date){return`five-seconds-budgeting-backup-${e.toISOString().slice(0,10)}.json`}function ct(){const e=_("#open-data-privacy"),t=_("#close-data-privacy"),a=_("#data-privacy-dialog"),n=_("#persistence-status"),o=_("#offline-status"),d=_("#data-counts"),l=_("#storage-summary"),v=_("#data-privacy-feedback"),E=_("#download-backup"),M=_("#restore-backup"),L=_("#restore-file"),C=_("#restore-confirm-dialog"),k=_("#restore-copy"),F=_("#cancel-restore"),O=_("#confirm-restore"),T=_("#request-delete-all"),y=_("#delete-all-dialog"),j=_("#cancel-delete-all"),P=_("#confirm-delete-all"),U=_("#privacy-cover"),W=_("#dismiss-privacy-cover");let A=null,S=!1;const w=(h,c=!1)=>{v.textContent=h,v.classList.toggle("view-feedback--error",c),v.hidden=!1},m=async()=>{const[h,c]=await Promise.all([D.getTransactions(),D.getCategories()]),x=h.length===1?"transaction":"transactions",g=c.length===1?"category":"categories";d.textContent=`${h.length} ${x} · ${c.length} ${g}`},u=()=>{o.textContent=navigator.onLine?S?"Online · offline copy ready":"Online · preparing offline copy":"Offline · using saved app",o.classList.toggle("status-good",!navigator.onLine)},s=async()=>{if(!navigator.storage?.persisted){n.textContent="Local storage · backup recommended";return}try{await navigator.storage.persisted()||navigator.storage.persist&&await navigator.storage.persist()?(n.textContent="Persistent on this device",n.classList.add("status-good"),l.textContent="Private local storage · persistence granted"):(n.textContent="Best-effort · backup recommended",l.textContent="Private local storage · create regular backups")}catch{n.textContent="Local storage · backup recommended"}},r=async()=>{if(!("serviceWorker"in navigator)){o.textContent="Offline loading is not supported here";return}try{const h=await navigator.serviceWorker.register("./sw.js",{scope:"./"}),c=h.installing??h.waiting??h.active;S=!!(h.active||c?.state==="installed"),u(),c?.addEventListener("statechange",()=>{(c.state==="installed"||c.state==="activated")&&(S=!0,u()),c.state==="redundant"&&(o.textContent="Offline setup failed · stay online",o.classList.add("status-warning"))})}catch{o.textContent="Offline setup failed · stay online",o.classList.add("status-warning")}},i=()=>{U.hidden=!1};document.addEventListener("visibilitychange",()=>{document.visibilityState==="hidden"&&i()}),window.addEventListener("pagehide",i),W.addEventListener("click",()=>{U.hidden=!0}),window.addEventListener("online",u),window.addEventListener("offline",u),e.addEventListener("click",()=>{v.hidden=!0,me(a),m().catch(()=>w("Saved-data totals could not be read.",!0))}),t.addEventListener("click",()=>ae(a)),E.addEventListener("click",async()=>{E.disabled=!0,v.hidden=!0;try{const[h,c,x]=await Promise.all([D.getTransactions(),D.getCategories(),D.getSettings()]),g=it(h,c,x),f=new Blob([JSON.stringify(g,null,2)],{type:"application/json"}),b=URL.createObjectURL(f),N=document.createElement("a");N.href=b,N.download=rt(),document.body.append(N),N.click(),N.remove(),window.setTimeout(()=>URL.revokeObjectURL(b),1e3),w("Backup downloaded. Keep the file private.")}catch{w("The backup could not be created. Your app data was not changed.",!0)}finally{E.disabled=!1}}),M.addEventListener("click",()=>{L.value="",L.click()}),L.addEventListener("change",async()=>{const h=L.files?.[0];if(h){if(v.hidden=!0,h.size>5e6){w("That backup is too large to open safely. Nothing was changed.",!0);return}try{A=st(JSON.parse(await h.text()));const c=A.transactions.length;k.textContent=`This verified backup contains ${c} ${c===1?"transaction":"transactions"} and ${A.categories.length} categories. Restoring replaces everything currently in the app.`,me(C)}catch{A=null,w("This file is not a valid 5 Seconds Budgeting backup. Nothing was changed.",!0)}}}),F.addEventListener("click",()=>{A=null,ae(C)}),O.addEventListener("click",async()=>{if(A){O.disabled=!0;try{await D.replaceAllData(A),A=null,ae(C),await m(),w("Backup restored. All views now use the restored data."),De()}catch{w("The backup could not be restored. Your current data was not changed.",!0)}finally{O.disabled=!1}}}),T.addEventListener("click",()=>me(y)),j.addEventListener("click",()=>ae(y)),P.addEventListener("click",async()=>{P.disabled=!0;try{await D.resetAllData(),ae(y),await m(),w("All app data was deleted. Starter categories are ready for a fresh start."),De()}catch{ae(y),w("The data could not be deleted. Nothing was changed.",!0)}finally{P.disabled=!1}}),u(),s(),r()}function B(e){const t=document.querySelector(e);if(!t)throw new Error(`Required transaction control is missing: ${e}`);return t}function xe(e,t){const a=new Intl.NumberFormat(void 0,{style:"currency",currency:"USD"}).format(e/100);return t==="incoming"?`+${a}`:a}function Ae(e){return new Intl.DateTimeFormat(void 0,{month:"short",day:"numeric",year:"numeric"}).format(new Date(`${e}T12:00:00`))}function Le(e){typeof e.showModal=="function"?e.showModal():e.setAttribute("open","")}function oe(e){typeof e.close=="function"?e.close():e.removeAttribute("open")}function dt(){const e=B("#transaction-list"),t=B("#transactions-empty"),a=B("#bulk-bar"),n=B("#bulk-count"),o=B("#bulk-category"),d=B("#apply-bulk-category"),l=B("#transaction-feedback"),v=B("#transaction-dialog"),E=B("#close-transaction"),M=B("#transaction-form"),L=B("#edit-amount"),C=B("#edit-category"),k=B("#edit-date"),F=B("#edit-description"),O=B("#edit-direction"),T=B("#edit-excluded"),y=B("#transaction-edit-error"),j=B("#request-delete-transaction"),P=B("#delete-transaction-dialog"),U=B("#cancel-delete-transaction"),W=B("#confirm-delete-transaction"),A=new Set;let S=null;function w(i="",h=!1){l.textContent=i,l.hidden=i.length===0,l.classList.toggle("view-feedback--error",h)}function m(){a.hidden=A.size===0,n.textContent=`${A.size} selected`}function u(i,h,c){const x=[];if(c?.archived){const g=new Option(`${c.name} (Archived)`,c.id,!0,!0);g.disabled=!0,x.push(g)}x.push(...h.map(g=>new Option(g.name,g.id))),i.replaceChildren(...x),c&&!c.archived&&(i.value=c.id)}function s(i,h,c){const x=document.createElement("article");x.className="transaction-row",x.dataset.transactionId=i.id;const g=document.createElement("input");g.type="checkbox",g.checked=A.has(i.id),g.setAttribute("aria-label",`Select ${xe(i.amountCents,i.direction)} on ${Ae(i.date)}`),g.addEventListener("change",()=>{g.checked?A.add(i.id):A.delete(i.id),m()});const f=document.createElement("div");f.className="transaction-row__details";const b=document.createElement("strong");b.textContent=i.description||(i.direction==="incoming"?"Money in":"Expense");const N=document.createElement("small");N.textContent=Ae(i.date),f.append(b,N);const Y=document.createElement("strong");Y.className=i.direction==="incoming"?"transaction-row__amount incoming":"transaction-row__amount",Y.textContent=xe(i.amountCents,i.direction);const q=document.createElement("select");q.className="transaction-row__category",q.setAttribute("aria-label",`Category for ${b.textContent}`);const X=h.find(ee=>ee.id===i.categoryId);u(q,c,X),q.addEventListener("change",async()=>{q.disabled=!0,w();try{await D.reassignTransactions([i.id],q.value),w("Category updated."),await r(),window.dispatchEvent(new CustomEvent("budget:transactions-changed"))}catch{w("The category could not be updated. Nothing changed.",!0),await r()}finally{q.disabled=!1}});const V=document.createElement("button");return V.type="button",V.className="transaction-row__edit",V.textContent=i.excludedFromProjection?"Edit · Excluded from forecast":"Edit details",V.setAttribute("aria-label",`Edit ${b.textContent}`),V.addEventListener("click",()=>{S=i,L.value=(i.amountCents/100).toFixed(2),u(C,c,X),k.value=i.date,F.value=i.description??"",O.value=i.direction,T.checked=i.excludedFromProjection,y.hidden=!0,Le(v)}),x.append(g,f,Y,q,V),x}async function r(){try{const[i,h]=await Promise.all([D.getTransactions(),D.getCategories()]),c=h.filter(g=>!g.archived),x=new Set(i.map(g=>g.id));[...A].forEach(g=>{x.has(g)||A.delete(g)}),o.replaceChildren(new Option("Choose category",""),...c.map(g=>new Option(g.name,g.id))),e.replaceChildren(...i.map(g=>s(g,h,c))),t.hidden=i.length>0,m()}catch{w("Transaction history is unavailable. No data was changed.",!0)}}d.addEventListener("click",async()=>{if(!o.value){w("Choose a category for the selected transactions.",!0);return}d.disabled=!0,w();try{await D.reassignTransactions([...A],o.value);const i=A.size;A.clear(),w(`${i} ${i===1?"transaction":"transactions"} updated.`),await r(),window.dispatchEvent(new CustomEvent("budget:transactions-changed"))}catch{w("The selected transactions could not be updated. Nothing changed.",!0)}finally{d.disabled=!1}}),E.addEventListener("click",()=>{S=null,oe(v)}),M.addEventListener("submit",async i=>{if(i.preventDefault(),!S)return;const h=fe(L.value);if(h===null||!C.value||!k.value){y.textContent="Enter a valid amount, category, and date.",y.hidden=!1;return}const c={...S,amountCents:h,categoryId:C.value,date:k.value,description:F.value.trim()||void 0,direction:O.value,excludedFromProjection:T.checked};try{await D.saveTransaction(c),S=null,oe(v),w("Transaction updated."),await r(),window.dispatchEvent(new CustomEvent("budget:transactions-changed"))}catch{y.textContent="The transaction could not be updated. Nothing changed.",y.hidden=!1}}),j.addEventListener("click",()=>{S&&Le(P)}),U.addEventListener("click",()=>oe(P)),W.addEventListener("click",async()=>{if(S){W.disabled=!0;try{await D.deleteTransaction(S.id),S=null,oe(P),oe(v),w("Transaction deleted."),await r(),window.dispatchEvent(new CustomEvent("budget:transactions-changed"))}catch{oe(P),y.textContent="The transaction could not be deleted. Nothing changed.",y.hidden=!1}finally{W.disabled=!1}}}),window.addEventListener("budget:transaction-saved",()=>{r()}),window.addEventListener("budget:categories-changed",()=>{r()}),r()}const $e=[{id:"add",label:"Add",icon:"+"},{id:"transactions",label:"Transactions",icon:"☷"},{id:"overview",label:"Overview",icon:"▥"},{id:"settings",label:"Settings",icon:"⚙"}],lt=navigator,he=window.matchMedia("(display-mode: standalone)").matches||lt.standalone===!0,Ne=document.querySelector("#app");if(!Ne)throw new Error("App root was not found.");Ne.innerHTML=`
  <div class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Log it. Know it. Move on.</p>
        <h1>5 Seconds Budgeting</h1>
      </div>
      <span class="mode-badge ${he?"mode-badge--installed":""}">
        ${he?"Installed":"Browser preview"}
      </span>
    </header>

    ${he?"":`
          <aside class="install-card" aria-labelledby="install-title">
            <div class="install-card__icon" aria-hidden="true">↗</div>
            <div>
              <p class="install-card__label">Install once, log fast</p>
              <h2 id="install-title">Put 5 Seconds Budgeting on your Home Screen</h2>
              <p>In Safari, tap Share, choose <strong>Add to Home Screen</strong>, and keep <strong>Open as Web App</strong> turned on. Data entered in this browser tab may not transfer to the installed app.</p>
            </div>
          </aside>
        `}

    <main class="main-content">
      <section class="view" data-view="add" aria-labelledby="add-title">
        <div class="view-heading">
          <div>
            <p class="section-label">Quick entry</p>
            <h2 id="add-title">What did you spend?</h2>
          </div>
          <span class="today-pill" id="selected-date-pill">Today</span>
        </div>

        <div class="entry-card">
          <form id="entry-form" novalidate>
            <label class="field-label" for="amount">Amount</label>
            <div class="amount-field">
              <span aria-hidden="true">$</span>
              <input id="amount" inputmode="decimal" autocomplete="off" placeholder="0.00" disabled />
            </div>

            <label class="field-label" for="category">Category</label>
            <select id="category" disabled>
              <option>Preparing categories…</option>
            </select>

            <fieldset class="date-mode">
              <legend class="field-label">When?</legend>
              <div class="segmented-control">
                <button id="date-mode-today" type="button" aria-pressed="true" disabled>Today</button>
                <button id="date-mode-earlier" type="button" aria-pressed="false" disabled>Earlier</button>
              </div>
            </fieldset>

            <div id="historical-date" class="historical-date" hidden>
              <label class="field-label" for="date">Historical date</label>
              <input id="date" type="date" disabled />
              <p>This date stays selected only when you choose Add another.</p>
            </div>

            <details class="optional-details">
              <summary>Add note or record money in</summary>
              <div class="optional-details__content">
                <div>
                  <label class="field-label" for="description">Merchant or note</label>
                  <input id="description" type="text" maxlength="120" autocomplete="off" disabled />
                </div>
                <div>
                  <label class="field-label" for="direction">Transaction type</label>
                  <select id="direction" disabled>
                    <option value="outgoing">Cash outflow</option>
                    <option value="incoming">Money in</option>
                  </select>
                </div>
              </div>
            </details>

            <p class="entry-message" id="entry-message" role="alert" hidden></p>
            <button class="primary-button" id="save-expense" type="submit" disabled>Save expense</button>
            <p class="step-note" id="storage-note">Preparing private on-device storage…</p>
          </form>

          <div class="entry-success" id="entry-success" role="status" hidden>
            <span aria-hidden="true">✓</span>
            <div>
              <strong>Saved on this device</strong>
              <p id="entry-success-text"></p>
            </div>
            <div class="entry-success__actions">
              <button class="primary-button" id="add-another" type="button">Add another</button>
              <button class="secondary-button" id="entry-done" type="button">Done</button>
            </div>
          </div>
        </div>

        <dialog class="warning-dialog" id="entry-warning-dialog" aria-labelledby="warning-title">
          <p class="section-label">Check this entry</p>
          <h3 id="warning-title">Before you save</h3>
          <p id="entry-warning-text"></p>
          <div class="warning-dialog__actions">
            <button class="secondary-button" id="warning-cancel" type="button">Go back</button>
            <button class="primary-button" id="warning-confirm" type="button">Save anyway</button>
          </div>
        </dialog>

        <div class="promise-row" aria-label="Product promises">
          <div><span aria-hidden="true">◉</span><strong>Local</strong><small>Your data stays on this device</small></div>
          <div><span aria-hidden="true">⌁</span><strong>Fast</strong><small>Built to keep money tracking moving</small></div>
        </div>
      </section>

      <section class="view" data-view="transactions" aria-labelledby="transactions-title" hidden>
        <div class="view-heading">
          <div>
            <p class="section-label">History</p>
            <h2 id="transactions-title">Transactions</h2>
          </div>
        </div>
        <p class="view-feedback" id="transaction-feedback" role="status" hidden></p>
        <div class="bulk-bar" id="bulk-bar" hidden>
          <strong id="bulk-count">0 selected</strong>
          <select id="bulk-category" aria-label="New category for selected transactions"></select>
          <button class="compact-button" id="apply-bulk-category" type="button">Apply</button>
        </div>
        <div class="transaction-list" id="transaction-list" aria-live="polite"></div>
        <div class="empty-card" id="transactions-empty">
          <span class="empty-card__icon" aria-hidden="true">☷</span>
          <h3>Your history will live here</h3>
          <p>Current and backfilled expenses will appear together, organized by date.</p>
          <button class="secondary-button" data-go-to="add" type="button">Add your first expense</button>
        </div>
      </section>

      <section class="view" data-view="overview" aria-labelledby="overview-title" hidden>
        <div class="view-heading">
          <div>
            <p class="section-label">Monthly view</p>
            <h2 id="overview-title">Overview</h2>
          </div>
          <select class="month-select" id="overview-month" aria-label="Overview month"></select>
        </div>
        <p class="view-feedback" id="overview-feedback" role="status" hidden></p>
        <div class="metric-card metric-card--accent">
          <p>Cash outflow</p>
          <strong id="actual-month-outflow">—</strong>
          <small id="month-comparison">Add spending to see your monthly picture.</small>
        </div>
        <div class="metric-grid">
          <div class="metric-card"><p>Monthly run rate</p><strong id="monthly-run-rate">—</strong><small id="run-rate-months">Complete months only</small></div>
          <div class="metric-card"><p>Funding outlook</p><strong id="funding-outlook">—</strong><small id="funding-label">Add planning dates and funds</small></div>
        </div>
        <section class="projection-card" aria-labelledby="projection-title">
          <div class="projection-card__heading">
            <div>
              <p class="section-label">Forecast</p>
              <h3 id="projection-title">Long-range projection</h3>
            </div>
            <button class="text-button" id="edit-projection-settings" type="button">Edit inputs</button>
          </div>
          <div class="projection-grid">
            <div><small>Annual projection</small><strong id="annual-projection">—</strong></div>
            <div><small>Remaining planned spend</small><strong id="remaining-projection">—</strong></div>
            <div><small>Total plan projection</small><strong id="total-program-projection">—</strong></div>
            <div><small>Actual period outflow</small><strong id="actual-program-outflow">—</strong></div>
          </div>
          <p class="projection-assumptions" id="projection-assumptions">Add planning dates to calculate a forecast.</p>
        </section>
        <section class="breakdown-card" aria-labelledby="breakdown-title">
          <div class="breakdown-card__heading">
            <h3 id="breakdown-title">Category breakdown</h3>
            <button class="text-button" id="toggle-month-complete" type="button">Mark incomplete</button>
          </div>
          <div class="category-breakdown" id="category-breakdown"></div>
          <p class="empty-breakdown" id="empty-breakdown">No outgoing transactions in this month.</p>
        </section>
        <p class="cashflow-warning">Cash outflow counts every outgoing entry, including transfers and credit-card payments. This can overstate consumption spending.</p>
      </section>

      <section class="view" data-view="settings" aria-labelledby="settings-title" hidden>
        <div class="view-heading">
          <div>
            <p class="section-label">Preferences</p>
            <h2 id="settings-title">Settings</h2>
          </div>
        </div>
        <div class="settings-list">
          <button id="open-categories" type="button"><span><strong>Categories</strong><small>Create and organize spending categories</small></span><b>›</b></button>
          <button id="open-projection-settings" type="button"><span><strong>Planning dates and funds</strong><small id="projection-settings-summary">Set the period used by projections</small></span><b>›</b></button>
          <button id="open-data-privacy" type="button"><span><strong>Data and privacy</strong><small id="storage-summary">Preparing local storage…</small></span><b>›</b></button>
        </div>
        <p class="privacy-note"><span aria-hidden="true">●</span> No bank login, analytics, or advertising connections.</p>
      </section>
    </main>

    <dialog class="manager-dialog" id="category-dialog" aria-labelledby="category-dialog-title">
      <div class="manager-dialog__header">
        <div>
          <p class="section-label">Settings</p>
          <h2 id="category-dialog-title">Categories</h2>
        </div>
        <button class="icon-button" id="close-categories" type="button" aria-label="Close categories">×</button>
      </div>
      <p class="manager-intro">Your changes update past and future spending views immediately.</p>
      <form class="new-category" id="new-category-form">
        <label class="field-label" for="new-category-name">New category</label>
        <div>
          <input id="new-category-name" type="text" maxlength="40" autocomplete="off" placeholder="e.g. Recruiting" />
          <button class="compact-button" type="submit">Add</button>
        </div>
      </form>
      <p class="view-feedback" id="category-feedback" role="status" hidden></p>
      <div class="category-list" id="category-list"></div>
    </dialog>

    <dialog class="warning-dialog" id="delete-category-dialog" aria-labelledby="delete-category-title">
      <p class="section-label">Delete category</p>
      <h3 id="delete-category-title">Preserve the transaction history</h3>
      <p id="delete-category-copy"></p>
      <div id="replacement-category-field">
        <label class="field-label" for="replacement-category">Move existing transactions to</label>
        <select id="replacement-category"></select>
      </div>
      <p class="entry-message entry-message--error" id="delete-category-error" hidden></p>
      <div class="warning-dialog__actions">
        <button class="secondary-button" id="cancel-delete-category" type="button">Cancel</button>
        <button class="danger-button" id="confirm-delete-category" type="button">Delete category</button>
      </div>
    </dialog>

    <dialog class="manager-dialog transaction-dialog" id="transaction-dialog" aria-labelledby="transaction-dialog-title">
      <div class="manager-dialog__header">
        <div>
          <p class="section-label">Transaction</p>
          <h2 id="transaction-dialog-title">Edit entry</h2>
        </div>
        <button class="icon-button" id="close-transaction" type="button" aria-label="Close transaction editor">×</button>
      </div>
      <form id="transaction-form" class="edit-form">
        <label class="field-label" for="edit-amount">Amount</label>
        <input id="edit-amount" inputmode="decimal" autocomplete="off" />
        <label class="field-label" for="edit-category">Category</label>
        <select id="edit-category"></select>
        <label class="field-label" for="edit-date">Date</label>
        <input id="edit-date" type="date" />
        <label class="field-label" for="edit-description">Merchant or note</label>
        <input id="edit-description" type="text" maxlength="120" autocomplete="off" />
        <label class="field-label" for="edit-direction">Transaction type</label>
        <select id="edit-direction">
          <option value="outgoing">Cash outflow</option>
          <option value="incoming">Money in</option>
        </select>
        <label class="check-row"><input id="edit-excluded" type="checkbox" /><span><strong>Exclude from projections</strong><small>Keeps this entry in actual historical totals.</small></span></label>
        <p class="entry-message entry-message--error" id="transaction-edit-error" hidden></p>
        <div class="edit-form__actions">
          <button class="danger-link" id="request-delete-transaction" type="button">Delete</button>
          <button class="primary-button" type="submit">Save changes</button>
        </div>
      </form>
    </dialog>

    <dialog class="warning-dialog" id="delete-transaction-dialog" aria-labelledby="delete-transaction-title">
      <p class="section-label">Delete transaction</p>
      <h3 id="delete-transaction-title">Remove this entry?</h3>
      <p>This permanently removes the transaction from history, reports, and projections.</p>
      <div class="warning-dialog__actions">
        <button class="secondary-button" id="cancel-delete-transaction" type="button">Cancel</button>
        <button class="danger-button" id="confirm-delete-transaction" type="button">Delete transaction</button>
      </div>
    </dialog>

    <dialog class="manager-dialog" id="projection-settings-dialog" aria-labelledby="projection-settings-title">
      <div class="manager-dialog__header">
        <div>
          <p class="section-label">Forecast inputs</p>
          <h2 id="projection-settings-title">Planning dates and funds</h2>
        </div>
        <button class="icon-button" id="close-projection-settings" type="button" aria-label="Close projection settings">×</button>
      </div>
      <p class="manager-intro">These values stay on this device and can be changed at any time.</p>
      <form id="projection-settings-form" class="edit-form">
        <label class="field-label" for="mba-start-date">Planning start date</label>
        <input id="mba-start-date" type="date" />
        <label class="field-label" for="graduation-date">Graduation date</label>
        <input id="graduation-date" type="date" />
        <label class="field-label" for="available-funds">Current funds available</label>
        <div class="money-input"><span>$</span><input id="available-funds" inputmode="decimal" autocomplete="off" placeholder="0.00" /></div>
        <p class="entry-message entry-message--error" id="projection-settings-error" hidden></p>
        <button class="primary-button" type="submit">Save projection inputs</button>
      </form>
    </dialog>

    <dialog class="manager-dialog" id="data-privacy-dialog" aria-labelledby="data-privacy-title">
      <div class="manager-dialog__header">
        <div>
          <p class="section-label">Settings</p>
          <h2 id="data-privacy-title">Data and privacy</h2>
        </div>
        <button class="icon-button" id="close-data-privacy" type="button" aria-label="Close data and privacy">×</button>
      </div>
      <p class="manager-intro">Financial data stays in this app on this device. Nothing is sent to a bank, analytics service, or advertising network.</p>

      <section class="data-status-card" aria-labelledby="device-status-title">
        <h3 id="device-status-title">Device status</h3>
        <div class="status-row"><span>Storage</span><strong id="persistence-status">Checking…</strong></div>
        <div class="status-row"><span>Connection</span><strong id="offline-status">Checking…</strong></div>
        <div class="status-row"><span>Saved data</span><strong id="data-counts">Checking…</strong></div>
      </section>

      <section class="data-action-card" aria-labelledby="backup-title">
        <h3 id="backup-title">Backup</h3>
        <p>Download a JSON copy for safekeeping. The file is not encrypted or password-protected, so store it somewhere private.</p>
        <div class="data-action-grid">
          <button class="secondary-button" id="download-backup" type="button">Download backup</button>
          <button class="secondary-button" id="restore-backup" type="button">Restore backup</button>
        </div>
        <input class="visually-hidden" id="restore-file" type="file" accept=".json,application/json" tabindex="-1" aria-hidden="true" />
      </section>

      <section class="data-action-card data-action-card--danger" aria-labelledby="delete-all-title">
        <h3 id="delete-all-title">Delete all app data</h3>
        <p>Remove every transaction, custom category, and projection input from this device.</p>
        <button class="danger-button" id="request-delete-all" type="button">Delete all data</button>
      </section>
      <p class="view-feedback" id="data-privacy-feedback" role="status" hidden></p>
    </dialog>

    <dialog class="warning-dialog" id="restore-confirm-dialog" aria-labelledby="restore-confirm-title">
      <p class="section-label">Restore backup</p>
      <h3 id="restore-confirm-title">Replace all current data?</h3>
      <p id="restore-copy">This replaces the data currently stored in the app.</p>
      <div class="warning-dialog__actions">
        <button class="secondary-button" id="cancel-restore" type="button">Cancel</button>
        <button class="primary-button" id="confirm-restore" type="button">Replace and restore</button>
      </div>
    </dialog>

    <dialog class="warning-dialog" id="delete-all-dialog" aria-labelledby="delete-all-confirm-title">
      <p class="section-label">Delete all data</p>
      <h3 id="delete-all-confirm-title">Start over on this device?</h3>
      <p>This permanently deletes all transactions, custom categories, and projection settings. A downloaded backup can be restored later.</p>
      <div class="warning-dialog__actions">
        <button class="secondary-button" id="cancel-delete-all" type="button">Keep my data</button>
        <button class="danger-button" id="confirm-delete-all" type="button">Delete everything</button>
      </div>
    </dialog>

    <nav class="bottom-nav" aria-label="Primary navigation">
      ${$e.map(e=>`
            <button type="button" data-nav="${e.id}" aria-label="${e.label}" ${e.id==="add"?'aria-current="page"':""}>
              <span class="nav-icon" aria-hidden="true">${e.icon}</span>
              <span>${e.label}</span>
            </button>
          `).join("")}
    </nav>
  </div>

  <section class="privacy-cover" id="privacy-cover" aria-labelledby="privacy-cover-title" hidden>
    <div class="privacy-cover__mark" aria-hidden="true">5s</div>
    <p class="section-label">Privacy screen</p>
    <h2 id="privacy-cover-title">Your budget is covered</h2>
    <p>Your financial details stay hidden until you’re ready.</p>
    <button class="primary-button" id="dismiss-privacy-cover" type="button">Continue</button>
  </section>
`;function Oe(){const e=window.location.hash.replace("#","");return $e.some(t=>t.id===e)?e:"add"}function le(e,t=!0){document.querySelectorAll("[data-view]").forEach(a=>{a.hidden=a.dataset.view!==e}),document.querySelectorAll("[data-nav]").forEach(a=>{a.dataset.nav===e?a.setAttribute("aria-current","page"):a.removeAttribute("aria-current")}),t&&window.location.hash!==`#${e}`&&window.history.replaceState(null,"",`#${e}`),window.scrollTo({top:0,behavior:"instant"})}document.querySelectorAll("[data-nav]").forEach(e=>{e.addEventListener("click",()=>le(e.dataset.nav))});document.querySelectorAll("[data-go-to]").forEach(e=>{e.addEventListener("click",()=>le(e.dataset.goTo))});window.addEventListener("hashchange",()=>le(Oe(),!1));le(Oe(),!1);async function ut(){const e=document.querySelector("#category"),t=document.querySelector("#storage-note"),a=document.querySelector("#storage-summary");try{await D.initialize();const n=await D.getCategories(!1);if(e){const o=new Option("Select category","");e.replaceChildren(o,...n.map(d=>new Option(d.name,d.id)))}t&&(t.textContent="Saved entries stay in this browser on this device."),a&&(a.textContent=`Local database ready · ${n.length} categories`),He(n),dt(),qe(),et(),ct()}catch{e&&e.replaceChildren(new Option("Storage unavailable","")),t&&(t.textContent="Local storage is unavailable. No transaction can be saved.",t.classList.add("step-note--error")),a&&(a.textContent="Local database unavailable")}}ut();
