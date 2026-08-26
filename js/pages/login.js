import { signIn } from "../services/auth.js";
import { toast } from "../components/toast.js";

export function renderLogin(root) {
  root.innerHTML = `
    <main class="login-page">
      <section class="login-card">
        <div class="login-brand"><div class="brand-mark">P+</div><div><strong>Patrimônio+</strong><small>Gestão patrimonial</small></div></div>
        <h1>Entrar</h1>
        <p>Use seu usuário do Patrimônio+.</p>
        <form id="loginForm" class="login-form">
          <label>E-mail<input id="loginEmail" type="email" required autocomplete="username"></label>
          <label>Senha<input id="loginPassword" type="password" required autocomplete="current-password"></label>
          <button class="primary-button" id="loginButton" type="submit">Entrar</button>
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
