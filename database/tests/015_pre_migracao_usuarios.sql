-- Patrimônio+ | Diagnóstico pré-migração 015 | SOMENTE LEITURA
SELECT 'COLUNAS_USUARIOS' AS verificacao, column_name,data_type,udt_name
FROM information_schema.columns
WHERE table_schema='public' AND table_name='usuarios'
  AND column_name IN ('id','nome','email','perfil','ativo','criado_em','atualizado_em','password_hash','password_salt','password_iterations','troca_senha_obrigatoria')
ORDER BY column_name;
SELECT 'EMAILS_DUPLICADOS' AS verificacao,lower(btrim(email)) AS email_normalizado,count(*) AS quantidade
FROM usuarios GROUP BY lower(btrim(email)) HAVING count(*)>1;
SELECT 'PERFIS_ATUAIS' AS verificacao,perfil::text AS perfil,ativo,count(*) AS quantidade
FROM usuarios GROUP BY perfil::text,ativo ORDER BY perfil::text,ativo;
SELECT 'USUARIOS_ADMIN_ATIVOS' AS verificacao,count(*) AS quantidade
FROM usuarios WHERE perfil::text='ADMIN' AND ativo=true;
