-- Patrimônio+ 015 | Verificação da fundação de permissões
-- Somente leitura; execute DEPOIS de aplicar a migration.
SELECT 'PERMISSOES_CADASTRADAS' AS verificacao,count(*)::int AS total FROM permissoes;
SELECT 'REGRAS_POR_PERFIL' AS verificacao,perfil,count(*)::int AS total
  FROM perfis_permissoes GROUP BY perfil ORDER BY perfil;
SELECT 'PERMISSOES_EXCLUSIVAS' AS verificacao,codigo
  FROM permissoes WHERE exclusiva_admin ORDER BY codigo;
SELECT 'LEGADO_PRESERVADO' AS verificacao,perfil::text AS legado,perfil_acesso, count(*)::int AS usuarios
  FROM usuarios GROUP BY perfil::text,perfil_acesso ORDER BY legado,perfil_acesso;
SELECT 'ULTIMO_ADMIN' AS verificacao,count(*)::int AS total
  FROM usuarios WHERE perfil_acesso='ADMIN' AND ativo=true;
-- Esperado: 34 permissões; 34 regras por perfil (136 no total).
-- O resultado da contagem de administradores precisa ser >= 1 antes do rollout.
