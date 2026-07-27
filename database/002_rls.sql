-- Patrimônio+ v0.2 | RLS mínima para a aplicação web
-- As políticas atuais já permitem leitura e cadastro para usuários autenticados.
-- Este arquivo apenas garante idempotência e será ampliado quando houver perfis.

alter table public.tipos_patrimonio enable row level security;
alter table public.centros_custo enable row level security;
alter table public.descricoes_padrao enable row level security;
alter table public.patrimonios enable row level security;
alter table public.historico_alteracoes enable row level security;

-- Nenhuma política anônima é criada. Sem login, o navegador não acessa os dados.
