-- Patrimônio+ | Teste do atualizador inteligente do Catálogo SIGEM
-- Não deixa nenhuma alteração gravada: termina com ROLLBACK.

begin;

do $$
declare
  v_item_id uuid;
  v_item_nome text;
  v_usuario_id uuid;
  v_resultado jsonb;
  v_atualizacao_id uuid;
begin
  select id, descricao
    into v_item_id, v_item_nome
  from descricoes_padrao
  where ativo=true
  order by descricao
  limit 1;

  if v_item_id is null then
    raise exception 'Nenhum item SIGEM ativo encontrado para teste';
  end if;

  select id
    into v_usuario_id
  from usuarios
  where ativo=true
  order by criado_em
  limit 1;

  if v_usuario_id is null then
    raise exception 'Nenhum usuário ativo encontrado para teste';
  end if;

  select aplicar_atualizacao_catalogo_sigem_api(
    'TESTE_ATUALIZADOR_SIGEM.csv',
    false,
    1,
    jsonb_build_array(
      jsonb_build_object(
        'acao','EXATO',
        'nome',v_item_nome,
        'item_id',v_item_id,
        'reativar',false
      )
    ),
    v_usuario_id
  )
  into v_resultado;

  if coalesce((v_resultado->>'ok')::boolean,false) is not true then
    raise exception 'Função não retornou ok=true: %', v_resultado;
  end if;

  if (v_resultado->>'correspondencias_exatas')::integer <> 1 then
    raise exception 'Contagem de correspondência exata incorreta: %', v_resultado;
  end if;

  v_atualizacao_id := (v_resultado->>'atualizacao_id')::uuid;

  if not exists(
    select 1
    from catalogo_sigem_atualizacoes
    where id=v_atualizacao_id
      and nome_arquivo='TESTE_ATUALIZADOR_SIGEM.csv'
  ) then
    raise exception 'Histórico da atualização não foi criado';
  end if;

  if not exists(
    select 1
    from catalogo_sigem_atualizacao_itens
    where atualizacao_id=v_atualizacao_id
      and acao='EXATO'
      and item_catalogo_id=v_item_id
  ) then
    raise exception 'Detalhe da atualização não foi criado';
  end if;

  if not exists(
    select 1
    from historico_alteracoes
    where tabela='catalogo_sigem_atualizacoes'
      and registro_id=v_atualizacao_id
      and operacao='CATALOGO_SIGEM_ATUALIZADO'
  ) then
    raise exception 'Log global da atualização não foi criado';
  end if;
end $$;

rollback;

select 'TESTE_ATUALIZADOR_SIGEM_OK' as resultado;
