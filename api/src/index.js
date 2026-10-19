import { database } from "./db.js";
import { randomToken, randomSalt, sha256, passwordHash, constantTimeEqual } from "./security.js";

function corsHeaders(env, request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGIN || "").trim();
  return {
    "Access-Control-Allow-Origin": origin && origin === allowed ? origin : allowed,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Setup-Token",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function responseJson(data, status, env, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(env, request) }
  });
}

async function bodyJson(request) {
  try { return await request.json(); } catch { return {}; }
}

function bearer(request) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

async function authenticate(request, sql) {
  const token = bearer(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const rows = await sql`
    select u.id,u.nome,u.email,u.perfil,u.ativo,s.id as sessao_id
    from sessoes s
    join usuarios u on u.id=s.usuario_id
    where s.token_hash=${tokenHash}
      and s.revogado_em is null
      and s.expira_em > now()
    limit 1
  `;
  const user = rows[0] || null;
  if (user) await sql`update sessoes set ultimo_uso_em=now() where id=${user.sessao_id}`;
  return user && user.ativo ? user : null;
}

function requireRole(user, roles) {
  return user && roles.includes(user.perfil);
}


function defaultReportTemplate() {
  return {
    instituicao: "Hospital Regional Dr. José de Simone Netto",
    unidade: "",
    titulo: "Relação Patrimonial por Centro de Custo",
    rodape: "Centro atual dos bens no momento da emissão.",
    assinatura_1: "Responsável pelo setor",
    assinatura_2: "Patrimônio",
    mostrar_data: true,
    mostrar_quantidade: true,
    mostrar_filtros: true,
    logo_data_url: null,
    logo_nome: null,
    colunas: {
      id_interna: true,
      id_ses: true,
      descricao: true,
      tipo: true,
      estado: true,
      mobilidade: true,
      status: true,
      manutencao: true,
      marca_modelo: false,
      data_aquisicao: false,
      valor_aquisicao: false
    }
  };
}

function sanitizeReportTemplate(input) {
  const base=defaultReportTemplate();
  const value=input && typeof input==="object" ? input : {};
  const text=(key,max)=>{
    const raw=String(value[key] ?? base[key] ?? "").trim();
    return raw.slice(0,max);
  };
  const columns={...base.colunas};
  if(value.colunas && typeof value.colunas==="object") {
    for(const key of Object.keys(columns)) {
      if(Object.prototype.hasOwnProperty.call(value.colunas,key)) columns[key]=Boolean(value.colunas[key]);
    }
  }
  if(!columns.id_interna && !columns.descricao) {
    throw new Error("VALIDATION:O template precisa exibir pelo menos ID interna ou Descrição.");
  }
  let logo=null;
  const rawLogo=value.logo_data_url;
  if(rawLogo!==null && rawLogo!==undefined && String(rawLogo).trim()!=="") {
    logo=String(rawLogo).trim();
    if(logo.length>400000) throw new Error("VALIDATION:A imagem do logo é grande demais. Use até aproximadamente 300 KB.");
    if(!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\r\n]+$/i.test(logo)) {
      throw new Error("VALIDATION:Formato de logo inválido. Use PNG, JPG ou WEBP.");
    }
  }
  return {
    instituicao:text("instituicao",180),
    unidade:text("unidade",180),
    titulo:text("titulo",180) || base.titulo,
    rodape:text("rodape",300),
    assinatura_1:text("assinatura_1",120),
    assinatura_2:text("assinatura_2",120),
    mostrar_data:Object.prototype.hasOwnProperty.call(value,"mostrar_data")?Boolean(value.mostrar_data):base.mostrar_data,
    mostrar_quantidade:Object.prototype.hasOwnProperty.call(value,"mostrar_quantidade")?Boolean(value.mostrar_quantidade):base.mostrar_quantidade,
    mostrar_filtros:Object.prototype.hasOwnProperty.call(value,"mostrar_filtros")?Boolean(value.mostrar_filtros):base.mostrar_filtros,
    logo_data_url:logo,
    logo_nome:logo ? text("logo_nome",180) : null,
    colunas:columns
  };
}

function normalizeCatalogText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}


function importAcquisition(value) {
  const n=normalizeCatalogText(value);
  if (!n) return null;
  if (n.includes("contrato") && n.includes("gestao")) return "CONTRATO_GESTAO";
  if (n.includes("doa")) return "DOACAO";
  if (n.includes("loca") || n.includes("alug")) return "LOCACAO";
  if (n.includes("compra") || n.includes("proprio") || n.includes("aquis")) return "COMPRA";
  if (["contrato_gestao","doacao","locacao","compra"].includes(String(value||"").trim().toLowerCase())) {
    return String(value).trim().toUpperCase();
  }
  return null;
}

function importType(value) {
  const n=normalizeCatalogText(value);
  if (!n) return null;
  const numeric=Number(value);
  if ([1,2,3].includes(numeric)) return numeric;
  if (n.includes("informat")) return 3;
  if (n.includes("mobil") || n.includes("moveis")) return 2;
  if (n.includes("medic") || n.includes("hospital")) return 1;
  return null;
}

function importStatus(value) {
  const n=normalizeCatalogText(value);
  if (!n) return "ATIVO";
  if (n.includes("inativo") || n.includes("baixado")) return "INATIVO";
  if (n.includes("ativo")) return "ATIVO";
  return null;
}

function importConservation(value) {
  const n=normalizeCatalogText(value);
  if (!n) return "BEM_CONSERVADO";
  if (n.includes("produto novo") || n==="novo") return "PRODUTO_NOVO";
  if (n.includes("bem conservado") || n.includes("conservado") || n.includes("bom")) return "BEM_CONSERVADO";
  if (n.includes("desgast")) return "DESGASTADO";
  if (n.includes("inutil")) return "INUTILIZAVEL";
  return null;
}

function importDate(value) {
  const raw=String(value||"").trim();
  if (!raw) return new Date().toISOString().slice(0,10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d=new Date(raw+"T00:00:00Z");
    return Number.isNaN(d.getTime()) ? null : raw;
  }
  const br=raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (br) {
    const iso=`${br[3]}-${br[2].padStart(2,"0")}-${br[1].padStart(2,"0")}`;
    const d=new Date(iso+"T00:00:00Z");
    return Number.isNaN(d.getTime()) ? null : iso;
  }
  return null;
}

function importNumber(value) {
  if (value===null || value===undefined || value==="") return null;
  if (typeof value==="number") return Number.isFinite(value) ? value : NaN;
  let raw=String(value).trim().replace(/R\$/gi,"").replace(/\s+/g,"");
  if (!raw || raw==="-") return null;
  if (raw.includes(",") && raw.includes(".")) raw=raw.replace(/\./g,"").replace(",",".");
  else if (raw.includes(",")) raw=raw.replace(",",".");
  const n=Number(raw);
  return n;
}

function addMapValue(map,key,value) {
  if (!key) return;
  if (!map.has(key)) map.set(key,[]);
  map.get(key).push(value);
}

async function simulateAssetImport(sql, rawRows) {
  if (!Array.isArray(rawRows) || rawRows.length<1 || rawRows.length>5000) {
    throw new Error("VALIDATION:O arquivo deve conter entre 1 e 5000 linhas.");
  }

  const [catalogRows,aliasRows,centerRows,existingSesRows]=await Promise.all([
    sql`select id,descricao,tipo_id,valor_padrao,origem_catalogo,ativo from descricoes_padrao where ativo=true order by descricao`,
    sql`select a.alias_normalizado,a.descricao_padrao_id,d.descricao,d.tipo_id,d.valor_padrao,d.origem_catalogo,d.ativo
        from catalogo_sigem_aliases a join descricoes_padrao d on d.id=a.descricao_padrao_id where d.ativo=true`,
    sql`select id,codigo,nome,ativo from centros_custo where ativo=true order by nome`,
    sql`select id_ses from patrimonios where id_ses is not null and btrim(id_ses)<>''`
  ]);

  const catalogByName=new Map();
  for (const item of catalogRows) addMapValue(catalogByName,normalizeCatalogText(item.descricao),item);

  const aliasByName=new Map();
  for (const item of aliasRows) {
    const key=String(item.alias_normalizado||"").trim() || normalizeCatalogText(item.descricao);
    if (key) aliasByName.set(key,item);
  }

  const centersByName=new Map();
  const centersByCode=new Map();
  for (const center of centerRows) {
    addMapValue(centersByName,normalizeCatalogText(center.nome),center);
    addMapValue(centersByCode,normalizeCatalogText(center.codigo),center);
  }

  const existingSes=new Set(existingSesRows.map(row=>normalizeCatalogText(row.id_ses)).filter(Boolean));
  const results=[];

  for (let index=0; index<rawRows.length; index++) {
    const source=rawRows[index]||{};
    const line=Number(source.linha||index+2);
    const errors=[];
    const warnings=[];

    const catalogName=String(source.descricao_catalogo||"").trim();
    const catalogKey=normalizeCatalogText(catalogName);
    const exactMatches=catalogByName.get(catalogKey)||[];
    let catalogItem=null;
    let catalogMatch="";

    if (!catalogKey) errors.push("Item do Catálogo vazio");
    else if (exactMatches.length===1) {
      catalogItem=exactMatches[0];
      catalogMatch="EXATO";
    } else if (exactMatches.length>1) {
      errors.push("Descrição corresponde a mais de um item do Catálogo");
    } else {
      const alias=aliasByName.get(catalogKey);
      if (alias) {
        catalogItem=alias;
        catalogMatch="ALIAS";
      } else errors.push("Item não encontrado no Catálogo");
    }

    const centerName=String(source.centro_nome||"").trim();
    const centerCode=String(source.centro_codigo||"").trim();
    const nameMatches=centerName ? (centersByName.get(normalizeCatalogText(centerName))||[]) : [];
    const codeMatches=centerCode ? (centersByCode.get(normalizeCatalogText(centerCode))||[]) : [];
    let center=null;

    if (codeMatches.length===1 && nameMatches.length===1 && codeMatches[0].id!==nameMatches[0].id) {
      errors.push("Código e nome apontam para centros de custo diferentes");
    } else if (codeMatches.length===1) {
      center=codeMatches[0];
      if (centerName && nameMatches.length===0) warnings.push("Centro localizado pelo código; nome do arquivo não coincidiu");
    } else if (nameMatches.length===1) {
      center=nameMatches[0];
      if (centerCode && codeMatches.length===0) warnings.push("Centro localizado pelo nome; código do arquivo não coincidiu");
    } else if (codeMatches.length>1 || nameMatches.length>1) {
      errors.push("Centro de custo ambíguo");
    } else {
      errors.push("Centro de custo não encontrado");
    }

    const acquisition=importAcquisition(source.tipo_aquisicao);
    if (!acquisition) errors.push("Aquisição não reconhecida");

    const date=importDate(source.data_aquisicao);
    if (!date) errors.push("Data de aquisição inválida");

    const status=importStatus(source.status);
    if (!status) errors.push("Status não reconhecido");

    const conservation=importConservation(source.estado_conservacao);
    if (!conservation) errors.push("Estado de conservação não reconhecido");

    const value=importNumber(source.valor_aquisicao);
    if (Number.isNaN(value) || (value!==null && value<0)) errors.push("Valor de aquisição inválido");

    const fileCatalogValue=importNumber(source.valor_referencia_arquivo);
    if (Number.isNaN(fileCatalogValue) || (fileCatalogValue!==null && fileCatalogValue<0)) warnings.push("Valor de referência do arquivo inválido");

    const fileType=importType(source.classificacao_origem);
    if (catalogItem && fileType && Number(catalogItem.tipo_id)!==fileType) {
      warnings.push("Classificação do arquivo diverge do Catálogo; será usado o Tipo do Catálogo");
    }

    if (catalogItem && fileCatalogValue!==null && Number.isFinite(fileCatalogValue) && catalogItem.valor_padrao!==null) {
      const dbValue=Number(catalogItem.valor_padrao);
      if (Number.isFinite(dbValue) && Math.abs(dbValue-fileCatalogValue)>0.005) {
        warnings.push("Valor de referência do arquivo diverge do Catálogo atual");
      }
    }

    let complement=String(source.descricao_complementar||"").trim();
    if (!complement && catalogItem) {
      complement=String(catalogItem.descricao||"").trim();
      warnings.push("Sem descrição complementar; será usado o nome do Catálogo como fallback");
    }

    const idSes=String(source.id_ses||"").trim() || null;
    if (!idSes) warnings.push("Sem ID SES");

    const finalValue=value!==null ? value : (catalogItem?.valor_padrao!==null && catalogItem?.valor_padrao!==undefined ? Number(catalogItem.valor_padrao) : null);
    if (finalValue===null || !Number.isFinite(finalValue)) warnings.push("Sem valor de aquisição e sem valor de referência");

    const result={
      linha:line,
      descricao_catalogo:catalogName,
      descricao_complementar:complement,
      id_ses_original:idSes,
      id_ses:idSes,
      catalog_match:catalogMatch,
      item_catalogo:catalogItem ? {
        id:catalogItem.id,
        descricao:catalogItem.descricao,
        tipo_id:Number(catalogItem.tipo_id),
        valor_padrao:catalogItem.valor_padrao,
        origem:catalogItem.origem_catalogo
      } : null,
      centro: center ? {id:center.id,codigo:center.codigo,nome:center.nome} : null,
      tipo_aquisicao:acquisition,
      data_aquisicao:date,
      valor_aquisicao:value,
      valor_final:finalValue,
      marca_modelo:String(source.marca_modelo||"").trim()||null,
      nota_fiscal_numero:String(source.nota_fiscal_numero||"").trim()||null,
      status:status||"ATIVO",
      estado_conservacao:conservation||"BEM_CONSERVADO",
      errors,
      warnings,
      duplicate_key:null,
      duplicate_existing:false,
      needs_id_resolution:false
    };
    results.push(result);
  }

  const sesGroups=new Map();
  for (const row of results) {
    const key=normalizeCatalogText(row.id_ses_original);
    if (!key) continue;
    if (!sesGroups.has(key)) sesGroups.set(key,[]);
    sesGroups.get(key).push(row);
  }

  const duplicateGroups=[];
  for (const [key,rows] of sesGroups) {
    const exists=existingSes.has(key);
    if (rows.length>1 || exists) {
      const display=rows[0].id_ses_original;
      duplicateGroups.push({
        key,
        id_ses:display,
        existing_in_db:exists,
        linhas:rows.map(row=>({
          linha:row.linha,
          descricao_catalogo:row.descricao_catalogo,
          descricao_complementar:row.descricao_complementar,
          centro:row.centro?.nome||null
        }))
      });
      for (const row of rows) {
        row.duplicate_key=key;
        row.duplicate_existing=exists;
        row.needs_id_resolution=true;
        row.warnings.push(exists ? "ID SES já existe no banco; confirme se deseja compartilhá-la também neste lote" : "ID SES repetida no arquivo; revise como deseja mantê-la");
      }
    }
  }

  for (const row of results) {
    row.level=row.errors.length ? "error" : (row.warnings.length ? "warning" : "ok");
    row.payload={
      linha:row.linha,
      id_ses:row.id_ses,
      descricao_complementar:row.descricao_complementar,
      descricao_padrao_id:row.item_catalogo?.id||null,
      data_aquisicao:row.data_aquisicao,
      valor_aquisicao:row.valor_aquisicao,
      nota_fiscal_numero:row.nota_fiscal_numero,
      centro_custo_id:row.centro?.id||null,
      marca_modelo:row.marca_modelo,
      tipo_aquisicao:row.tipo_aquisicao,
      status:row.status,
      estado_conservacao:row.estado_conservacao
    };
  }

  const summary={
    total:results.length,
    ok:results.filter(row=>row.level==="ok").length,
    warning:results.filter(row=>row.level==="warning").length,
    error:results.filter(row=>row.level==="error").length,
    catalogo_encontrado:results.filter(row=>row.item_catalogo).length,
    catalogo_nao_encontrado:results.filter(row=>!row.item_catalogo).length,
    centros_encontrados:results.filter(row=>row.centro).length,
    centros_nao_encontrados:results.filter(row=>!row.centro).length,
    grupos_id_ses:duplicateGroups.length
  };

  return {linhas:results,grupos_id_ses:duplicateGroups,resumo:summary};
}

async function hydrateAsset(sql, id) {
  const rows = await sql`
    select p.id,p.id_interna,p.id_ses,p.descricao,p.data_aquisicao,p.valor_aquisicao,
      p.nota_fiscal_numero,p.tipo_id,p.marca_modelo,p.status,p.tipo_aquisicao,
      p.estado_conservacao,p.mobilidade,p.criado_em,p.atualizado_em,p.removido,p.removido_em,p.public_token,
      exists(select 1 from manutencoes_patrimonio m where m.patrimonio_id=p.id and m.status='ABERTA') as em_manutencao,
      json_build_object('id',c.id,'codigo',c.codigo,'nome',c.nome) as centros_custo,
      case when d.id is null then null else json_build_object('id',d.id,'descricao',d.descricao,'valor_padrao',d.valor_padrao,'tipo_id',d.tipo_id,'origem',d.origem_catalogo,'fonte_valor',d.fonte_valor) end as descricoes_padrao,
      coalesce((
        select json_agg(json_build_object('id',cp.id,'codigo',cp.codigo,'nome',cp.nome) order by cp.nome)
        from patrimonio_centros_permitidos pcp
        join centros_custo cp on cp.id=pcp.centro_custo_id
        where pcp.patrimonio_id=p.id
      ),'[]'::json) as centros_permitidos
    from patrimonios p
    join centros_custo c on c.id=p.centro_custo_id
    left join descricoes_padrao d on d.id=p.descricao_padrao_id
    where p.id=${id}::uuid
    limit 1
  `;
  return rows[0] || null;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers:corsHeaders(env,request)});
    const url = new URL(request.url);
    const sql = database(env);

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        const r = await sql`select current_database() database,
          (select count(*)::int from centros_custo) centros,
          (select count(*)::int from descricoes_padrao) catalogo,
          (select count(*)::int from patrimonios where removido=false) patrimonios`;
        return responseJson({ok:true,service:"Patrimônio+ API",version:"3.6.0",database:r[0].database,counts:{centrosCusto:r[0].centros,itensCatalogo:r[0].catalogo,patrimonios:r[0].patrimonios}},200,env,request);
      }

      const pub = url.pathname.match(/^\/api\/public\/patrimonio\/([0-9a-f-]{36})$/i);
      if (request.method === "GET" && pub) {
        const rows = await sql`
          select p.id_interna,p.id_ses,p.descricao,p.tipo_id,p.marca_modelo,p.status,p.tipo_aquisicao,
            p.estado_conservacao,p.mobilidade,p.data_aquisicao,p.valor_aquisicao,p.nota_fiscal_numero,
            p.criado_em,p.atualizado_em,
            exists(select 1 from manutencoes_patrimonio m where m.patrimonio_id=p.id and m.status='ABERTA') as em_manutencao,
            json_build_object('id',c.id,'codigo',c.codigo,'nome',c.nome) as centros_custo,
            case when d.id is null then null else json_build_object('id',d.id,'descricao',d.descricao,'valor_padrao',d.valor_padrao,'tipo_id',d.tipo_id,'origem',d.origem_catalogo,'fonte_valor',d.fonte_valor) end as descricoes_padrao,
            coalesce((select json_agg(json_build_object('id',cp.id,'nome',cp.nome) order by cp.nome)
              from patrimonio_centros_permitidos pcp join centros_custo cp on cp.id=pcp.centro_custo_id
              where pcp.patrimonio_id=p.id),'[]'::json) as centros_permitidos
          from patrimonios p
          join centros_custo c on c.id=p.centro_custo_id
          left join descricoes_padrao d on d.id=p.descricao_padrao_id
          where p.public_token=${pub[1]}::uuid and p.removido=false
          limit 1`;
        if (!rows.length) return responseJson({ok:false,error:"Patrimônio não encontrado."},404,env,request);
        return responseJson({ok:true,patrimonio:rows[0]},200,env,request);
      }

      if (request.method === "POST" && url.pathname === "/api/auth/setup-password") {
        if (!env.SETUP_TOKEN || request.headers.get("X-Setup-Token") !== env.SETUP_TOKEN) {
          return responseJson({ok:false,error:"Token de configuração inválido."},403,env,request);
        }
        const body = await bodyJson(request);
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        if (!email || password.length < 10) return responseJson({ok:false,error:"Informe e-mail e senha com pelo menos 10 caracteres."},400,env,request);
        const salt = randomSalt();
        const iterations = Number(env.PASSWORD_ITERATIONS || 310000);
        const hash = await passwordHash(password,salt,iterations);
        const rows = await sql`update usuarios set password_hash=${hash},password_salt=${salt},password_iterations=${iterations},falhas_login=0,bloqueado_ate=null,atualizado_em=now() where lower(email)=${email} returning id,email`;
        if (!rows.length) return responseJson({ok:false,error:"Usuário não encontrado."},404,env,request);
        return responseJson({ok:true,email:rows[0].email},200,env,request);
      }

      if (request.method === "POST" && url.pathname === "/api/auth/login") {
        const body=await bodyJson(request);
        const email=String(body.email||"").trim().toLowerCase();
        const password=String(body.password||"");
        const rows=await sql`select id,nome,email,perfil,ativo,password_hash,password_salt,password_iterations,falhas_login,bloqueado_ate from usuarios where lower(email)=${email} limit 1`;
        const u=rows[0];
        if (!u || !u.ativo || !u.password_hash || (u.bloqueado_ate && new Date(u.bloqueado_ate)>new Date())) return responseJson({ok:false,error:"E-mail ou senha inválidos."},401,env,request);
        const hash=await passwordHash(password,u.password_salt,u.password_iterations||310000);
        if (!constantTimeEqual(hash,u.password_hash)) {
          const failures=Number(u.falhas_login||0)+1;
          if (failures>=5) await sql`update usuarios set falhas_login=0,bloqueado_ate=now()+interval '15 minutes' where id=${u.id}::uuid`;
          else await sql`update usuarios set falhas_login=${failures} where id=${u.id}::uuid`;
          return responseJson({ok:false,error:"E-mail ou senha inválidos."},401,env,request);
        }
        await sql`update usuarios set falhas_login=0,bloqueado_ate=null where id=${u.id}::uuid`;
        const token=randomToken(); const tokenHash=await sha256(token); const hours=Math.max(1,Math.min(72,Number(env.SESSION_HOURS||12)));
        await sql`insert into sessoes(usuario_id,token_hash,expira_em) values(${u.id}::uuid,${tokenHash},now()+(${hours}::text||' hours')::interval)`;
        return responseJson({ok:true,token,user:{id:u.id,nome:u.nome,email:u.email,perfil:u.perfil}},200,env,request);
      }

      const user=await authenticate(request,sql);
      if (!user) return responseJson({ok:false,error:"Sessão ausente, inválida ou expirada."},401,env,request);

      if (request.method === "POST" && url.pathname === "/api/auth/logout") {
        const token=bearer(request); if(token){const h=await sha256(token); await sql`update sessoes set revogado_em=now() where token_hash=${h}`;}
        return responseJson({ok:true},200,env,request);
      }
      if (request.method === "GET" && url.pathname === "/api/me") return responseJson({ok:true,user:{id:user.id,nome:user.nome,email:user.email,perfil:user.perfil}},200,env,request);

      if (request.method === "GET" && url.pathname === "/api/configuracoes/relacao-patrimonial") {
        const defaults=defaultReportTemplate();
        const rows=await sql`
          select c.id,c.valor,c.atualizado_em,
            case when u.id is null then null else json_build_object('id',u.id,'nome',u.nome) end as atualizado_por
          from configuracoes_sistema c
          left join usuarios u on u.id=c.atualizado_por
          where c.chave='RELACAO_PATRIMONIAL'
          limit 1
        `;
        const stored=rows[0]?.valor && typeof rows[0].valor==="object" ? rows[0].valor : {};
        const config={
          ...defaults,
          ...stored,
          colunas:{...defaults.colunas,...(stored.colunas||{})}
        };
        return responseJson({ok:true,configuracao:config,atualizado_em:rows[0]?.atualizado_em||null,atualizado_por:rows[0]?.atualizado_por||null},200,env,request);
      }

      if (request.method === "PUT" && url.pathname === "/api/configuracoes/relacao-patrimonial") {
        if(!requireRole(user,["ADMIN"])) return responseJson({ok:false,error:"Apenas administradores podem alterar o template da relação patrimonial."},403,env,request);
        const b=await bodyJson(request);
        let config;
        try { config=sanitizeReportTemplate(b.configuracao); }
        catch(error) {
          const msg=String(error?.message||error);
          if(msg.startsWith("VALIDATION:")) return responseJson({ok:false,error:msg.slice(11)},400,env,request);
          throw error;
        }
        const previousRows=await sql`select valor from configuracoes_sistema where chave='RELACAO_PATRIMONIAL' limit 1`;
        const previous=previousRows[0]?.valor||null;
        const previousAudit=previous ? {...previous,logo_data_url:previous.logo_data_url?"[logo configurado]":null} : null;
        const configAudit={...config,logo_data_url:config.logo_data_url?"[logo configurado]":null};
        const rows=await sql`
          insert into configuracoes_sistema(chave,valor,atualizado_por,atualizado_em)
          values('RELACAO_PATRIMONIAL',${JSON.stringify(config)}::jsonb,${user.id}::uuid,now())
          on conflict(chave) do update
          set valor=excluded.valor,atualizado_por=excluded.atualizado_por,atualizado_em=now()
          returning id,valor,atualizado_em
        `;
        await sql`
          insert into historico_alteracoes(tabela,registro_id,operacao,dados_anteriores,dados_novos,usuario_id)
          values(
            'configuracoes_sistema',
            ${rows[0].id}::uuid,
            'CONFIGURACAO_RELACAO_PATRIMONIAL',
            ${previousAudit?JSON.stringify(previousAudit):null}::jsonb,
            ${JSON.stringify(configAudit)}::jsonb,
            ${user.id}::uuid
          )
        `;
        return responseJson({ok:true,configuracao:rows[0].valor,atualizado_em:rows[0].atualizado_em},200,env,request);
      }

      if (request.method === "GET" && url.pathname === "/api/historico") {
        const limit=Math.min(200,Math.max(1,Number(url.searchParams.get("limit")||30)));
        const offset=Math.min(100000,Math.max(0,Number(url.searchParams.get("offset")||0)));
        const tabela=(url.searchParams.get("tabela")||"").trim().slice(0,80);
        const operacao=(url.searchParams.get("operacao")||"").trim().slice(0,120);
        const usuarioId=(url.searchParams.get("usuario_id")||"").trim();
        const q=(url.searchParams.get("q")||"").trim().slice(0,200);
        const inicio=(url.searchParams.get("inicio")||"").trim();
        const fim=(url.searchParams.get("fim")||"").trim();

        const rows=await sql`
          select
            h.id,
            h.tabela,
            h.registro_id,
            h.operacao,
            h.criado_em,
            (count(*) over())::int as total_filtrado,
            case when u.id is null then null else json_build_object('id',u.id,'nome',u.nome) end as usuario,
            case
              when h.tabela='patrimonios' then jsonb_build_object(
                'tipo','patrimonio',
                'id_interna',coalesce(p.id_interna,h.dados_novos->>'id_interna',h.dados_anteriores->>'id_interna'),
                'nome',coalesce(pd.descricao,p.descricao,h.dados_novos->>'descricao',h.dados_anteriores->>'descricao')
              )
              when h.tabela='centros_custo' then jsonb_build_object(
                'tipo','centro',
                'codigo',coalesce(cc.codigo,h.dados_novos->>'codigo',h.dados_anteriores->>'codigo'),
                'nome',coalesce(cc.nome,h.dados_novos->>'nome',h.dados_anteriores->>'nome')
              )
              when h.tabela='descricoes_padrao' then jsonb_build_object(
                'tipo','catalog_item',
                'nome',coalesce(dp.descricao,h.dados_novos->>'descricao',h.dados_anteriores->>'descricao'),
                'origem',coalesce(dp.origem_catalogo,h.dados_novos->>'origem',h.dados_anteriores->>'origem')
              )
              when h.tabela='catalogo_sigem_atualizacoes' then jsonb_build_object(
                'tipo','catalog_update',
                'nome',h.dados_novos->>'nome_arquivo'
              )
              when h.tabela='importacoes_patrimoniais' then jsonb_build_object(
                'tipo','asset_import',
                'nome',h.dados_novos->>'nome_arquivo'
              )
              when h.tabela='configuracoes_sistema' then jsonb_build_object(
                'tipo','configuracao',
                'nome','Template da Relação Patrimonial'
              )
              else jsonb_build_object('tipo',h.tabela)
            end as entidade,
            jsonb_build_object(
              'tipo_antes',h.dados_anteriores->>'tipo_id',
              'tipo_depois',h.dados_novos->>'tipo_id',
              'origem_nome',h.dados_novos#>>'{movimentacao,origem_nome}',
              'destino_nome',h.dados_novos#>>'{movimentacao,destino_nome}',
              'descricao',h.dados_novos->>'descricao',
              'codigo_antes',h.dados_anteriores->>'codigo',
              'codigo_depois',h.dados_novos->>'codigo',
              'nome_antes',h.dados_anteriores->>'nome',
              'nome_depois',h.dados_novos->>'nome',
              'ativo_antes',h.dados_anteriores->>'ativo',
              'ativo_depois',h.dados_novos->>'ativo',
              'quantidade_arquivo',h.dados_novos->>'quantidade_arquivo',
              'correspondencias_exatas',h.dados_novos->>'correspondencias_exatas',
              'correspondencias_alias',h.dados_novos->>'correspondencias_alias',
              'correspondencias_confirmadas',h.dados_novos->>'correspondencias_confirmadas',
              'novos_itens',h.dados_novos->>'novos_itens',
              'duplicados_adicionados',h.dados_novos->>'duplicados_adicionados',
              'ignorados',h.dados_novos->>'ignorados',
              'inativados',h.dados_novos->>'inativados',
              'reativados',h.dados_novos->>'reativados',
              'total_linhas',h.dados_novos->>'total_linhas',
              'total_importado',h.dados_novos->>'total_importado'
            ) as detalhes
          from historico_alteracoes h
          left join usuarios u on u.id=h.usuario_id
          left join patrimonios p on h.tabela='patrimonios' and p.id=h.registro_id
          left join centros_custo cc on h.tabela='centros_custo' and cc.id=h.registro_id
          left join descricoes_padrao dp on h.tabela='descricoes_padrao' and dp.id=h.registro_id
          left join descricoes_padrao pd on h.tabela='patrimonios'
            and pd.id=coalesce(
              p.descricao_padrao_id,
              nullif(h.dados_novos->>'descricao_padrao_id','')::uuid,
              nullif(h.dados_anteriores->>'descricao_padrao_id','')::uuid
            )
          where (${tabela}='' or h.tabela=${tabela})
            and (${operacao}='' or h.operacao ilike ${'%'+operacao+'%'})
            and (${usuarioId}='' or h.usuario_id::text=${usuarioId})
            and (${inicio}='' or h.criado_em >= nullif(${inicio},'')::date)
            and (${fim}='' or h.criado_em < (nullif(${fim},'')::date + interval '1 day'))
            and (
              ${q}=''
              or h.operacao ilike ${'%'+q+'%'}
              or h.tabela ilike ${'%'+q+'%'}
              or coalesce(u.nome,'') ilike ${'%'+q+'%'}
              or coalesce(p.id_interna,'') ilike ${'%'+q+'%'}
              or coalesce(p.id_ses,'') ilike ${'%'+q+'%'}
              or coalesce(p.descricao,'') ilike ${'%'+q+'%'}
              or coalesce(pd.descricao,'') ilike ${'%'+q+'%'}
              or coalesce(cc.codigo,'') ilike ${'%'+q+'%'}
              or coalesce(cc.nome,'') ilike ${'%'+q+'%'}
              or coalesce(h.dados_novos::text,'') ilike ${'%'+q+'%'}
              or coalesce(h.dados_anteriores::text,'') ilike ${'%'+q+'%'}
            )
          order by h.criado_em desc,h.id desc
          limit ${limit}
          offset ${offset}
        `;
        const usuarios=await sql`
          select distinct u.id,u.nome
          from historico_alteracoes h
          join usuarios u on u.id=h.usuario_id
          order by u.nome
        `;
        const total=rows.length ? Number(rows[0].total_filtrado||0) : 0;
        return responseJson({
          ok:true,
          eventos:rows.map(({total_filtrado,...row})=>row),
          total,
          limit,
          offset,
          usuarios
        },200,env,request);
      }

            if (request.method === "GET" && url.pathname === "/api/centros") {
        const rows=await sql`
          select c.id,c.codigo,c.nome,c.ativo,
            (select count(*)::int from patrimonios p where p.centro_custo_id=c.id and p.removido=false) as patrimonios
          from centros_custo c
          order by c.ativo desc,c.nome asc
        `;
        return responseJson({ok:true,centros:rows},200,env,request);
      }

      if (request.method === "POST" && url.pathname === "/api/centros") {
        if(!requireRole(user,["ADMIN"])) return responseJson({ok:false,error:"Apenas administradores podem cadastrar centros de custo."},403,env,request);
        const b=await bodyJson(request);
        const codigo=String(b.codigo||"").trim();
        const nome=String(b.nome||"").trim();
        if(!codigo||!nome) return responseJson({ok:false,error:"Código e nome do centro de custo são obrigatórios."},400,env,request);
        const duplicate=await sql`
          select id from centros_custo
          where lower(btrim(codigo))=lower(${codigo})
             or lower(btrim(nome))=lower(${nome})
          limit 1
        `;
        if(duplicate.length) return responseJson({ok:false,error:"Já existe um centro de custo com este código ou nome."},409,env,request);
        const rows=await sql`
          insert into centros_custo(codigo,nome,ativo)
          values(${codigo},${nome},true)
          returning id,codigo,nome,ativo
        `;
        await sql`
          insert into historico_alteracoes(tabela,registro_id,operacao,dados_novos,usuario_id)
          values('centros_custo',${rows[0].id}::uuid,'CADASTRO',jsonb_build_object('codigo',${codigo}::text,'nome',${nome}::text,'ativo',true),${user.id}::uuid)
        `;
        return responseJson({ok:true,centro:{...rows[0],patrimonios:0}},201,env,request);
      }

      const centerMatch=url.pathname.match(/^\/api\/centros\/([0-9a-f-]{36})$/i);
      if(centerMatch && request.method === "PATCH") {
        if(!requireRole(user,["ADMIN"])) return responseJson({ok:false,error:"Apenas administradores podem editar centros de custo."},403,env,request);
        const currentRows=await sql`select id,codigo,nome,ativo from centros_custo where id=${centerMatch[1]}::uuid limit 1`;
        const current=currentRows[0];
        if(!current) return responseJson({ok:false,error:"Centro de custo não encontrado."},404,env,request);
        const b=await bodyJson(request);
        const has=(key)=>Object.prototype.hasOwnProperty.call(b,key);
        const codigo=has("codigo")?String(b.codigo||"").trim():current.codigo;
        const nome=has("nome")?String(b.nome||"").trim():current.nome;
        const ativo=has("ativo")?Boolean(b.ativo):Boolean(current.ativo);
        if(!codigo||!nome) return responseJson({ok:false,error:"Código e nome do centro de custo são obrigatórios."},400,env,request);
        const duplicate=await sql`
          select id from centros_custo
          where id is distinct from ${centerMatch[1]}::uuid
            and (lower(btrim(codigo))=lower(${codigo}) or lower(btrim(nome))=lower(${nome}))
          limit 1
        `;
        if(duplicate.length) return responseJson({ok:false,error:"Já existe outro centro de custo com este código ou nome."},409,env,request);
        const rows=await sql`
          update centros_custo
          set codigo=${codigo},nome=${nome},ativo=${ativo}
          where id=${centerMatch[1]}::uuid
          returning id,codigo,nome,ativo
        `;
        await sql`
          insert into historico_alteracoes(tabela,registro_id,operacao,dados_anteriores,dados_novos,usuario_id)
          values(
            'centros_custo',${centerMatch[1]}::uuid,'EDICAO_CADASTRAL',
            jsonb_build_object('codigo',${current.codigo}::text,'nome',${current.nome}::text,'ativo',${Boolean(current.ativo)}::boolean),
            jsonb_build_object('codigo',${codigo}::text,'nome',${nome}::text,'ativo',${ativo}::boolean),
            ${user.id}::uuid
          )
        `;
        const countRows=await sql`select count(*)::int as total from patrimonios where centro_custo_id=${centerMatch[1]}::uuid and removido=false`;
        return responseJson({ok:true,centro:{...rows[0],patrimonios:countRows[0].total}},200,env,request);
      }

      if(centerMatch && request.method === "DELETE") {
        if(!requireRole(user,["ADMIN"])) return responseJson({ok:false,error:"Apenas administradores podem excluir centros de custo."},403,env,request);
        const currentRows=await sql`select id,codigo,nome,ativo from centros_custo where id=${centerMatch[1]}::uuid limit 1`;
        const current=currentRows[0];
        if(!current) return responseJson({ok:false,error:"Centro de custo não encontrado."},404,env,request);
        const b=await bodyJson(request);
        if(String(b.confirmation||"").trim()!==String(current.codigo)) return responseJson({ok:false,error:"Confirmação inválida. Digite exatamente o código do centro de custo."},400,env,request);
        const refs=await sql`
          select
            (select count(*)::int from patrimonios where centro_custo_id=${centerMatch[1]}::uuid) as patrimonios,
            (select count(*)::int from movimentacoes where origem_centro_custo_id=${centerMatch[1]}::uuid or destino_centro_custo_id=${centerMatch[1]}::uuid) as movimentacoes,
            (select count(*)::int from patrimonio_centros_permitidos where centro_custo_id=${centerMatch[1]}::uuid) as permissoes
        `;
        const used=Number(refs[0].patrimonios||0)+Number(refs[0].movimentacoes||0)+Number(refs[0].permissoes||0);
        if(used>0) {
          return responseJson({
            ok:false,
            error:"Este centro de custo já possui vínculos ou histórico. Inative-o em vez de excluir.",
            referencias:refs[0]
          },409,env,request);
        }
        await sql`
          insert into historico_alteracoes(tabela,registro_id,operacao,dados_anteriores,usuario_id)
          values(
            'centros_custo',${centerMatch[1]}::uuid,'EXCLUSAO_DEFINITIVA',
            jsonb_build_object('codigo',${current.codigo}::text,'nome',${current.nome}::text,'ativo',${Boolean(current.ativo)}::boolean),
            ${user.id}::uuid
          )
        `;
        await sql`delete from centros_custo where id=${centerMatch[1]}::uuid`;
        return responseJson({ok:true},200,env,request);
      }

      if (request.method === "GET" && url.pathname === "/api/catalogo/admin") {
        if(!requireRole(user,["ADMIN"])) return responseJson({ok:false,error:"Apenas administradores podem gerenciar o Catálogo."},403,env,request);
        const rows=await sql`
          select d.id,d.descricao,d.valor_padrao,d.tipo_id,d.ativo,d.origem_catalogo as origem,d.fonte_valor,d.atualizado_em,
            (select count(*)::int from patrimonios p where p.descricao_padrao_id=d.id and p.removido=false) as patrimonios_vinculados
          from descricoes_padrao d
          order by d.descricao
        `;
        return responseJson({ok:true,itens:rows},200,env,request);
      }

      if (request.method === "POST" && url.pathname === "/api/catalogo") {
        if(!requireRole(user,["ADMIN"])) return responseJson({ok:false,error:"Apenas administradores podem adicionar itens ao Catálogo."},403,env,request);
        const b=await bodyJson(request);
        const descricao=String(b.descricao||"").trim();
        const tipoId=Number(b.tipo_id);
        const valorRaw=b.valor_padrao;
        const valor=valorRaw===null||valorRaw===undefined||valorRaw===""?null:Number(valorRaw);
        const fonte=String(b.fonte_valor||"COTACAO_PROPRIA").trim().toUpperCase();
        if(!descricao) return responseJson({ok:false,error:"Descrição do item é obrigatória."},400,env,request);
        if(descricao.length>500) return responseJson({ok:false,error:"Descrição do item é grande demais."},400,env,request);
        if(![1,2,3].includes(tipoId)) return responseJson({ok:false,error:"Tipo do item é obrigatório."},400,env,request);
        if(valor!==null&&(!Number.isFinite(valor)||valor<0)) return responseJson({ok:false,error:"Valor de referência inválido."},400,env,request);
        if(!["COTACAO_PROPRIA","NOTA_FISCAL","OUTRA"].includes(fonte)) return responseJson({ok:false,error:"Fonte do valor inválida para item próprio."},400,env,request);
        const duplicate=await sql`select id,descricao,origem_catalogo from descricoes_padrao where lower(btrim(descricao))=lower(btrim(${descricao})) limit 1`;
        if(duplicate.length) return responseJson({ok:false,error:"Já existe um item com esta descrição no Catálogo.",existente:duplicate[0]},409,env,request);
        const rows=await sql`
          insert into descricoes_padrao(descricao,valor_padrao,tipo_id,ativo,origem_catalogo,fonte_valor,atualizado_em)
          values(${descricao},${valor},${tipoId},true,'PROPRIO',${valor===null?null:fonte},now())
          returning id,descricao,valor_padrao,tipo_id,ativo,origem_catalogo as origem,fonte_valor,atualizado_em
        `;
        await sql`
          insert into historico_alteracoes(tabela,registro_id,operacao,dados_novos,usuario_id)
          values('descricoes_padrao',${rows[0].id}::uuid,'ITEM_CATALOGO_CADASTRADO',
            jsonb_build_object('descricao',${descricao}::text,'tipo_id',${tipoId}::integer,'valor_padrao',${valor}::numeric,'origem','PROPRIO','fonte_valor',${valor===null?null:fonte}::text),
            ${user.id}::uuid)
        `;
        return responseJson({ok:true,item:rows[0]},201,env,request);
      }

      if (request.method === "GET" && url.pathname === "/api/catalogo/atualizacoes/contexto") {
        if(!requireRole(user,["ADMIN"])) return responseJson({ok:false,error:"Apenas administradores podem atualizar a base SIGEM."},403,env,request);
        const aliases=await sql`
          select a.id,a.alias_original,a.alias_normalizado,a.descricao_padrao_id,a.criado_em,
            d.descricao as item_catalogo_nome,d.tipo_id,d.ativo,d.origem_catalogo as origem
          from catalogo_sigem_aliases a
          join descricoes_padrao d on d.id=a.descricao_padrao_id
          order by a.alias_original
        `;
        const atualizacoes=await sql`
          select a.id,a.nome_arquivo,a.catalogo_completo,a.quantidade_arquivo,
            a.correspondencias_exatas,a.correspondencias_alias,a.correspondencias_confirmadas,
            a.novos_itens,a.duplicados_adicionados,a.ignorados,a.inativados,a.reativados,
            a.criado_em,
            case when u.id is null then null else json_build_object('id',u.id,'nome',u.nome) end as usuario
          from catalogo_sigem_atualizacoes a
          left join usuarios u on u.id=a.usuario_id
          order by a.criado_em desc
          limit 20
        `;
        return responseJson({ok:true,aliases,atualizacoes},200,env,request);
      }

      const catalogUpdateDetail=url.pathname.match(/^\/api\/catalogo\/atualizacoes\/([0-9a-f-]{36})$/i);
      if(catalogUpdateDetail && request.method === "GET") {
        if(!requireRole(user,["ADMIN"])) return responseJson({ok:false,error:"Apenas administradores podem consultar atualizações da base SIGEM."},403,env,request);
        const atualizacoes=await sql`
          select a.*,
            case when u.id is null then null else json_build_object('id',u.id,'nome',u.nome) end as usuario
          from catalogo_sigem_atualizacoes a
          left join usuarios u on u.id=a.usuario_id
          where a.id=${catalogUpdateDetail[1]}::uuid
          limit 1
        `;
        if(!atualizacoes.length) return responseJson({ok:false,error:"Atualização de catálogo não encontrada."},404,env,request);
        const itens=await sql`
          select id,acao,nome_arquivo,item_catalogo_id,item_catalogo_nome,tipo_id,similaridade,detalhes,criado_em
          from catalogo_sigem_atualizacao_itens
          where atualizacao_id=${catalogUpdateDetail[1]}::uuid
          order by id
        `;
        return responseJson({ok:true,atualizacao:atualizacoes[0],itens},200,env,request);
      }

      if (request.method === "POST" && url.pathname === "/api/catalogo/atualizacoes/aplicar") {
        if(!requireRole(user,["ADMIN"])) return responseJson({ok:false,error:"Apenas administradores podem atualizar a base SIGEM."},403,env,request);
        const b=await bodyJson(request);
        const nomeArquivo=String(b.nome_arquivo||"").trim().slice(0,240);
        const quantidadeArquivo=Number(b.quantidade_arquivo||0);
        const catalogoCompleto=Boolean(b.catalogo_completo);
        const rawActions=Array.isArray(b.acoes)?b.acoes:[];

        if(!nomeArquivo) return responseJson({ok:false,error:"Nome do arquivo é obrigatório."},400,env,request);
        if(!Number.isInteger(quantidadeArquivo)||quantidadeArquivo<1||quantidadeArquivo>10000) return responseJson({ok:false,error:"Quantidade de itens do arquivo inválida."},400,env,request);
        if(!rawActions.length||rawActions.length>20000) return responseJson({ok:false,error:"Plano de atualização vazio ou grande demais."},400,env,request);

        const allowedActions=new Set(["EXATO","ALIAS","MESMO_ITEM","NOVO","DUPLICADO","IGNORAR","MANTER","INATIVAR","REATIVAR"]);
        const actions=rawActions.map((action,index)=>{
          const acao=String(action?.acao||"").trim().toUpperCase();
          if(!allowedActions.has(acao)) throw new Error(`VALIDATION:Ação inválida na linha ${index+1}.`);
          const tipoId=action?.tipo_id==null||action?.tipo_id===""?null:Number(action.tipo_id);
          if(tipoId!==null&&![1,2,3].includes(tipoId)) throw new Error(`VALIDATION:Tipo inválido na linha ${index+1}.`);
          const valueRaw=action?.valor_padrao;
          const value=valueRaw===null||valueRaw===undefined||valueRaw===""?null:Number(valueRaw);
          if(value!==null&&!Number.isFinite(value)) throw new Error(`VALIDATION:Valor SIGEM inválido na linha ${index+1}.`);
          const similarityRaw=action?.similaridade;
          const similarity=similarityRaw===null||similarityRaw===undefined||similarityRaw===""?null:Number(similarityRaw);
          const oldName=String(action?.nome_anterior||"").trim();
          return {
            acao,
            nome:String(action?.nome||"").trim().slice(0,500),
            item_id:action?.item_id?String(action.item_id):null,
            tipo_id:tipoId,
            valor_padrao:value,
            similaridade:similarity===null?null:Math.max(0,Math.min(1,similarity)),
            reativar:Boolean(action?.reativar),
            alias_anterior_normalizado:acao==="MESMO_ITEM"&&oldName?normalizeCatalogText(oldName):null
          };
        });

        const targetIds=[...new Set(actions.map(a=>a.item_id).filter(Boolean))];
        if(targetIds.length) {
          const refs=await sql`select id,origem_catalogo from descricoes_padrao where id=any(${targetIds}::uuid[])`;
          if(refs.length!==targetIds.length) return responseJson({ok:false,error:"O plano referencia item inexistente no Catálogo."},409,env,request);
          if(refs.some(row=>row.origem_catalogo!=="SIGEM")) {
            return responseJson({ok:false,error:"A atualização da base SIGEM não pode alterar itens de Catálogo Próprio."},409,env,request);
          }
        }

        const rows=await sql`
          select aplicar_atualizacao_catalogo_sigem_v2_api(
            ${nomeArquivo},
            ${catalogoCompleto},
            ${quantidadeArquivo},
            ${JSON.stringify(actions)}::jsonb,
            ${user.id}::uuid
          ) as resultado
        `;
        return responseJson({ok:true,resultado:rows[0].resultado},200,env,request);
      }

      const catalogMatch=url.pathname.match(/^\/api\/catalogo\/([0-9a-f-]{36})$/i);
      if(catalogMatch && request.method === "PATCH") {
        if(!requireRole(user,["ADMIN"])) return responseJson({ok:false,error:"Apenas administradores podem editar itens do Catálogo."},403,env,request);
        const b=await bodyJson(request);
        const currentRows=await sql`select id,descricao,valor_padrao,tipo_id,ativo,origem_catalogo,fonte_valor from descricoes_padrao where id=${catalogMatch[1]}::uuid limit 1`;
        const current=currentRows[0];
        if(!current) return responseJson({ok:false,error:"Item do Catálogo não encontrado."},404,env,request);
        const has=(key)=>Object.prototype.hasOwnProperty.call(b,key);
        const novoTipo=has("tipo_id")?Number(b.tipo_id):Number(current.tipo_id);
        const ativo=has("ativo")?Boolean(b.ativo):Boolean(current.ativo);
        if(![1,2,3].includes(novoTipo)) return responseJson({ok:false,error:"Tipo do Catálogo inválido."},400,env,request);

        let descricao=current.descricao;
        let valor=current.valor_padrao;
        let fonte=current.fonte_valor;

        if(current.origem_catalogo==="PROPRIO") {
          if(has("descricao")) descricao=String(b.descricao||"").trim();
          if(!descricao) return responseJson({ok:false,error:"Descrição do item é obrigatória."},400,env,request);
          if(has("valor_padrao")) {
            valor=b.valor_padrao===null||b.valor_padrao===""?null:Number(b.valor_padrao);
            if(valor!==null&&(!Number.isFinite(valor)||valor<0)) return responseJson({ok:false,error:"Valor de referência inválido."},400,env,request);
          }
          if(has("fonte_valor")) {
            fonte=String(b.fonte_valor||"").trim().toUpperCase()||null;
            if(fonte&&!["COTACAO_PROPRIA","NOTA_FISCAL","OUTRA"].includes(fonte)) return responseJson({ok:false,error:"Fonte do valor inválida."},400,env,request);
          }
          if(valor===null) fonte=null;
          const duplicate=await sql`select id from descricoes_padrao where id<>${catalogMatch[1]}::uuid and lower(btrim(descricao))=lower(btrim(${descricao})) limit 1`;
          if(duplicate.length) return responseJson({ok:false,error:"Já existe outro item com esta descrição no Catálogo."},409,env,request);
        } else if(has("descricao")||has("valor_padrao")||has("fonte_valor")||has("ativo")) {
          return responseJson({ok:false,error:"Descrição, valor e status de itens SIGEM são alterados somente pela atualização da base SIGEM."},409,env,request);
        }

        const tipoAnterior=Number(current.tipo_id);
        const result=await sql`
          with catalogo as (
            update descricoes_padrao
            set descricao=${descricao},tipo_id=${novoTipo},valor_padrao=${valor},ativo=${ativo},fonte_valor=${fonte},atualizado_em=now()
            where id=${catalogMatch[1]}::uuid
            returning id,descricao,valor_padrao,tipo_id,ativo,origem_catalogo as origem,fonte_valor,atualizado_em
          ),
          sincronizados as (
            update patrimonios
            set tipo_id=${novoTipo},atualizado_por=${user.id}::uuid
            where descricao_padrao_id=${catalogMatch[1]}::uuid
              and tipo_id is not distinct from ${tipoAnterior}
            returning id
          ),
          log_catalogo as (
            insert into historico_alteracoes(tabela,registro_id,operacao,dados_anteriores,dados_novos,usuario_id)
            values(
              'descricoes_padrao',${catalogMatch[1]}::uuid,'ITEM_CATALOGO_EDITADO',
              jsonb_build_object('descricao',${current.descricao}::text,'tipo_id',${tipoAnterior}::integer,'valor_padrao',${current.valor_padrao}::numeric,'ativo',${Boolean(current.ativo)}::boolean,'origem',${current.origem_catalogo}::text,'fonte_valor',${current.fonte_valor}::text),
              jsonb_build_object('descricao',${descricao}::text,'tipo_id',${novoTipo}::integer,'valor_padrao',${valor}::numeric,'ativo',${ativo}::boolean,'origem',${current.origem_catalogo}::text,'fonte_valor',${fonte}::text),
              ${user.id}::uuid
            )
            returning id
          )
          select c.*,(select count(*)::int from sincronizados) as patrimonios_sincronizados from catalogo c
        `;
        return responseJson({ok:true,item:result[0],patrimonios_sincronizados:Number(result[0]?.patrimonios_sincronizados||0)},200,env,request);
      }

      if(catalogMatch && request.method === "DELETE") {
        if(!requireRole(user,["ADMIN"])) return responseJson({ok:false,error:"Apenas administradores podem excluir itens próprios do Catálogo."},403,env,request);
        const b=await bodyJson(request);
        const rows=await sql`select id,descricao,origem_catalogo,ativo from descricoes_padrao where id=${catalogMatch[1]}::uuid limit 1`;
        const current=rows[0];
        if(!current) return responseJson({ok:false,error:"Item do Catálogo não encontrado."},404,env,request);
        if(current.origem_catalogo!=="PROPRIO") return responseJson({ok:false,error:"Itens de origem SIGEM não podem ser excluídos manualmente. Inative-os somente pelo fluxo da base SIGEM."},409,env,request);
        if(String(b.confirmation||"").trim()!==current.descricao) return responseJson({ok:false,error:"Confirmação inválida. Digite exatamente a descrição do item."},400,env,request);
        const refs=await sql`
          select
            (select count(*)::int from patrimonios where descricao_padrao_id=${catalogMatch[1]}::uuid) as patrimonios,
            (select count(*)::int from catalogo_sigem_aliases where descricao_padrao_id=${catalogMatch[1]}::uuid) as aliases,
            (select count(*)::int from catalogo_sigem_atualizacao_itens where item_catalogo_id=${catalogMatch[1]}::uuid) as atualizacoes
        `;
        const used=Number(refs[0].patrimonios||0)+Number(refs[0].aliases||0)+Number(refs[0].atualizacoes||0);
        if(used>0) return responseJson({ok:false,error:"Este item já possui vínculos ou histórico. Inative-o em vez de excluir.",referencias:refs[0]},409,env,request);
        await sql`
          insert into historico_alteracoes(tabela,registro_id,operacao,dados_anteriores,usuario_id)
          values('descricoes_padrao',${catalogMatch[1]}::uuid,'ITEM_CATALOGO_EXCLUIDO',
            jsonb_build_object('descricao',${current.descricao}::text,'origem','PROPRIO'),${user.id}::uuid)
        `;
        await sql`delete from descricoes_padrao where id=${catalogMatch[1]}::uuid`;
        return responseJson({ok:true},200,env,request);
      }

      if (request.method === "GET" && url.pathname === "/api/catalogo") {
        const q=(url.searchParams.get("q")||"").trim(); const limit=Math.min(50,Math.max(1,Number(url.searchParams.get("limit")||20)));
        if(q.length<2) return responseJson({ok:true,itens:[]},200,env,request);
        const rows=await sql`select id,descricao,valor_padrao,tipo_id,origem_catalogo as origem,fonte_valor from descricoes_padrao where ativo=true and descricao ilike ${'%'+q+'%'} order by descricao limit ${limit}`;
        return responseJson({ok:true,itens:rows},200,env,request);
      }
      if (request.method === "POST" && url.pathname === "/api/importacoes/patrimonios/simular") {
        if(!requireRole(user,["ADMIN","AUXILIAR"])) return responseJson({ok:false,error:"Seu perfil não possui permissão para importar patrimônios."},403,env,request);
        const b=await bodyJson(request);
        const linhas=Array.isArray(b.linhas)?b.linhas:[];
        const simulacao=await simulateAssetImport(sql,linhas);
        return responseJson({ok:true,simulacao},200,env,request);
      }

      if (request.method === "POST" && url.pathname === "/api/importacoes/patrimonios/aplicar") {
        if(!requireRole(user,["ADMIN","AUXILIAR"])) return responseJson({ok:false,error:"Seu perfil não possui permissão para importar patrimônios."},403,env,request);
        const b=await bodyJson(request);
        const nomeArquivo=String(b.nome_arquivo||"").trim().slice(0,240);
        const linhas=Array.isArray(b.linhas)?b.linhas:[];
        if(!nomeArquivo) return responseJson({ok:false,error:"Nome do arquivo é obrigatório."},400,env,request);

        const simulacao=await simulateAssetImport(sql,linhas);
        const confirmadas=new Set(
          (Array.isArray(b.id_ses_confirmadas)?b.id_ses_confirmadas:[])
            .map(value=>normalizeCatalogText(value))
            .filter(Boolean)
        );
        const gruposPendentes=simulacao.grupos_id_ses.filter(group=>!confirmadas.has(group.key));
        if(simulacao.resumo.error>0 || gruposPendentes.length>0) {
          return responseJson({
            ok:false,
            error:simulacao.resumo.error>0
              ? "O lote final ainda possui erros. Execute a simulação novamente."
              : "Há ID SES duplicada sem confirmação explícita.",
            grupos_pendentes:gruposPendentes,
            simulacao
          },409,env,request);
        }

        const sanitized=simulacao.linhas.map(row=>({
          linha:row.linha,
          id_ses:row.id_ses||null,
          descricao_complementar:row.descricao_complementar,
          descricao_padrao_id:row.item_catalogo.id,
          data_aquisicao:row.data_aquisicao,
          valor_aquisicao:row.valor_aquisicao,
          nota_fiscal_numero:row.nota_fiscal_numero,
          centro_custo_id:row.centro.id,
          marca_modelo:row.marca_modelo,
          tipo_aquisicao:row.tipo_aquisicao,
          status:row.status,
          estado_conservacao:row.estado_conservacao
        }));

        const rows=await sql`
          select importar_patrimonios_lote_api(
            ${nomeArquivo},
            ${JSON.stringify(sanitized)}::jsonb,
            ${user.id}::uuid
          ) as resultado
        `;
        return responseJson({ok:true,resultado:rows[0].resultado},200,env,request);
      }

      if (request.method === "GET" && url.pathname === "/api/importacoes/patrimonios/historico") {
        if(!requireRole(user,["ADMIN","AUXILIAR"])) return responseJson({ok:false,error:"Seu perfil não possui permissão para consultar importações."},403,env,request);
        const limit=Math.min(50,Math.max(1,Number(url.searchParams.get("limit")||20)));
        const rows=await sql`
          select i.id,i.nome_arquivo,i.total_linhas,i.total_importado,i.criado_em,
            case when u.id is null then null else json_build_object('id',u.id,'nome',u.nome) end as usuario
          from importacoes_patrimoniais i
          left join usuarios u on u.id=i.usuario_id
          order by i.criado_em desc
          limit ${limit}
        `;
        return responseJson({ok:true,importacoes:rows},200,env,request);
      }

      if (request.method === "GET" && url.pathname === "/api/patrimonios") {
        const rows=await sql`select p.id,p.id_interna,p.id_ses,p.descricao,p.data_aquisicao,p.valor_aquisicao,p.nota_fiscal_numero,p.tipo_id,p.marca_modelo,p.status,p.tipo_aquisicao,p.estado_conservacao,p.mobilidade,p.criado_em,p.atualizado_em,p.removido,p.removido_em,p.public_token,
          exists(select 1 from manutencoes_patrimonio m where m.patrimonio_id=p.id and m.status='ABERTA') as em_manutencao,
          json_build_object('id',c.id,'codigo',c.codigo,'nome',c.nome) centros_custo,
          case when d.id is null then null else json_build_object('id',d.id,'descricao',d.descricao,'valor_padrao',d.valor_padrao,'tipo_id',d.tipo_id,'origem',d.origem_catalogo,'fonte_valor',d.fonte_valor) end descricoes_padrao,
          coalesce((select json_agg(json_build_object('id',cp.id,'codigo',cp.codigo,'nome',cp.nome) order by cp.nome)
            from patrimonio_centros_permitidos pcp join centros_custo cp on cp.id=pcp.centro_custo_id
            where pcp.patrimonio_id=p.id),'[]'::json) centros_permitidos
          from patrimonios p join centros_custo c on c.id=p.centro_custo_id left join descricoes_padrao d on d.id=p.descricao_padrao_id order by p.criado_em desc limit 5000`;
        return responseJson({ok:true,patrimonios:rows},200,env,request);
      }
      if (request.method === "POST" && url.pathname === "/api/patrimonios") {
        if(!requireRole(user,["ADMIN","AUXILIAR"])) return responseJson({ok:false,error:"Seu perfil não possui permissão para cadastrar patrimônios."},403,env,request);
        const b=await bodyJson(request);
        if(!b.tipo_id||!String(b.descricao||"").trim()||!b.tipo_aquisicao||!b.centro_custo_id) return responseJson({ok:false,error:"Tipo, descrição, aquisição e centro de custo são obrigatórios."},400,env,request);
        if (b.descricao_padrao_id) {
          const ref=await sql`select tipo_id from descricoes_padrao where id=${b.descricao_padrao_id}::uuid and ativo=true limit 1`;
          if (!ref.length) return responseJson({ok:false,error:"Item do Catálogo inválido ou inativo."},400,env,request);
          const tipoSigem=Number(ref[0].tipo_id);
          if (tipoSigem && Number(b.tipo_id)!==tipoSigem) {
            return responseJson({ok:false,error:`No cadastro, o Tipo deve seguir o item do Catálogo. SIGEM: ${tipoSigem===1?"Equipamento Médico":tipoSigem===2?"Mobiliário":tipoSigem===3?"Equipamento de Informática":"Tipo "+tipoSigem}.`},409,env,request);
          }
        }
        if (String(b.id_ses||"").trim()) {
          const dupSes=await sql`
            select id,id_interna
            from patrimonios
            where lower(btrim(id_ses))=lower(btrim(${String(b.id_ses).trim()}))
            limit 5
          `;
          if(dupSes.length && b.confirmar_id_ses_duplicada!==true) {
            return responseJson({
              ok:false,
              error:"Esta ID SES já está vinculada a outro patrimônio. A repetição é permitida, mas exige confirmação explícita.",
              code:"ID_SES_DUPLICADA_CONFIRMACAO",
              existentes:dupSes
            },409,env,request);
          }
        }
        const mobility=["FIXO","MOVEL"].includes(String(b.mobilidade||""))?String(b.mobilidade):"FIXO";
        const rows=await sql`insert into patrimonios(id_interna,id_ses,descricao,descricao_padrao_id,data_aquisicao,valor_aquisicao,nota_fiscal_numero,centro_custo_id,tipo_id,marca_modelo,status,tipo_aquisicao,estado_conservacao,mobilidade,criado_por,atualizado_por)
          values(null,${b.id_ses||null},${String(b.descricao).trim()},${b.descricao_padrao_id||null}::uuid,coalesce(${b.data_aquisicao||null}::date,current_date),coalesce(${b.valor_aquisicao??null},(select valor_padrao from descricoes_padrao where id=${b.descricao_padrao_id||null}::uuid)),${b.nota_fiscal_numero||null},${b.centro_custo_id}::uuid,${Number(b.tipo_id)},${b.marca_modelo||null},coalesce(${b.status||null}::status_patrimonio,'ATIVO'),${b.tipo_aquisicao}::tipo_aquisicao,coalesce(${b.estado_conservacao||null}::estado_conservacao,'BEM_CONSERVADO'),${mobility},${user.id}::uuid,${user.id}::uuid) returning id`;
        await sql`select sincronizar_centros_permitidos_api(${rows[0].id}::uuid,${mobility==="MOVEL"?(Array.isArray(b.centros_permitidos_ids)?b.centros_permitidos_ids:[]):[]}::uuid[],${user.id}::uuid)`;
        return responseJson({ok:true,patrimonio:await hydrateAsset(sql,rows[0].id)},201,env,request);
      }

      let m=url.pathname.match(/^\/api\/patrimonios\/([0-9a-f-]{36})$/i);
      if (m && request.method === "PATCH") {
        if(!requireRole(user,["ADMIN","AUXILIAR"])) return responseJson({ok:false,error:"Seu perfil não possui permissão para editar patrimônios."},403,env,request);
        const b=await bodyJson(request);
        const current=await hydrateAsset(sql,m[1]);
        if(!current) return responseJson({ok:false,error:"Patrimônio não encontrado."},404,env,request);

        const has=(key)=>Object.prototype.hasOwnProperty.call(b,key);
        const next={
          id_ses: has("id_ses") ? (b.id_ses || null) : current.id_ses,
          descricao: has("descricao") ? String(b.descricao || "").trim() : current.descricao,
          descricao_padrao_id: has("descricao_padrao_id") ? (b.descricao_padrao_id || null) : (current.descricoes_padrao?.id || null),
          data_aquisicao: has("data_aquisicao") ? (b.data_aquisicao || null) : current.data_aquisicao,
          valor_aquisicao: has("valor_aquisicao") ? b.valor_aquisicao : current.valor_aquisicao,
          nota_fiscal_numero: has("nota_fiscal_numero") ? (b.nota_fiscal_numero || null) : current.nota_fiscal_numero,
          tipo_id: has("tipo_id") ? Number(b.tipo_id) : Number(current.tipo_id),
          marca_modelo: has("marca_modelo") ? (b.marca_modelo || null) : current.marca_modelo,
          status: has("status") ? String(b.status || "") : current.status,
          tipo_aquisicao: has("tipo_aquisicao") ? String(b.tipo_aquisicao || "") : current.tipo_aquisicao,
          estado_conservacao: has("estado_conservacao") ? String(b.estado_conservacao || "") : current.estado_conservacao,
          mobilidade: has("mobilidade") && ["FIXO","MOVEL"].includes(String(b.mobilidade)) ? String(b.mobilidade) : (current.mobilidade || "FIXO")
        };

        if(!next.descricao||!next.tipo_id||!next.tipo_aquisicao||!next.status||!next.estado_conservacao) {
          return responseJson({ok:false,error:"Dados obrigatórios do patrimônio não podem ficar vazios."},400,env,request);
        }

        const idSesChanged=has("id_ses") && normalizeCatalogText(next.id_ses)!==normalizeCatalogText(current.id_ses);
        if(idSesChanged && next.id_ses) {
          const dupSes=await sql`
            select id,id_interna
            from patrimonios
            where id<>${m[1]}::uuid
              and lower(btrim(id_ses))=lower(btrim(${next.id_ses}))
            limit 5
          `;
          if(dupSes.length && b.confirmar_id_ses_duplicada!==true) {
            return responseJson({
              ok:false,
              error:"Esta ID SES já está vinculada a outro patrimônio. A repetição é permitida, mas exige confirmação explícita.",
              code:"ID_SES_DUPLICADA_CONFIRMACAO",
              existentes:dupSes
            },409,env,request);
          }
        }

        if (next.descricao_padrao_id) {
          const ref=await sql`select tipo_id from descricoes_padrao where id=${next.descricao_padrao_id}::uuid limit 1`;
          if (!ref.length) return responseJson({ok:false,error:"Item do Catálogo inválido ou inativo."},400,env,request);
          const tipoSigem=Number(ref[0].tipo_id);
          if (tipoSigem && Number(next.tipo_id)!==tipoSigem && b.confirmar_tipo_divergente!==true) {
            return responseJson({ok:false,error:`O Tipo selecionado diverge do item do Catálogo. SIGEM: ${tipoSigem===1?"Equipamento Médico":tipoSigem===2?"Mobiliário":tipoSigem===3?"Equipamento de Informática":"Tipo "+tipoSigem}.`},409,env,request);
          }
        }

        let nextValue=next.valor_aquisicao;
        if(has("valor_aquisicao") && (b.valor_aquisicao===null || b.valor_aquisicao==="")) {
          if(next.descricao_padrao_id) {
            const ref=await sql`select valor_padrao from descricoes_padrao where id=${next.descricao_padrao_id}::uuid limit 1`;
            nextValue=ref[0]?.valor_padrao ?? null;
          } else nextValue=null;
        }

        await sql`update patrimonios set
          id_ses=${next.id_ses},
          descricao=${next.descricao},
          descricao_padrao_id=${next.descricao_padrao_id}::uuid,
          data_aquisicao=${next.data_aquisicao}::date,
          valor_aquisicao=${nextValue},
          nota_fiscal_numero=${next.nota_fiscal_numero},
          tipo_id=${next.tipo_id},
          marca_modelo=${next.marca_modelo},
          status=${next.status}::status_patrimonio,
          tipo_aquisicao=${next.tipo_aquisicao}::tipo_aquisicao,
          estado_conservacao=${next.estado_conservacao}::estado_conservacao,
          mobilidade=${next.mobilidade},
          atualizado_por=${user.id}::uuid
          where id=${m[1]}::uuid`;

        const shouldSyncAllowed=has("mobilidade")||has("centros_permitidos_ids");
        if(shouldSyncAllowed) {
          const allowed=next.mobilidade==="MOVEL"
            ? (Array.isArray(b.centros_permitidos_ids) ? b.centros_permitidos_ids : (current.centros_permitidos||[]).map(c=>c.id))
            : [];
          await sql`select sincronizar_centros_permitidos_api(${m[1]}::uuid,${allowed}::uuid[],${user.id}::uuid)`;
        }

        return responseJson({ok:true,patrimonio:await hydrateAsset(sql,m[1])},200,env,request);
      }
      if (m && request.method === "DELETE") {
        if(!requireRole(user,["ADMIN"])) return responseJson({ok:false,error:"Apenas administradores podem excluir definitivamente."},403,env,request);
        const b=await bodyJson(request);
        const target=await hydrateAsset(sql,m[1]);
        if(!target) return responseJson({ok:false,error:"Patrimônio não encontrado."},404,env,request);
        if(String(b.confirmation||"").trim()!==String(target.id_interna)) return responseJson({ok:false,error:"Confirmação inválida. Digite a ID interna do patrimônio."},400,env,request);
        await sql`select excluir_patrimonio_definitivo_api(${m[1]}::uuid)`;
        return responseJson({ok:true},200,env,request);
      }

      m=url.pathname.match(/^\/api\/patrimonios\/([0-9a-f-]{36})\/historico$/i);
      if(m&&request.method==="GET") { const rows=await sql`select h.id,h.operacao,h.dados_anteriores,h.dados_novos,h.usuario_id,h.criado_em,
        case when u.id is null then null else json_build_object('id',u.id,'nome',u.nome,'email',u.email) end usuario
        from historico_alteracoes h left join usuarios u on u.id=h.usuario_id
        where h.tabela='patrimonios' and h.registro_id=${m[1]}::uuid order by h.criado_em desc limit 300`; return responseJson({ok:true,historico:rows},200,env,request); }
      m=url.pathname.match(/^\/api\/patrimonios\/([0-9a-f-]{36})\/movimentar$/i);
      if(m&&request.method==="POST") {
        if(!requireRole(user,["ADMIN","AUXILIAR"])) return responseJson({ok:false,error:"Seu perfil não possui permissão para movimentar patrimônios."},403,env,request);
        const b=await bodyJson(request);
        if(!String(b.solicitante||"").trim()||!String(b.movimentadoPor||"").trim()||!String(b.recebidoPor||"").trim()) return responseJson({ok:false,error:"Solicitante, movimentado por e recebido por são obrigatórios."},400,env,request);
        const mobility=["FIXO","MOVEL"].includes(String(b.mobilidade||""))?String(b.mobilidade):"FIXO";
        const allowed=mobility==="MOVEL"&&Array.isArray(b.centrosPermitidosIds)?b.centrosPermitidosIds:[];
        await sql`select movimentar_patrimonio_operacional_api(${m[1]}::uuid,${b.destinoCentroCustoId}::uuid,${b.observacao||null},${user.id}::uuid,${String(b.solicitante).trim()},${String(b.movimentadoPor).trim()},${String(b.recebidoPor).trim()},${mobility},${allowed}::uuid[])`;
        return responseJson({ok:true,patrimonio:await hydrateAsset(sql,m[1])},200,env,request);
      }
      m=url.pathname.match(/^\/api\/patrimonios\/([0-9a-f-]{36})\/(remover|restaurar)$/i);
      if(m&&request.method==="POST") { if(!requireRole(user,["ADMIN","AUXILIAR"])) return responseJson({ok:false,error:"Seu perfil não possui permissão para remover patrimônios."},403,env,request); if(m[2]==="remover") await sql`select remover_patrimonio_api(${m[1]}::uuid,${user.id}::uuid)`; else await sql`select restaurar_patrimonio_api(${m[1]}::uuid,${user.id}::uuid)`; return responseJson({ok:true,patrimonio:await hydrateAsset(sql,m[1])},200,env,request); }


      m=url.pathname.match(/^\/api\/patrimonios\/([0-9a-f-]{36})\/manutencoes$/i);
      if(m&&request.method==="GET") {
        const rows=await sql`select id,patrimonio_id,tipo,descricao,status,data_inicio,data_fim,usuario_id,criado_em,atualizado_em,
          solicitante,encaminhado_por,recebido_manutencao_por,responsavel_manutencao,entregue_centro_por,recebido_centro_por,observacao_conclusao
          from manutencoes_patrimonio where patrimonio_id=${m[1]}::uuid order by data_inicio desc,criado_em desc`;
        return responseJson({ok:true,manutencoes:rows},200,env,request);
      }
      if(m&&request.method==="POST") {
        if(!requireRole(user,["ADMIN","AUXILIAR"])) return responseJson({ok:false,error:"Seu perfil não possui permissão para registrar manutenção."},403,env,request);
        const b=await bodyJson(request);
        if(!["PREVENTIVA","CORRETIVA"].includes(String(b.tipo||""))) return responseJson({ok:false,error:"Tipo de manutenção inválido."},400,env,request);
        if(!String(b.descricao||"").trim()) return responseJson({ok:false,error:"Informe a descrição da manutenção."},400,env,request);
        if(!String(b.solicitante||"").trim()||!String(b.encaminhado_por||"").trim()||!String(b.recebido_manutencao_por||"").trim()) return responseJson({ok:false,error:"Informe solicitante, quem levou e quem recebeu na manutenção."},400,env,request);
        const rows=await sql`insert into manutencoes_patrimonio(patrimonio_id,tipo,descricao,status,data_inicio,usuario_id,solicitante,encaminhado_por,recebido_manutencao_por)
          values(${m[1]}::uuid,${b.tipo},${String(b.descricao).trim()},'ABERTA',coalesce(${b.data_inicio||null}::date,current_date),${user.id}::uuid,${String(b.solicitante).trim()},${String(b.encaminhado_por).trim()},${String(b.recebido_manutencao_por).trim()}) returning *`;
        await sql`insert into historico_alteracoes(tabela,registro_id,operacao,dados_novos,usuario_id) values('patrimonios',${m[1]}::uuid,'MANUTENCAO_ABERTA',
          jsonb_build_object('manutencao_id',${rows[0].id}::text,'tipo',${b.tipo}::text,'descricao',${String(b.descricao).trim()}::text,
          'solicitante',${String(b.solicitante).trim()}::text,'encaminhado_por',${String(b.encaminhado_por).trim()}::text,
          'recebido_manutencao_por',${String(b.recebido_manutencao_por).trim()}::text),${user.id}::uuid)`;
        return responseJson({ok:true,manutencao:rows[0]},201,env,request);
      }

      m=url.pathname.match(/^\/api\/manutencoes\/([0-9a-f-]{36})\/concluir$/i);
      if(m&&request.method==="POST") {
        if(!requireRole(user,["ADMIN","AUXILIAR"])) return responseJson({ok:false,error:"Seu perfil não possui permissão para concluir manutenção."},403,env,request);
        const b=await bodyJson(request);
        if(!String(b.responsavel_manutencao||"").trim()||!String(b.entregue_centro_por||"").trim()||!String(b.recebido_centro_por||"").trim()) return responseJson({ok:false,error:"Informe responsável pela manutenção, quem entregou e quem recebeu no centro."},400,env,request);
        const rows=await sql`update manutencoes_patrimonio set status='CONCLUIDA',data_fim=coalesce(${b.data_fim||null}::date,current_date),atualizado_em=now(),
          responsavel_manutencao=${String(b.responsavel_manutencao).trim()},entregue_centro_por=${String(b.entregue_centro_por).trim()},
          recebido_centro_por=${String(b.recebido_centro_por).trim()},observacao_conclusao=${b.observacao_conclusao||null}
          where id=${m[1]}::uuid and status='ABERTA' returning *`;
        if(!rows.length) return responseJson({ok:false,error:"Manutenção não encontrada ou já concluída."},404,env,request);
        await sql`insert into historico_alteracoes(tabela,registro_id,operacao,dados_novos,usuario_id) values('patrimonios',${rows[0].patrimonio_id}::uuid,'MANUTENCAO_CONCLUIDA',
          jsonb_build_object('manutencao_id',${rows[0].id}::text,'status','CONCLUIDA','responsavel_manutencao',${String(b.responsavel_manutencao).trim()}::text,
          'entregue_centro_por',${String(b.entregue_centro_por).trim()}::text,'recebido_centro_por',${String(b.recebido_centro_por).trim()}::text,
          'observacao_conclusao',${b.observacao_conclusao||null}::text),${user.id}::uuid)`;
        return responseJson({ok:true,manutencao:rows[0]},200,env,request);
      }

      return responseJson({ok:false,error:"Rota não encontrada."},404,env,request);
    } catch(error) {
      console.error(error);
      const msg=String(error?.message||"");
      if(msg.startsWith("VALIDATION:")) return responseJson({ok:false,error:msg.slice("VALIDATION:".length)},400,env,request);
      if(msg.includes("duplicate key")&&msg.includes("id_ses")) return responseJson({ok:false,error:"Este ID SES já está cadastrado."},409,env,request);
      return responseJson({ok:false,error:"Erro interno no serviço."},500,env,request);
    }
  }
};
