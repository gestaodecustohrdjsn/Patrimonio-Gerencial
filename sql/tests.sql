-- Testes pontuais da geração de ID.
-- Execute após schema.sql em um projeto de TESTE.

begin;

insert into public.centros_custo (codigo, nome)
values ('TESTE', 'Centro de Teste')
on conflict (codigo) do update set nome = excluded.nome;

insert into public.descricoes_padrao (descricao, tipo_id, valor_padrao)
values ('CADEIRA DE TESTE', 2, 100.00)
returning id;

-- Teste direto da função. Os resultados esperados terminam em 0001 e 0002.
select public.gerar_id_interna(2, date '2026-05-10') as primeira_id;
select public.gerar_id_interna(2, date '2026-05-10') as segunda_id;

-- Tipo diferente mantém sequência independente.
select public.gerar_id_interna(3, date '2026-05-10') as primeira_id_informatica;

rollback;
