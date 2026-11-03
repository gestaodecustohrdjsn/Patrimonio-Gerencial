import { escapeHtml } from "./lib/utils.js";
import { toast } from "./components/toast.js";
import { getPublicQrConfig, savePublicQrConfig } from "./services/configuracoes.js?v=1.10.0";

const FIELDS = [
  ["id_interna","ID interna",false],
  ["id_ses","ID SES",false],
  ["descricao_catalogo","Item do Catálogo",false],
  ["descricao_complementar","Descrição complementar",false],
  ["tipo","Tipo",false],
  ["marca_modelo","Marca / Modelo",false],
  ["centro_custo","Centro de custo",false],
  ["mobilidade","Mobilidade",false],
  ["estado_conservacao","Estado de conservação",false],
  ["status","Status",false],
  ["manutencao","Condição de manutenção",false],
  ["centros_permitidos","Centros permitidos",false],
  ["forma_aquisicao","Forma de aquisição",false],
  ["data_aquisicao","Data de aquisição",false],
  ["valor_aquisicao","Valor de aquisição",true],
  ["nota_fiscal","Nota fiscal",true],
  ["ultima_atualizacao","Última atualização",false]
];

const DEFAULT = {
  ativo:true,
  instituicao:"Hospital Regional Dr. José de Simone Netto",
  titulo:"Consulta pública de patrimônio",
  subtitulo:"Identificação e situação atual do bem",
  texto_orientacao:"As informações abaixo são disponibilizadas somente para consulta e identificação do patrimônio.",
  rodape:"Patrimônio+ · Consulta pública",
  mensagem_inativo:"Este patrimônio está inativo no acervo.",
  mensagem_manutencao:"Este patrimônio está atualmente em manutenção.",
  logo_data_url:null,
  logo_nome:null,
  campos:{
    id_interna:true,id_ses:true,descricao_catalogo:true,descricao_complementar:true,tipo:true,
    marca_modelo:true,centro_custo:true,mobilidade:true,estado_conservacao:true,status:true,
    manutencao:true,centros_permitidos:false,forma_aquisicao:false,data_aquisicao:false,
    valor_aquisicao:false,nota_fiscal:false,ultima_atualizacao:true
  }
};

let config=null;
let loaded=false;
let loading=false;
let meta=null;

function normalize(value) {
  const input=value && typeof value==="object" ? value : {};
  return {
    ...DEFAULT,
    ...input,
    ativo:Object.prototype.hasOwnProperty.call(input,"ativo") ? Boolean(input.ativo) : true,
    campos:{...DEFAULT.campos,...(input.campos||{}),id_interna:true}
  };
}

function formatMeta(value) {
  if(!value) return "";
  try { return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(value)); }
  catch { return ""; }
}

function previewHtml(c) {
  const visible=FIELDS.filter(([key])=>c.campos?.[key]).slice(0,8);
  return \`
    <div class="public-qr-preview \${c.ativo ? "" : "is-disabled"}">
      <div class="public-qr-preview-brand">
        \${c.logo_data_url ? \`<img src="\${escapeHtml(c.logo_data_url)}" alt="Logo">\` : '<div class="brand-mark">P+</div>'}
        <div><strong>\${escapeHtml(c.instituicao || "Patrimônio+")}</strong><small>\${escapeHtml(c.titulo || "Consulta pública")}</small></div>
      </div>
      <div class="public-qr-preview-hero">
        <span>Consulta pública · somente visualização</span>
        <strong>Cadeira de Rodas</strong>
        <small>\${escapeHtml(c.subtitulo || "")}</small>
        <b>ID 11126-0001</b>
      </div>
      <div class="public-qr-preview-fields">
        \${visible.map(([key,label,sensitive])=>\`<span class="\${sensitive?"is-sensitive":""}">\${escapeHtml(label)}</span>\`).join("")}
      </div>
      <p>\${escapeHtml(c.texto_orientacao || "")}</p>
      <footer>\${escapeHtml(c.rodape || "")}</footer>
      \${!c.ativo ? '<div class="public-qr-preview-disabled">Consulta pública desativada</div>' : ""}
    </div>\`;
}

function editorHtml(c) {
  return \`
    <div class="report-template-editor">
      <div class="report-template-intro">
        <strong>Consulta pública do patrimônio</strong>
        <p>As alterações valem para todos os QRs existentes. Não é necessário gerar novas etiquetas.</p>
      </div>

      <div class="public-qr-status \${c.ativo ? "is-active" : "is-disabled"}">
        <div><strong>\${c.ativo ? "Consulta pública ativa" : "Consulta pública desativada"}</strong><span>\${c.ativo ? "Os QRs podem ser consultados normalmente." : "Os QRs continuam válidos, mas a API pública não entrega dados."}</span></div>
        <label class="switch-line"><input id="publicQrEnabled" type="checkbox" \${c.ativo?"checked":""}> Permitir consulta pública</label>
      </div>

      <div class="report-template-step"><span>1</span><div><strong>Identidade e textos</strong><small>Cabeçalho, orientação e mensagens da página pública.</small></div></div>
      <div class="report-template-fields">
        <label>Instituição<input id="publicQrInstitution" maxlength="180" value="\${escapeHtml(c.instituicao||"")}"></label>
        <label>Título<input id="publicQrTitle" maxlength="180" value="\${escapeHtml(c.titulo||"")}"></label>
        <label class="full">Subtítulo<input id="publicQrSubtitle" maxlength="220" value="\${escapeHtml(c.subtitulo||"")}"></label>
        <label class="full">Texto de orientação<textarea id="publicQrGuidance" rows="3" maxlength="600">\${escapeHtml(c.texto_orientacao||"")}</textarea></label>
        <label class="full">Rodapé<textarea id="publicQrFooter" rows="2" maxlength="300">\${escapeHtml(c.rodape||"")}</textarea></label>
        <label class="full">Mensagem para patrimônio inativo<input id="publicQrInactiveMessage" maxlength="300" value="\${escapeHtml(c.mensagem_inativo||"")}"></label>
        <label class="full">Mensagem para patrimônio em manutenção<input id="publicQrMaintenanceMessage" maxlength="300" value="\${escapeHtml(c.mensagem_manutencao||"")}"></label>
      </div>

      <div class="report-template-section">
        <div class="report-template-step"><span>2</span><div><strong>Identidade visual</strong><small>Logo institucional opcional.</small></div></div>
        <div class="report-template-logo-editor">
          \${c.logo_data_url ? \`<img src="\${escapeHtml(c.logo_data_url)}" alt="Logo"><span>\${escapeHtml(c.logo_nome||"Logo configurado")}</span>\` : '<div class="report-template-logo-placeholder">Sem logo</div>'}
          <label class="secondary-button file-button">Selecionar imagem<input id="publicQrLogo" type="file" accept="image/png,image/jpeg,image/webp" hidden></label>
          \${c.logo_data_url ? '<button class="ghost-button compact-button" type="button" data-action="remove-public-qr-logo">Remover</button>' : ""}
        </div>
        <small>PNG, JPG ou WEBP, até 300 KB.</small>
      </div>

      <div class="report-template-section">
        <div class="report-template-step"><span>3</span><div><strong>Informações públicas</strong><small>Desmarcar um campo impede que a API pública envie aquele dado.</small></div></div>
        <div class="public-privacy-note"><strong>Privacidade por padrão</strong><span>Valor de aquisição e Nota Fiscal iniciam desativados. Se habilitados, qualquer pessoa com o QR poderá consultá-los.</span></div>
        <div class="config-checkbox-grid public-qr-field-grid">
          \${FIELDS.map(([key,label,sensitive])=>\`<label class="\${sensitive?"is-sensitive":""}"><input type="checkbox" data-public-qr-field="\${key}" \${c.campos?.[key]?"checked":""} \${key==="id_interna"?"disabled":""}> \${escapeHtml(label)}\${key==="id_interna"?' <small>Obrigatório</small>':sensitive?' <small>Público sensível</small>':""}</label>\`).join("")}
        </div>
      </div>

      <div class="report-template-section">
        <div class="report-template-step"><span>4</span><div><strong>Prévia</strong><small>Exemplo simplificado com dados fictícios.</small></div></div>
        \${previewHtml(c)}
      </div>

      <div class="settings-editor-actions">
        <button class="ghost-button" type="button" data-action="reset-public-qr-config">Restaurar padrão</button>
        <button class="primary-button" type="button" data-action="save-public-qr-config">Salvar configuração</button>
      </div>
      \${meta?.atualizado_em ? \`<small class="settings-update-meta">Última alteração: \${escapeHtml(formatMeta(meta.atualizado_em))}\${meta?.atualizado_por?.nome ? \` · \${escapeHtml(meta.atualizado_por.nome)}\` : ""}</small>\` : ""}
    </div>\`;
}

export function publicQrSettingsCardHtml(open) {
  const c=normalize(config);
  return \`
    <section class="settings-card \${open ? "is-open" : ""}">
      <button class="settings-card-toggle" type="button" data-setting-card="qr-template" aria-expanded="\${open}">
        <div class="settings-card-icon">QR</div>
        <div class="settings-card-title">
          <strong>Página Pública do QR Code</strong>
          <span>Controle identidade visual, textos e quais dados podem ser consultados publicamente.</span>
        </div>
        <span class="settings-card-chevron">\${open ? "−" : "+"}</span>
      </button>
      <div class="settings-card-content" \${open ? "" : "hidden"}>
        \${!loaded ? '<div class="loading">Carregando configuração…</div>' : editorHtml(c)}
      </div>
    </section>\`;
}

function readForm() {
  const current=normalize(config);
  const campos={};
  for(const [key] of FIELDS) campos[key]=key==="id_interna" ? true : Boolean(document.querySelector('[data-public-qr-field="'+key+'"]')?.checked);
  return normalize({
    ativo:Boolean(document.querySelector("#publicQrEnabled")?.checked),
    instituicao:document.querySelector("#publicQrInstitution")?.value.trim() || "",
    titulo:document.querySelector("#publicQrTitle")?.value.trim() || "",
    subtitulo:document.querySelector("#publicQrSubtitle")?.value.trim() || "",
    texto_orientacao:document.querySelector("#publicQrGuidance")?.value.trim() || "",
    rodape:document.querySelector("#publicQrFooter")?.value.trim() || "",
    mensagem_inativo:document.querySelector("#publicQrInactiveMessage")?.value.trim() || "",
    mensagem_manutencao:document.querySelector("#publicQrMaintenanceMessage")?.value.trim() || "",
    logo_data_url:current.logo_data_url,
    logo_nome:current.logo_nome,
    campos
  });
}

async function readLogo(file) {
  if(!["image/png","image/jpeg","image/webp"].includes(file.type)) throw new Error("Use logo em PNG, JPG ou WEBP.");
  if(file.size>300*1024) throw new Error("O logo deve ter no máximo 300 KB.");
  return await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||""));
    reader.onerror=()=>reject(new Error("Falha ao ler o logo."));
    reader.readAsDataURL(file);
  });
}

export function bindPublicQrSettingsCard({open=false,rerender=()=>{}}={}) {
  if(!open) return;
  if(!loaded && !loading) {
    loading=true;
    getPublicQrConfig().then(result=>{
      config=normalize(result.configuracao);
      meta={atualizado_em:result.atualizado_em,atualizado_por:result.atualizado_por};
      loaded=true;
    }).catch(error=>toast("Não foi possível carregar a configuração da página pública: "+error.message,"error"))
      .finally(()=>{loading=false;rerender();});
    return;
  }
  if(!loaded) return;

  const syncPreview=()=>{
    config=readForm();
    const old=document.querySelector(".public-qr-preview");
    if(old) old.outerHTML=previewHtml(config);
  };
  document.querySelectorAll("#publicQrEnabled,#publicQrInstitution,#publicQrTitle,#publicQrSubtitle,#publicQrGuidance,#publicQrFooter,#publicQrInactiveMessage,#publicQrMaintenanceMessage,[data-public-qr-field]").forEach(control=>{
    const eventName=(control.tagName==="INPUT" && control.type!=="checkbox") || control.tagName==="TEXTAREA" ? "input" : "change";
    control.addEventListener(eventName,syncPreview);
  });
  document.querySelector("#publicQrLogo")?.addEventListener("change",async event=>{
    const file=event.target.files?.[0]; if(!file) return;
    try { config={...readForm(),logo_data_url:await readLogo(file),logo_nome:file.name}; rerender(); }
    catch(error){toast(error.message,"error");}
  });
  document.querySelector('[data-action="remove-public-qr-logo"]')?.addEventListener("click",()=>{config={...readForm(),logo_data_url:null,logo_nome:null};rerender();});
  document.querySelector('[data-action="reset-public-qr-config"]')?.addEventListener("click",()=>{config=normalize(DEFAULT);loaded=true;rerender();});
  document.querySelector('[data-action="save-public-qr-config"]')?.addEventListener("click",async()=>{
    const next=readForm();
    if(!next.titulo){toast("Informe o título da página pública.","error");return;}
    const sensitive=[];
    if(next.campos.valor_aquisicao) sensitive.push("Valor de aquisição");
    if(next.campos.nota_fiscal) sensitive.push("Nota fiscal");
    if(sensitive.length && !window.confirm("Atenção: "+sensitive.join(" e ")+" ficará(ão) disponível(is) publicamente para qualquer pessoa que acessar o QR Code.\n\nDeseja continuar?")) return;
    const button=document.querySelector('[data-action="save-public-qr-config"]');
    if(button){button.disabled=true;button.textContent="Salvando…";}
    try{
      const result=await savePublicQrConfig(next);
      config=normalize(result.configuracao);
      meta={atualizado_em:result.atualizado_em,atualizado_por:null};
      toast("Configuração da página pública salva.","success");
      rerender();
    }catch(error){
      toast(error.message,"error");
      if(button){button.disabled=false;button.textContent="Salvar configuração";}
    }
  });
}
