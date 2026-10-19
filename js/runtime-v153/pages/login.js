import { signIn, signOut } from "../services/auth.js";
import { apiRequest } from "../lib/api.js";
import { toast } from "../components/toast.js";

export function renderLogin(root) {
  root.innerHTML = `
    <main class="login-page">
      <section class="login-card">
        <div class="login-brand"><div class="brand-mark">P+</div><div><strong>Patrimônio+</strong><small>Gestão patrimonial</small></div></div>
        <h1>Entrar</h1>
        <p>Entre com seu usuário do Patrimônio+.</p>
        <form id="loginForm" class="login-form">
          <label>E-mail<input id="loginEmail" type="email" required autocomplete="username"></label>
          <label>Senha<input id="loginPassword" type="password" required autocomplete="current-password"></label>
          <button class="primary-button" id="loginButton" type="submit">Entrar</button><small style="display:block;margin-top:12px;color:#66808c">Infraestrutura: API Patrimônio+ · build 1.9.1 — homologação</small>
        </form>
      </section>
    </main>`;

  document.querySelector("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.querySelector("#loginButton");
    button.disabled = true;
    button.textContent = "Entrando…";
    try {
      await signIn(document.querySelector("#loginEmail").value.trim(), document.querySelector("#loginPassword").value);
    } catch (error) {
      toast(error.message || "Não foi possível entrar.", "error");
      button.disabled = false;
      button.textContent = "Entrar";
    }
  });
}

export function renderPasswordChange(root) {
  root.innerHTML = `
  <main class="login-page"><section class="login-card">
    <h1>Atualização de senha obrigatória</h1>
    <p>Para continuar, defina uma senha definitiva com no mínimo 10 caracteres.</p>
    <form id="changePasswordForm" class="login-form">
      <label>Senha temporária<input name="atual" type="password" autocomplete="current-password" required></label>
      <label>Nova senha<input name="nova" type="password" autocomplete="new-password" minlength="10" required></label>
      <label>Confirmação<input name="confirmacao" type="password" autocomplete="new-password" minlength="10" required></label>
      <button class="primary-button" type="submit">Atualizar senha</button>
      <button class="ghost-button" id="cancelPasswordChange" type="button">Sair</button>
    </form></section></main>`;
  root.querySelector("#cancelPasswordChange").addEventListener("click",()=>signOut());
  root.querySelector("#changePasswordForm").addEventListener("submit",async event=>{
    event.preventDefault();
    const f=new FormData(event.currentTarget);
    if(f.get("nova")!==f.get("confirmacao")) {toast("Confirmação diferente da senha nova.","error");return;}
    const btn=event.currentTarget.querySelector("button[type=submit]");
    btn.disabled=true;
    try {
      await apiRequest("/api/auth/alterar-senha",{method:"POST",body:{senha_atual:f.get("atual"),nova_senha:f.get("nova")}});
      await signOut();
      toast("Senha atualizada. Entre novamente.","success");
    } catch(error) {
      toast(error.message||"Não foi possível alterar a senha.","error");
      btn.disabled=false;
    }
  });
}
