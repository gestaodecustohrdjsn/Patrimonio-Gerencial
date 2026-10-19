import { apiRequest } from "../lib/api.js";
import { toast } from "../components/toast.js";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const profiles=["ADMIN","GESTOR","OPERADOR","CONSULTA"];
let users=[],permissions=[],selected=null;
async function request(path,method="GET",body) {return apiRequest(path,{method,...(body?{body}:{})});}
export async function renderUsers(root) {
  root.innerHTML='<div class="loading">Carregando administração de usuários…</div>';
  try{
    const [a,b]=await Promise.all([request("/api/usuarios"),request("/api/permissoes")]);
    users=a.usuarios||[]; permissions=b.permissoes||[]; await draw(root);
  }catch(e){root.innerHTML='<div class="empty">Falha ao carregar usuários.</div>';toast(e.message,"error");}
}
async function draw(root) {
  const user=users.find(u=>u.id===selected);
  let overrides=[];
  if(user){try{overrides=(await request("/api/usuarios/"+user.id+"/permissoes")).excecoes||[];}catch(e){toast(e.message,"error");}}
  root.innerHTML=`
    <div class="page-header"><div><h1>Usuários e permissões</h1><p>Controle administrativo de contas e autorizações individuais.</p></div></div>
    <section class="panel"><div class="panel-header"><h2>Cadastrar usuário</h2></div>
      <form id="newUserForm" class="user-admin-form">
        <label>Nome<input name="nome" required maxlength="180"></label>
        <label>E-mail<input name="email" type="email" required></label>
        <label>Perfil<select name="perfil_acesso">${profiles.map(p=>`<option value="${p}">${p}</option>`).join("")}</select></label>
        <label>Senha temporária<input name="senha_temporaria" type="password" minlength="10" required autocomplete="new-password"></label>
        <button class="primary-button" type="submit">Criar conta</button>
      </form>
      <p class="user-admin-note">O usuário deverá alterar a senha no primeiro acesso. Compartilhe as credenciais por canal seguro.</p>
    </section>
    <section class="panel"><div class="panel-header"><h2>Usuários cadastrados</h2><span class="badge">${users.length}</span></div>
      <div class="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th>Ação</th></tr></thead>
      <tbody>${users.map(u=>`<tr><td><strong>${esc(u.nome)}</strong></td><td>${esc(u.email)}</td><td>${esc(u.perfil_acesso)}</td><td>${u.ativo?"Ativo":"Inativo"}</td><td><button type="button" class="ghost-button compact-button" data-user="${u.id}">Gerenciar</button></td></tr>`).join("")}</tbody></table></div>
    </section>
    ${user?`
    <section class="panel"><div class="panel-header"><div><h2>${esc(user.nome)}</h2><small>${esc(user.email)}</small></div></div>
      <form id="editUserForm" class="user-admin-form">
        <label>Nome<input name="nome" required maxlength="180" value="${esc(user.nome)}"></label>
        <label>Perfil<select name="perfil_acesso">${profiles.map(p=>`<option value="${p}" ${p===user.perfil_acesso?"selected":""}>${p}</option>`).join("")}</select></label>
        <label>Situação<select name="ativo"><option value="true" ${user.ativo?"selected":""}>Ativo</option><option value="false" ${!user.ativo?"selected":""}>Inativo</option></select></label>
        <button class="primary-button" type="submit">Salvar dados</button>
      </form>
      <form id="resetUserForm" class="user-admin-form">
        <label>Nova senha temporária<input name="senha_temporaria" type="password" minlength="10" required autocomplete="new-password"></label>
        <button class="ghost-button" type="submit">Redefinir senha</button>
      </form>
      <div class="report-template-section"><strong>Permissões individuais</strong>
      <small>Herdar mantém a regra do perfil. Exclusões administrativas são bloqueadas.</small>
      ${["GESTOR","OPERADOR"].includes(user.perfil_acesso)? `<form id="userPermissionsForm">
        <div class="user-permission-list">
        ${permissions.map(p=>{const individual=overrides.find(a=>a.permissao_codigo===p.codigo);
          return `<label class="user-permission-row"><span><strong>${esc(p.descricao)}</strong><small>${esc(p.modulo)} — ${esc(p.codigo)}</small></span>
            <select data-code="${esc(p.codigo)}" ${p.exclusiva_admin?"disabled":""}>
              <option value="inherit" ${!individual?"selected":""}>Herdar</option>
              <option value="allow" ${individual?.permitido===true?"selected":""}>Permitir</option>
              <option value="deny" ${individual?.permitido===false?"selected":""}>Bloquear</option>
            </select></label>`;
        }).join("")}</div>
        <div class="settings-editor-actions"><button class="primary-button" type="submit">Salvar permissões</button></div>
      </form>` : '<p class="user-admin-note">Exceções individuais disponíveis apenas para Gestor e Operador.</p>'}</div></section>`:""}
  `;
  root.querySelectorAll("[data-user]").forEach(b=>b.addEventListener("click",()=>{selected=b.dataset.user;draw(root);}));
  root.querySelector("#newUserForm").addEventListener("submit",e=>submit(e,root,async f=>{
    const email=String(f.get("email")||"").trim().toLowerCase();
    if(users.some(u=>String(u.email||"").trim().toLowerCase()===email)){
      toast("Já existe uma conta com este e-mail. Selecione Gerenciar na listagem.","error");
      return;
    }
    return request("/api/usuarios","POST",Object.fromEntries(f));
  }));
  root.querySelector("#editUserForm")?.addEventListener("submit",e=>submit(e,root,async f=>{
    if(!confirm("Alterar perfil ou situação pode encerrar sessões. Confirmar?"))return;
    return request("/api/usuarios/"+selected,"PATCH",{nome:f.get("nome"),perfil_acesso:f.get("perfil_acesso"),ativo:f.get("ativo")==="true"});
  }));
  root.querySelector("#resetUserForm")?.addEventListener("submit",e=>submit(e,root,async f=>{
    if(!confirm("Revogar sessões e redefinir a senha temporária?"))return;
    return request("/api/usuarios/"+selected+"/redefinir-senha","POST",{senha_temporaria:f.get("senha_temporaria")});
  }));
  root.querySelector("#userPermissionsForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    if(!confirm("Aplicar exceções individuais e revogar sessões da conta?"))return;
    const excecoes=[...e.currentTarget.querySelectorAll("[data-code]")].filter(x=>!x.disabled&&x.value!=="inherit")
      .map(x=>({codigo:x.dataset.code,permitido:x.value==="allow"}));
    try{await request("/api/usuarios/"+selected+"/permissoes","PUT",{excecoes});toast("Permissões atualizadas.","success");await draw(root);}
    catch(err){toast(err.message,"error");}
  });
}
async function submit(event,root,fn){
  event.preventDefault();
  const form=event.currentTarget;
  const btn=form.querySelector("[type=submit]");
  if(btn.disabled)return;
  btn.disabled=true;
  const previous=btn.textContent;
  btn.textContent="Aguarde…";
  try{
    const result=await fn(new FormData(form));
    if(!result)return;
    form.reset();
    toast("Operação registrada com sucesso.","success");
    try{
      users=(await request("/api/usuarios")).usuarios||[];
      await draw(root);
    }catch(refreshError){
      toast("Operação salva. Atualize a listagem para visualizar o resultado.","error");
    }
  }catch(e){
    toast(e.message||"Não foi possível concluir. Confira a lista antes de repetir.","error");
    // O banco pode ter confirmado uma gravação antes de uma falha na resposta.
    // Atualizar a lista evita tentar cadastrar a mesma conta novamente.
    try{
      users=(await request("/api/usuarios")).usuarios||[];
      await draw(root);
    }catch{}
  }finally{
    if(btn.isConnected){btn.disabled=false;btn.textContent=previous;}
  }
}
