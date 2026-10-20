import { apiRequest } from "../lib/api.js";
import { toast } from "../components/toast.js";

const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const profiles={ADMIN:"Administrador",GESTOR:"Gestor",OPERADOR:"Operador",CONSULTA:"Consulta"};
const state={users:[],catalog:[],defaults:[],selected:null,overrides:[],search:"",filter:"TODOS",editing:false,busy:false,expanded:false,showOnlyCustom:false};

const request=(path,method="GET",body)=>apiRequest(path,{method,...(body===undefined?{}:{body})});
const profileOptions=selected=>Object.entries(profiles).map(([id,name])=>`<option value="${id}" ${id===selected?"selected":""}>${name}</option>`).join("");
function inherited(profile,code){return state.defaults.find(r=>r.perfil===profile && r.permissao_codigo===code)?.permitido===true;}
function overrideFor(code){return state.overrides.find(r=>r.permissao_codigo===code)?.permitido;}
function effective(profile,permission){
  if(permission.exclusiva_admin)return profile==="ADMIN";
  if(profile==="CONSULTA")return inherited(profile,permission.codigo);
  const individual=overrideFor(permission.codigo);
  return individual===undefined?inherited(profile,permission.codigo):individual;
}
function statusChip(active){return `<span class="user-status ${active?"is-active":"is-inactive"}">${active?"Ativo":"Inativo"}</span>`;}
const initials=name=>String(name||"U").trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||"").join("");

export async function renderUsers(root){
  root.innerHTML='<div class="loading">Carregando usuários e permissões…</div>';
  try{
    const [a,b]=await Promise.all([request("/api/usuarios"),request("/api/permissoes")]);
    state.users=a.usuarios||[];state.catalog=b.permissoes||[];state.defaults=b.regras_perfis||[];
    await loadSelected();
    draw(root);
  }catch(error){root.innerHTML=`<div class="page-header"><h1>Usuários e permissões</h1></div><section class="panel user-empty-state">Não foi possível carregar os usuários. ${escapeHtml(error.message)}</section>`;}
}
async function loadSelected(){
  const u=state.users.find(v=>v.id===state.selected);
  state.overrides=[];
  if(!u){state.selected=null;return;}
  try{state.overrides=(await request("/api/usuarios/"+u.id+"/permissoes")).excecoes||[];}
  catch(e){toast(e.message,"error");}
}
function draw(root){
  const total=state.users.length,active=state.users.filter(u=>u.ativo).length;
  const list=state.users.filter(u=>{
    const q=state.search.toLowerCase();
    return (state.filter==="TODOS"||u.perfil_acesso===state.filter||state.filter==="INATIVOS"&&!u.ativo)
      && [u.nome,u.email,profiles[u.perfil_acesso]].some(x=>String(x||"").toLowerCase().includes(q));
  });
  const selected=state.users.find(u=>u.id===state.selected);
  root.innerHTML=`
    <div class="page-header user-heading">
      <div><h1>Usuários e permissões</h1><p>Gerencie acessos, atribuições e exceções individuais.</p></div>
      <div class="header-actions"><button class="primary-button" id="userAddToggle" type="button">${state.expanded?"Fechar cadastro":"+ Novo usuário"}</button></div>
    </div>
    <div class="user-overview">
      <article><span>Contas cadastradas</span><strong>${total}</strong></article>
      <article><span>Usuários ativos</span><strong>${active}</strong></article>
      <article><span>Contas inativas</span><strong>${total-active}</strong></article>
    </div>
    ${state.expanded?`<section class="panel user-create-panel">
      <div class="panel-header"><div><h2>Novo usuário</h2><small>O primeiro acesso exigirá a troca da senha temporária.</small></div></div>
      <form id="userCreateForm" class="user-admin-form">
        <label>Nome completo<input name="nome" maxlength="180" required autocomplete="off" placeholder="Nome do usuário"></label>
        <label>E-mail institucional<input name="email" type="email" required autocomplete="off" placeholder="usuario@instituicao.com"></label>
        <label>Perfil inicial<select name="perfil_acesso">${profileOptions("OPERADOR")}</select></label>
        <label>Senha temporária<input name="senha_temporaria" type="password" minlength="10" maxlength="256" required autocomplete="new-password"></label>
        <div class="user-form-actions"><button type="submit" class="primary-button">Cadastrar usuário</button><button type="button" class="ghost-button" id="userCancelCreate">Cancelar</button></div>
      </form>
    </section>`:""}
    <section class="panel user-directory">
      <div class="panel-header"><div><h2>Contas institucionais</h2><small>Selecione um usuário para visualizar e administrar as permissões.</small></div><span class="badge">${list.length} exibido(s)</span></div>
      <div class="user-directory-tools">
        <label class="user-search-field">Pesquisar<input type="search" id="userSearch" placeholder="Nome, e-mail ou perfil…" value="${escapeHtml(state.search)}"></label>
        <label>Filtrar por perfil<select id="userProfileFilter"><option value="TODOS">Todos os perfis</option>${Object.entries(profiles).map(([code,label])=>`<option value="${code}" ${state.filter===code?"selected":""}>${label}</option>`).join("")}<option value="INATIVOS" ${state.filter==="INATIVOS"?"selected":""}>Contas inativas</option></select></label>
      </div>
      <div class="table-wrap"><table class="user-directory-table"><thead><tr><th>Usuário</th><th>Perfil</th><th>Situação</th><th>Acesso</th><th>Ação</th></tr></thead><tbody>
      ${list.map(u=>`<tr class="${u.id===state.selected?"user-selected":""}">
        <td><div class="user-person"><span class="user-avatar">${escapeHtml(initials(u.nome))}</span><span><strong>${escapeHtml(u.nome)}</strong><small>${escapeHtml(u.email)}</small></span></div></td>
        <td>${escapeHtml(profiles[u.perfil_acesso]||u.perfil_acesso)}</td><td>${statusChip(u.ativo)}</td>
        <td>${u.troca_senha_obrigatoria?'<span class="user-access-pending">Troca de senha pendente</span>':'<span class="user-access-ready">Senha definida</span>'}</td>
        <td><button type="button" class="ghost-button compact-button" data-user="${u.id}">${u.id===state.selected?"Selecionado":"Gerenciar"}</button></td>
      </tr>`).join("")||'<tr><td colspan="5">Nenhum usuário corresponde aos filtros.</td></tr>'}
      </tbody></table></div>
    </section>
    ${selected?renderDetails(selected):""}
  `;
  bind(root);
}
function renderDetails(u){
  const canCustom=["GESTOR","OPERADOR"].includes(u.perfil_acesso);
  const byModule=new Map();
  for(const p of state.catalog){if(!byModule.has(p.modulo))byModule.set(p.modulo,[]);byModule.get(p.modulo).push(p);}
  const different=state.overrides.length;
  return `<section class="panel user-detail-panel">
    <div class="panel-header user-detail-heading">
      <div class="user-person"><span class="user-avatar user-avatar-large">${escapeHtml(initials(u.nome))}</span><span><h2>${escapeHtml(u.nome)}</h2><small>${escapeHtml(u.email)}</small></span></div>
      <button class="ghost-button compact-button" id="userCloseDetails">Fechar</button>
    </div>
    <div class="user-detail-tabs"><button type="button" data-tab="identity" class="${!state.editing?"is-active":""}">Dados e acesso</button><button type="button" data-tab="permissions" class="${state.editing?"is-active":""}">Permissões ${canCustom?`(${different} exceções)`:""}</button></div>
    ${!state.editing?`
      <form id="userEditForm" class="user-admin-form">
        <label>Nome completo<input name="nome" value="${escapeHtml(u.nome)}" maxlength="180" required></label>
        <label>E-mail<input value="${escapeHtml(u.email)}" disabled><small>Identificador de acesso não editável nesta versão.</small></label>
        <label>Perfil<select name="perfil_acesso">${profileOptions(u.perfil_acesso)}</select></label>
        <label>Situação<select name="ativo"><option value="true" ${u.ativo?"selected":""}>Ativo</option><option value="false" ${!u.ativo?"selected":""}>Inativo</option></select></label>
        <div class="user-form-actions"><button type="submit" class="primary-button">Salvar alterações</button></div>
      </form>
      <div class="user-reset-section"><div><strong>Redefinir senha</strong><small>Encerra as sessões atuais e solicita nova senha no próximo acesso.</small></div>
        <form id="resetUserForm" class="user-reset-form"><input name="senha_temporaria" type="password" minlength="10" maxlength="256" required autocomplete="new-password" placeholder="Nova senha temporária"><button type="submit" class="ghost-button">Redefinir</button></form>
      </div>`:`
      <div class="user-permission-intro"><strong>Permissões de ${escapeHtml(profiles[u.perfil_acesso])}</strong>
        <p>Herdar segue o padrão do perfil. Exceções individuais podem permitir ou bloquear ações não administrativas.</p>
        ${!canCustom?'<p>Este perfil possui permissões fixas e não aceita exceções individuais.</p>':`<label class="user-only-custom"><input id="onlyCustomPermissions" type="checkbox" ${state.showOnlyCustom?"checked":""}> Mostrar somente exceções</label>`}
      </div>
      ${canCustom?`<form id="userPermissionsForm">
        <div class="user-permission-groups">
          ${[...byModule].map(([module,items])=>{
            const visible=state.showOnlyCustom?items.filter(p=>overrideFor(p.codigo)!==undefined):items;
            if(!visible.length)return "";
            return `<div class="user-permission-group"><h3>${escapeHtml(module)}</h3>
             ${visible.map(p=>{
                const custom=overrideFor(p.codigo),isLocked=p.exclusiva_admin;
                const granted=effective(u.perfil_acesso,p);
                return `<div class="user-permission-row">
                  <span><strong>${escapeHtml(p.descricao)}</strong><small>${escapeHtml(p.codigo)}</small>
                  <small class="user-permission-effective">${isLocked?"Restrita ao administrador":granted?"Acesso permitido":"Acesso bloqueado"} · ${custom===undefined?"Herdado do perfil":"Exceção individual"}</small></span>
                  <select aria-label="Permissão ${escapeHtml(p.descricao)}" data-code="${escapeHtml(p.codigo)}" ${isLocked?"disabled":""}>
                    <option value="inherit" ${custom===undefined?"selected":""}>Herdar</option>
                    <option value="allow" ${custom===true?"selected":""}>Permitir</option>
                    <option value="deny" ${custom===false?"selected":""}>Bloquear</option>
                  </select>
                </div>`;
              }).join("")}</div>`;
          }).join("")||'<p class="user-admin-note">Nenhuma exceção cadastrada.</p>'}
        </div>
        <div class="user-form-actions"><button type="submit" class="primary-button">Salvar permissões</button><button type="button" class="ghost-button" id="userRestoreAll">Restaurar padrão do perfil</button></div>
      </form>`:""}`}
  </section>`;
}
async function refresh(root){state.users=(await request("/api/usuarios")).usuarios||[];await loadSelected();draw(root);}
async function perform(root,form,operation){
  const btn=form.querySelector('[type="submit"]');if(btn.disabled)return;
  btn.disabled=true;const original=btn.textContent;btn.textContent="Salvando…";
  try{
    const result=await operation(new FormData(form));
    if(result===false)return;
    toast("Alterações salvas.","success");await refresh(root);
  }catch(e){
    toast(e.message,"error");
    try{await refresh(root);}catch{}
  }finally{if(btn.isConnected){btn.disabled=false;btn.textContent=original;}}
}
function bind(root){
  root.querySelector("#userAddToggle")?.addEventListener("click",()=>{state.expanded=!state.expanded;draw(root);});
  root.querySelector("#userCancelCreate")?.addEventListener("click",()=>{state.expanded=false;draw(root);});
  root.querySelector("#userSearch")?.addEventListener("input",e=>{
    state.search=e.target.value;
    const cursor=e.target.selectionStart;
    draw(root);
    const field=root.querySelector("#userSearch");field?.focus();field?.setSelectionRange(cursor,cursor);
  });
  root.querySelector("#userProfileFilter")?.addEventListener("change",e=>{state.filter=e.target.value;draw(root);});
  root.querySelectorAll("[data-user]").forEach(b=>b.addEventListener("click",async()=>{state.selected=b.dataset.user;state.editing=false;await loadSelected();draw(root);root.querySelector(".user-detail-panel")?.scrollIntoView({block:"start",behavior:"smooth"});}));
  root.querySelector("#userCloseDetails")?.addEventListener("click",()=>{state.selected=null;state.editing=false;draw(root);});
  root.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{state.editing=b.dataset.tab==="permissions";state.showOnlyCustom=false;draw(root);}));
  root.querySelector("#onlyCustomPermissions")?.addEventListener("change",e=>{state.showOnlyCustom=e.target.checked;draw(root);});
  root.querySelector("#userCreateForm")?.addEventListener("submit",e=>{e.preventDefault();perform(root,e.currentTarget,async f=>{
    const email=String(f.get("email")||"").trim().toLowerCase();
    if(state.users.some(u=>String(u.email||"").toLowerCase()===email)){toast("E-mail já cadastrado. Selecione Gerenciar.","error");return false;}
    const created=await request("/api/usuarios","POST",Object.fromEntries(f));
    state.selected=created.usuario?.id||null;state.expanded=false;state.editing=false;
  });});
  root.querySelector("#userEditForm")?.addEventListener("submit",e=>{e.preventDefault();perform(root,e.currentTarget,async f=>{
    const u=state.users.find(x=>x.id===state.selected);
    const profile=f.get("perfil_acesso"),active=f.get("ativo")==="true";
    if(profile!==u.perfil_acesso || active!==u.ativo){
      if(!confirm("Alterar perfil ou situação revogará as sessões. Alterações de perfil também limparão exceções individuais. Continuar?"))return false;
    }
    await request("/api/usuarios/"+u.id,"PATCH",{nome:f.get("nome"),perfil_acesso:profile,ativo:active});
  });});
  root.querySelector("#resetUserForm")?.addEventListener("submit",e=>{e.preventDefault();perform(root,e.currentTarget,async f=>{
    if(!confirm("Redefinir a senha e encerrar as sessões desta conta?"))return false;
    await request("/api/usuarios/"+state.selected+"/redefinir-senha","POST",{senha_temporaria:f.get("senha_temporaria")});
  });});
  root.querySelector("#userPermissionsForm")?.addEventListener("submit",e=>{e.preventDefault();savePermissions(root,e.currentTarget);});
  root.querySelector("#userRestoreAll")?.addEventListener("click",()=>{
    if(!confirm("Remover todas as exceções deste usuário e restaurar as permissões do perfil?"))return;
    savePermissions(root,null,true);
  });
}
async function savePermissions(root,form,restore=false){
  const u=state.users.find(x=>x.id===state.selected);
  if(!u || !["GESTOR","OPERADOR"].includes(u.perfil_acesso))return;
  if(!restore && state.showOnlyCustom){
    toast("Desative o filtro de exceções para salvar a matriz completa.","error");return;
  }
  const exceptions=restore?[]:[...form.querySelectorAll("[data-code]")].filter(el=>!el.disabled&&el.value!=="inherit")
    .map(el=>({codigo:el.dataset.code,permitido:el.value==="allow"}));
  if(!restore && !confirm("Aplicar permissões individuais e encerrar sessões do usuário?"))return;
  const button=form?.querySelector('[type="submit"]');if(button)button.disabled=true;
  try{
    await request("/api/usuarios/"+u.id+"/permissoes","PUT",{excecoes:exceptions});
    await loadSelected();state.showOnlyCustom=false;draw(root);
    toast("Permissões atualizadas.","success");
  }catch(e){toast(e.message,"error");if(button?.isConnected)button.disabled=false;}
}
