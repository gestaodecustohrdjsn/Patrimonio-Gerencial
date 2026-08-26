import { database } from "./db.js";
import { randomToken, randomSalt, sha256, passwordHash, constantTimeEqual } from "./security.js";

function corsHeaders(env, request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGIN || "").trim();
  return {
    "Access-Control-Allow-Origin": origin && origin === allowed ? origin : allowed,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
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

async function hydrateAsset(sql, id) {
  const rows = await sql`
    select p.id,p.id_interna,p.id_ses,p.descricao,p.data_aquisicao,p.valor_aquisicao,
      p.nota_fiscal_numero,p.tipo_id,p.marca_modelo,p.status,p.tipo_aquisicao,
      p.estado_conservacao,p.criado_em,p.atualizado_em,p.removido,p.removido_em,p.public_token,
      json_build_object('id',c.id,'codigo',c.codigo,'nome',c.nome) as centros_custo,
      case when d.id is null then null else json_build_object('id',d.id,'descricao',d.descricao,'valor_padrao',d.valor_padrao) end as descricoes_padrao
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
        return responseJson({ok:true,service:"Patrimônio+ API",version:"3.0.0",database:r[0].database,counts:{centrosCusto:r[0].centros,itensCatalogo:r[0].catalogo,patrimonios:r[0].patrimonios}},200,env,request);
      }

      const pub = url.pathname.match(/^\/api\/public\/patrimonio\/([0-9a-f-]{36})$/i);
      if (request.method === "GET" && pub) {
        const rows = await sql`select * from consultar_patrimonio_publico(${pub[1]}::uuid)`;
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

      if (request.method === "GET" && url.pathname === "/api/centros") {
        const rows=await sql`select id,codigo,nome,ativo from centros_custo order by ativo desc,nome asc`;
        return responseJson({ok:true,centros:rows},200,env,request);
      }
      if (request.method === "GET" && url.pathname === "/api/catalogo") {
        const q=(url.searchParams.get("q")||"").trim(); const limit=Math.min(50,Math.max(1,Number(url.searchParams.get("limit")||20)));
        if(q.length<2) return responseJson({ok:true,itens:[]},200,env,request);
        const rows=await sql`select id,descricao,valor_padrao,tipo_id from descricoes_padrao where ativo=true and descricao ilike ${'%'+q+'%'} order by descricao limit ${limit}`;
        return responseJson({ok:true,itens:rows},200,env,request);
      }
      if (request.method === "GET" && url.pathname === "/api/patrimonios") {
        const rows=await sql`select p.id,p.id_interna,p.id_ses,p.descricao,p.data_aquisicao,p.valor_aquisicao,p.nota_fiscal_numero,p.tipo_id,p.marca_modelo,p.status,p.tipo_aquisicao,p.estado_conservacao,p.criado_em,p.atualizado_em,p.removido,p.removido_em,p.public_token,
          json_build_object('id',c.id,'codigo',c.codigo,'nome',c.nome) centros_custo,
          case when d.id is null then null else json_build_object('id',d.id,'descricao',d.descricao,'valor_padrao',d.valor_padrao) end descricoes_padrao
          from patrimonios p join centros_custo c on c.id=p.centro_custo_id left join descricoes_padrao d on d.id=p.descricao_padrao_id order by p.criado_em desc limit 5000`;
        return responseJson({ok:true,patrimonios:rows},200,env,request);
      }
      if (request.method === "POST" && url.pathname === "/api/patrimonios") {
        const b=await bodyJson(request);
        if(!b.tipo_id||!String(b.descricao||"").trim()||!b.tipo_aquisicao||!b.centro_custo_id) return responseJson({ok:false,error:"Tipo, descrição, aquisição e centro de custo são obrigatórios."},400,env,request);
        const rows=await sql`insert into patrimonios(id_interna,id_ses,descricao,descricao_padrao_id,data_aquisicao,valor_aquisicao,nota_fiscal_numero,centro_custo_id,tipo_id,marca_modelo,status,tipo_aquisicao,estado_conservacao,criado_por,atualizado_por)
          values(null,${b.id_ses||null},${String(b.descricao).trim()},${b.descricao_padrao_id||null}::uuid,coalesce(${b.data_aquisicao||null}::date,current_date),${b.valor_aquisicao??null},${b.nota_fiscal_numero||null},${b.centro_custo_id}::uuid,${Number(b.tipo_id)},${b.marca_modelo||null},coalesce(${b.status||null}::status_patrimonio,'ATIVO'),${b.tipo_aquisicao}::tipo_aquisicao,coalesce(${b.estado_conservacao||null}::estado_conservacao,'BEM_CONSERVADO'),${user.id}::uuid,${user.id}::uuid) returning id`;
        return responseJson({ok:true,patrimonio:await hydrateAsset(sql,rows[0].id)},201,env,request);
      }

      let m=url.pathname.match(/^\/api\/patrimonios\/([0-9a-f-]{36})$/i);
      if (m && request.method === "PATCH") {
        const b=await bodyJson(request);
        await sql`update patrimonios set id_ses=${b.id_ses||null},descricao=${String(b.descricao||"").trim()},descricao_padrao_id=${b.descricao_padrao_id||null}::uuid,data_aquisicao=coalesce(${b.data_aquisicao||null}::date,data_aquisicao),valor_aquisicao=${b.valor_aquisicao??null},nota_fiscal_numero=${b.nota_fiscal_numero||null},centro_custo_id=${b.centro_custo_id}::uuid,tipo_id=${Number(b.tipo_id)},marca_modelo=${b.marca_modelo||null},status=${b.status}::status_patrimonio,tipo_aquisicao=${b.tipo_aquisicao}::tipo_aquisicao,estado_conservacao=${b.estado_conservacao}::estado_conservacao,atualizado_por=${user.id}::uuid where id=${m[1]}::uuid`;
        return responseJson({ok:true,patrimonio:await hydrateAsset(sql,m[1])},200,env,request);
      }
      if (m && request.method === "DELETE") {
        if(!requireRole(user,["ADMIN"])) return responseJson({ok:false,error:"Apenas administradores podem excluir definitivamente."},403,env,request);
        const b=await bodyJson(request); if(String(b.confirmation||"").trim().toUpperCase()!=="EXCLUIR") return responseJson({ok:false,error:"Confirmação inválida."},400,env,request);
        await sql`select excluir_patrimonio_definitivo_api(${m[1]}::uuid)`;
        return responseJson({ok:true},200,env,request);
      }

      m=url.pathname.match(/^\/api\/patrimonios\/([0-9a-f-]{36})\/historico$/i);
      if(m&&request.method==="GET") { const rows=await sql`select id,operacao,dados_anteriores,dados_novos,usuario_id,criado_em from historico_alteracoes where tabela='patrimonios' and registro_id=${m[1]}::uuid order by criado_em desc limit 200`; return responseJson({ok:true,historico:rows},200,env,request); }
      m=url.pathname.match(/^\/api\/patrimonios\/([0-9a-f-]{36})\/movimentar$/i);
      if(m&&request.method==="POST") { const b=await bodyJson(request); await sql`select movimentar_patrimonio_api(${m[1]}::uuid,${b.destinoCentroCustoId}::uuid,${b.observacao||null},${user.id}::uuid)`; return responseJson({ok:true,patrimonio:await hydrateAsset(sql,m[1])},200,env,request); }
      m=url.pathname.match(/^\/api\/patrimonios\/([0-9a-f-]{36})\/(remover|restaurar)$/i);
      if(m&&request.method==="POST") { if(m[2]==="remover") await sql`select remover_patrimonio_api(${m[1]}::uuid,${user.id}::uuid)`; else await sql`select restaurar_patrimonio_api(${m[1]}::uuid,${user.id}::uuid)`; return responseJson({ok:true,patrimonio:await hydrateAsset(sql,m[1])},200,env,request); }

      return responseJson({ok:false,error:"Rota não encontrada."},404,env,request);
    } catch(error) {
      console.error(error);
      const msg=String(error?.message||"");
      if(msg.includes("duplicate key")&&msg.includes("id_ses")) return responseJson({ok:false,error:"Este ID SES já está cadastrado."},409,env,request);
      return responseJson({ok:false,error:"Erro interno no serviço."},500,env,request);
    }
  }
};
