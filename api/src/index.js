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

function normalizeCatalogText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function hydrateAsset(sql, id) {
  const rows = await sql`
    select p.id,p.id_interna,p.id_ses,p.descricao,p.data_aquisicao,p.valor_aquisicao,
      p.nota_fiscal_numero,p.tipo_id,p.marca_modelo,p.status,p.tipo_aquisicao,
      p.estado_conservacao,p.mobilidade,p.criado_em,p.atualizado_em,p.removido,p.removido_em,p.public_token,
      exists(select 1 from manutencoes_patrimonio m where m.patrimonio_id=p.id and m.status='ABERTA') as em_manutencao,
      json_build_object('id',c.id,'codigo',c.codigo,'nome',c.nome) as centros_custo,
      case when d.id is null then null else json_build_object('id',d.id,'descricao',d.descricao,'valor_padrao',d.valor_padrao,'tipo_id',d.tipo_id) end as descricoes_padrao,
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
        return responseJson({ok:true,service:"Patrimônio+ API",version:"3.3.5",database:r[0].database,counts:{centrosCusto:r[0].centros,itensCatalogo:r[0].catalogo,patrimonios:r[0].patrimonios}},200,env,request);
      }

      const pub = url.pathname.match(/^\/api\/public\/patrimonio\/([0-9a-f-]{36})$/i);
      if (request.method === "GET" && pub) {
        const rows = await sql`
          select p.id_interna,p.id_ses,p.descricao,p.tipo_id,p.marca_modelo,p.status,p.tipo_aquisicao,
            p.estado_conservacao,p.mobilidade,p.data_aquisicao,p.valor_aquisicao,p.nota_fiscal_numero,
            p.criado_em,p.atualizado_em,
            exists(select 1 from manutencoes_patrimonio m where m.patrimonio_id=p.id and m.status='ABERTA') as em_manutencao,
            json_build_object('id',c.id,'codigo',c.codigo,'nome',c.nome) as centros_custo,
            case when d.id is null then null else json_build_object('id',d.id,'descricao',d.descricao,'valor_padrao',d.valor_padrao,'tipo_id',d.tipo_id) end as descricoes_padrao,
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

      if (request.method === "GET" && url.pathname === "/api/historico") {
        const limit=Math.min(100,Math.max(1,Number(url.searchParams.get("limit")||30)));
        const rows=await sql`
          select
            h.id,
            h.tabela,
            h.registro_id,
            h.operacao,
            h.criado_em,
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
                'tipo','sigem',
                'nome',coalesce(dp.descricao,h.dados_novos->>'descricao',h.dados_anteriores->>'descricao')
              )
              when h.tabela='catalogo_sigem_atualizacoes' then jsonb_build_object(
                'tipo','catalog_update',
                'nome',h.dados_novos->>'nome_arquivo'
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
              'reativados',h.dados_novos->>'reativados'
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
          order by h.criado_em desc,h.id desc
          limit ${limit}
        `;
        return responseJson({ok:true,eventos:rows},200,env,request);
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
        if(!requireRole(user,["ADMIN"])) return responseJson({ok:false,error:"Apenas administradores podem gerenciar a classificação SIGEM."},403,env,request);
        const rows=await sql`
          select d.id,d.descricao,d.valor_padrao,d.tipo_id,d.ativo,
            (select count(*)::int from patrimonios p where p.descricao_padrao_id=d.id and p.removido=false) as patrimonios_vinculados
          from descricoes_padrao d
          order by d.descricao
        `;
        return responseJson({ok:true,itens:rows},200,env,request);
      }

      if (request.method === "GET" && url.pathname === "/api/catalogo/atualizacoes/contexto") {
        if(!requireRole(user,["ADMIN"])) return responseJson({ok:false,error:"Apenas administradores podem atualizar o Catálogo SIGEM."},403,env,request);
        const aliases=await sql`
          select a.id,a.alias_original,a.alias_normalizado,a.descricao_padrao_id,a.criado_em,
            d.descricao as item_catalogo_nome,d.tipo_id,d.ativo
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
        if(!requireRole(user,["ADMIN"])) return responseJson({ok:false,error:"Apenas administradores podem consultar atualizações do Catálogo SIGEM."},403,env,request);
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
        if(!requireRole(user,["ADMIN"])) return responseJson({ok:false,error:"Apenas administradores podem atualizar o Catálogo SIGEM."},403,env,request);
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

        const rows=await sql`
          select aplicar_atualizacao_catalogo_sigem_api(
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
        if(!requireRole(user,["ADMIN"])) return responseJson({ok:false,error:"Apenas administradores podem alterar a classificação SIGEM."},403,env,request);
        const b=await bodyJson(request);
        const novoTipo=Number(b.tipo_id);
        if(![1,2,3].includes(novoTipo)) return responseJson({ok:false,error:"Tipo SIGEM inválido."},400,env,request);
        const currentRows=await sql`select id,descricao,valor_padrao,tipo_id,ativo from descricoes_padrao where id=${catalogMatch[1]}::uuid limit 1`;
        const current=currentRows[0];
        if(!current) return responseJson({ok:false,error:"Item SIGEM não encontrado."},404,env,request);
        const tipoAnterior=current.tipo_id==null?null:Number(current.tipo_id);
        if(tipoAnterior===novoTipo) return responseJson({ok:true,item:current,patrimonios_sincronizados:0},200,env,request);

        const result=await sql`
          with atual as (
            select id,tipo_id
            from descricoes_padrao
            where id=${catalogMatch[1]}::uuid
            for update
          ),
          catalogo as (
            update descricoes_padrao d
            set tipo_id=${novoTipo}
            from atual a
            where d.id=a.id
            returning d.id,d.descricao,d.valor_padrao,d.tipo_id,d.ativo,a.tipo_id as tipo_anterior
          ),
          sincronizados as (
            update patrimonios p
            set tipo_id=${novoTipo},atualizado_por=${user.id}::uuid
            from catalogo c
            where p.descricao_padrao_id=c.id
              and p.tipo_id is not distinct from c.tipo_anterior
            returning p.id
          ),
          log_catalogo as (
            insert into historico_alteracoes(tabela,registro_id,operacao,dados_anteriores,dados_novos,usuario_id)
            select
              'descricoes_padrao',c.id,'CLASSIFICACAO_SIGEM_ALTERADA',
              jsonb_build_object('tipo_id',c.tipo_anterior),
              jsonb_build_object('tipo_id',c.tipo_id),
              ${user.id}::uuid
            from catalogo c
            returning id
          )
          select
            c.id,c.descricao,c.valor_padrao,c.tipo_id,c.ativo,
            (select count(*)::int from sincronizados) as patrimonios_sincronizados
          from catalogo c
        `;
        return responseJson({
          ok:true,
          item:result[0],
          patrimonios_sincronizados:Number(result[0]?.patrimonios_sincronizados||0)
        },200,env,request);
      }

      if (request.method === "GET" && url.pathname === "/api/catalogo") {
        const q=(url.searchParams.get("q")||"").trim(); const limit=Math.min(50,Math.max(1,Number(url.searchParams.get("limit")||20)));
        if(q.length<2) return responseJson({ok:true,itens:[]},200,env,request);
        const rows=await sql`select id,descricao,valor_padrao,tipo_id from descricoes_padrao where ativo=true and descricao ilike ${'%'+q+'%'} order by descricao limit ${limit}`;
        return responseJson({ok:true,itens:rows},200,env,request);
      }
      if (request.method === "GET" && url.pathname === "/api/patrimonios") {
        const rows=await sql`select p.id,p.id_interna,p.id_ses,p.descricao,p.data_aquisicao,p.valor_aquisicao,p.nota_fiscal_numero,p.tipo_id,p.marca_modelo,p.status,p.tipo_aquisicao,p.estado_conservacao,p.mobilidade,p.criado_em,p.atualizado_em,p.removido,p.removido_em,p.public_token,
          exists(select 1 from manutencoes_patrimonio m where m.patrimonio_id=p.id and m.status='ABERTA') as em_manutencao,
          json_build_object('id',c.id,'codigo',c.codigo,'nome',c.nome) centros_custo,
          case when d.id is null then null else json_build_object('id',d.id,'descricao',d.descricao,'valor_padrao',d.valor_padrao,'tipo_id',d.tipo_id) end descricoes_padrao,
          coalesce((select json_agg(json_build_object('id',cp.id,'codigo',cp.codigo,'nome',cp.nome) order by cp.nome)
            from patrimonio_centros_permitidos pcp join centros_custo cp on cp.id=pcp.centro_custo_id
            where pcp.patrimonio_id=p.id),'[]'::json) centros_permitidos
          from patrimonios p join centros_custo c on c.id=p.centro_custo_id left join descricoes_padrao d on d.id=p.descricao_padrao_id order by p.criado_em desc limit 5000`;
        return responseJson({ok:true,patrimonios:rows},200,env,request);
      }
      if (request.method === "POST" && url.pathname === "/api/patrimonios") {
        const b=await bodyJson(request);
        if(!b.tipo_id||!String(b.descricao||"").trim()||!b.tipo_aquisicao||!b.centro_custo_id) return responseJson({ok:false,error:"Tipo, descrição, aquisição e centro de custo são obrigatórios."},400,env,request);
        if (b.descricao_padrao_id) {
          const ref=await sql`select tipo_id from descricoes_padrao where id=${b.descricao_padrao_id}::uuid and ativo=true limit 1`;
          if (!ref.length) return responseJson({ok:false,error:"Item SIGEM inválido ou inativo."},400,env,request);
          const tipoSigem=Number(ref[0].tipo_id);
          if (tipoSigem && Number(b.tipo_id)!==tipoSigem) {
            return responseJson({ok:false,error:`No cadastro, o Tipo deve seguir o catálogo SIGEM. SIGEM: ${tipoSigem===1?"Equipamento Médico":tipoSigem===2?"Mobiliário":tipoSigem===3?"Equipamento de Informática":"Tipo "+tipoSigem}.`},409,env,request);
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

        if (next.descricao_padrao_id) {
          const ref=await sql`select tipo_id from descricoes_padrao where id=${next.descricao_padrao_id}::uuid limit 1`;
          if (!ref.length) return responseJson({ok:false,error:"Item SIGEM inválido ou inativo."},400,env,request);
          const tipoSigem=Number(ref[0].tipo_id);
          if (tipoSigem && Number(next.tipo_id)!==tipoSigem && b.confirmar_tipo_divergente!==true) {
            return responseJson({ok:false,error:`O Tipo selecionado diverge do catálogo SIGEM. SIGEM: ${tipoSigem===1?"Equipamento Médico":tipoSigem===2?"Mobiliário":tipoSigem===3?"Equipamento de Informática":"Tipo "+tipoSigem}.`},409,env,request);
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
