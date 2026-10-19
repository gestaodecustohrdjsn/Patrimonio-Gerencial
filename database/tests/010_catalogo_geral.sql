-- Patrimônio+ | Teste do Catálogo Geral v1.6.0
-- Valida a base oficial de 16/10/2026 e não deixa dados de teste gravados.

begin;

do $catalogo_test$
declare
  v_id uuid;
  v_sigem_id uuid;
  v_sigem_nome text;
  v_sigem_valor numeric;
  v_usuario_id uuid;
  v_resultado jsonb;
begin
  if (select count(*) from descricoes_padrao) <> 821 then
    raise exception 'Esperados 821 itens no Catálogo';
  end if;

  if (select count(*) from descricoes_padrao where origem_catalogo='SIGEM') <> 814 then
    raise exception 'Esperados 814 itens de origem SIGEM';
  end if;

  if (select count(*) from descricoes_padrao where origem_catalogo='PROPRIO') <> 7 then
    raise exception 'Esperados 7 itens de Catálogo Próprio';
  end if;

  if (select count(*) from descricoes_padrao where tipo_id=1) <> 582 then
    raise exception 'Quantidade de Equipamento Médico divergente';
  end if;

  if (select count(*) from descricoes_padrao where tipo_id=2) <> 199 then
    raise exception 'Quantidade de Mobiliário divergente';
  end if;

  if (select count(*) from descricoes_padrao where tipo_id=3) <> 40 then
    raise exception 'Quantidade de Informática divergente';
  end if;

  if exists(
    select 1 from descricoes_padrao
    where origem_catalogo='SIGEM' and fonte_valor is distinct from 'SIGEM'
  ) then
    raise exception 'Há item SIGEM com fonte de valor inválida';
  end if;

  if exists(
    select lower(btrim(descricao))
    from descricoes_padrao
    group by lower(btrim(descricao))
    having count(*) > 1
  ) then
    raise exception 'Há descrições duplicadas no Catálogo oficial';
  end if;

  if not exists(
    select 1 from descricoes_padrao
    where descricao='Aspirador Cirúrgico - HRPP'
      and origem_catalogo='PROPRIO'
      and tipo_id=1
      and valor_padrao=1100.00
  ) then
    raise exception 'Item próprio de controle não confere';
  end if;

  insert into descricoes_padrao(
    descricao,valor_padrao,tipo_id,ativo,origem_catalogo,fonte_valor
  ) values(
    'TESTE CATALOGO GERAL 160',123.45,2,true,'PROPRIO','COTACAO_PROPRIA'
  ) returning id into v_id;

  if not exists(
    select 1 from descricoes_padrao
    where id=v_id and origem_catalogo='PROPRIO' and tipo_id=2
  ) then
    raise exception 'Não foi possível inserir item próprio de teste';
  end if;

  update descricoes_padrao
  set tipo_id=1,valor_padrao=234.56,fonte_valor='NOTA_FISCAL'
  where id=v_id;

  if not exists(
    select 1 from descricoes_padrao
    where id=v_id and tipo_id=1 and valor_padrao=234.56 and fonte_valor='NOTA_FISCAL'
  ) then
    raise exception 'Não foi possível editar item próprio de teste';
  end if;

  select id,descricao,coalesce(valor_padrao,0)
    into v_sigem_id,v_sigem_nome,v_sigem_valor
  from descricoes_padrao
  where origem_catalogo='SIGEM' and ativo=true
  order by descricao
  limit 1;

  select id into v_usuario_id
  from usuarios
  where ativo=true
  order by id
  limit 1;

  if v_sigem_id is null or v_usuario_id is null then
    raise exception 'Faltam item SIGEM ou usuário ativo para testar o updater';
  end if;

  select aplicar_atualizacao_catalogo_sigem_v2_api(
    'TESTE_CATALOGO_GERAL_160.csv',
    false,
    1,
    jsonb_build_array(
      jsonb_build_object(
        'acao','EXATO',
        'nome',v_sigem_nome,
        'item_id',v_sigem_id,
        'valor_padrao',v_sigem_valor + 1,
        'reativar',false
      )
    ),
    v_usuario_id
  )
  into v_resultado;

  if coalesce((v_resultado->>'ok')::boolean,false) is not true then
    raise exception 'Updater v2 não retornou ok=true';
  end if;

  if not exists(
    select 1 from descricoes_padrao
    where id=v_sigem_id
      and valor_padrao=v_sigem_valor + 1
      and fonte_valor='SIGEM'
      and origem_catalogo='SIGEM'
  ) then
    raise exception 'Updater v2 não atualizou o valor SIGEM em correspondência exata';
  end if;
end $catalogo_test$;

rollback;

select 'TESTE_CATALOGO_GERAL_160_OK' as resultado;
