-- Patrimônio+ | 015: fundação de usuários e permissões individuais
-- Preparatória: não muda ainda as verificações de autorização das rotas antigas.
-- Compatibilidade: perfil legado ADMIN/AUXILIAR/CONSULTA permanece intacto.
BEGIN;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS perfil_acesso text;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS troca_senha_obrigatoria boolean NOT NULL DEFAULT false;

UPDATE usuarios SET perfil_acesso =
  CASE UPPER(perfil::text) WHEN 'ADMIN' THEN 'ADMIN'
    WHEN 'AUXILIAR' THEN 'OPERADOR'
    WHEN 'CONSULTA' THEN 'CONSULTA'
    ELSE 'CONSULTA' END
WHERE perfil_acesso IS NULL;

ALTER TABLE usuarios ALTER COLUMN perfil_acesso SET DEFAULT 'CONSULTA';
ALTER TABLE usuarios ALTER COLUMN perfil_acesso SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='usuarios_perfil_acesso_valido') THEN
    ALTER TABLE usuarios ADD CONSTRAINT usuarios_perfil_acesso_valido
      CHECK (perfil_acesso IN ('ADMIN','GESTOR','OPERADOR','CONSULTA'));
  END IF;
END $$;

-- Unicidade de login sem diferenciar caixa ou espaços laterais.
-- Se houver duplicados legados, a migration falhará e fará rollback integral.
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_normalizado_unico
  ON usuarios ((lower(btrim(email))));

CREATE TABLE IF NOT EXISTS permissoes (
  codigo text PRIMARY KEY,
  modulo text NOT NULL,
  descricao text NOT NULL,
  exclusiva_admin boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS perfis_permissoes (
  perfil text NOT NULL CHECK(perfil IN ('ADMIN','GESTOR','OPERADOR','CONSULTA')),
  permissao_codigo text NOT NULL REFERENCES permissoes(codigo),
  permitido boolean NOT NULL DEFAULT false,
  PRIMARY KEY (perfil,permissao_codigo)
);
CREATE TABLE IF NOT EXISTS usuarios_permissoes (
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  permissao_codigo text NOT NULL REFERENCES permissoes(codigo),
  permitido boolean NOT NULL,
  atualizado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id,permissao_codigo)
);
CREATE INDEX IF NOT EXISTS idx_usuarios_permissoes_codigo ON usuarios_permissoes(permissao_codigo);

INSERT INTO permissoes(codigo,modulo,descricao,exclusiva_admin) VALUES
  ('patrimonios.consultar','Patrimônios','Consultar patrimônios',false),
  ('patrimonios.cadastrar','Patrimônios','Cadastrar patrimônio',false),
  ('patrimonios.editar','Patrimônios','Editar patrimônio',false),
  ('patrimonios.movimentar','Movimentações','Movimentar patrimônio',false),
  ('patrimonios.inativar','Patrimônios','Inativar patrimônio',false),
  ('patrimonios.restaurar','Patrimônios','Restaurar patrimônio',false),
  ('patrimonios.excluir','Patrimônios','Excluir definitivamente',true),
  ('manutencoes.consultar','Manutenções','Consultar manutenções',false),
  ('manutencoes.abrir','Manutenções','Registrar manutenção',false),
  ('manutencoes.concluir','Manutenções','Concluir manutenção',false),
  ('importacoes.simular','Importação','Simular importação',false),
  ('importacoes.executar','Importação','Executar importação',false),
  ('importacoes.consultar','Importação','Consultar lotes',false),
  ('importacoes.excluir_lote','Importação','Excluir lote de teste',true),
  ('catalogo.consultar','Catálogo','Consultar Catálogo',false),
  ('catalogo.cadastrar','Catálogo','Cadastrar item',false),
  ('catalogo.editar','Catálogo','Editar item',false),
  ('catalogo.excluir','Catálogo','Excluir item próprio',false),
  ('catalogo.atualizar_sigem','Catálogo','Atualizar SIGEM',true),
  ('centros.consultar','Centros de Custo','Consultar centros',false),
  ('centros.gerenciar','Centros de Custo','Gerenciar centros',false),
  ('etiquetas.visualizar','Etiquetas','Visualizar etiquetas',false),
  ('etiquetas.gerar','Etiquetas','Gerar PNG e ZIP',false),
  ('etiquetas.imprimir','Etiquetas','Imprimir A4',false),
  ('relatorios.consultar','Relatórios','Consultar relação',false),
  ('relatorios.exportar','Relatórios','Exportar CSV e PDF',false),
  ('configuracoes.templates','Configurações','Alterar templates',false),
  ('historico.individual','Histórico','Consultar histórico do patrimônio',false),
  ('historico.geral','Histórico','Consultar Histórico Geral',false),
  ('historico.exportar','Histórico','Exportar Histórico Geral',false),
  ('usuarios.consultar','Usuários','Consultar usuários',true),
  ('usuarios.gerenciar','Usuários','Gerenciar usuários',true),
  ('usuarios.permissoes','Usuários','Alterar permissões',true),
  ('usuarios.redefinir_senha','Usuários','Redefinir senha de terceiros',true)
ON CONFLICT(codigo) DO UPDATE SET modulo=EXCLUDED.modulo,descricao=EXCLUDED.descricao,
  exclusiva_admin=EXCLUDED.exclusiva_admin;

INSERT INTO perfis_permissoes(perfil,permissao_codigo,permitido) VALUES
  ('ADMIN','patrimonios.consultar',true),
  ('GESTOR','patrimonios.consultar',true),
  ('OPERADOR','patrimonios.consultar',true),
  ('CONSULTA','patrimonios.consultar',true),
  ('ADMIN','patrimonios.cadastrar',true),
  ('GESTOR','patrimonios.cadastrar',true),
  ('OPERADOR','patrimonios.cadastrar',true),
  ('CONSULTA','patrimonios.cadastrar',false),
  ('ADMIN','patrimonios.editar',true),
  ('GESTOR','patrimonios.editar',true),
  ('OPERADOR','patrimonios.editar',true),
  ('CONSULTA','patrimonios.editar',false),
  ('ADMIN','patrimonios.movimentar',true),
  ('GESTOR','patrimonios.movimentar',true),
  ('OPERADOR','patrimonios.movimentar',true),
  ('CONSULTA','patrimonios.movimentar',false),
  ('ADMIN','patrimonios.inativar',true),
  ('GESTOR','patrimonios.inativar',true),
  ('OPERADOR','patrimonios.inativar',false),
  ('CONSULTA','patrimonios.inativar',false),
  ('ADMIN','patrimonios.restaurar',true),
  ('GESTOR','patrimonios.restaurar',true),
  ('OPERADOR','patrimonios.restaurar',false),
  ('CONSULTA','patrimonios.restaurar',false),
  ('ADMIN','patrimonios.excluir',true),
  ('GESTOR','patrimonios.excluir',false),
  ('OPERADOR','patrimonios.excluir',false),
  ('CONSULTA','patrimonios.excluir',false),
  ('ADMIN','manutencoes.consultar',true),
  ('GESTOR','manutencoes.consultar',true),
  ('OPERADOR','manutencoes.consultar',true),
  ('CONSULTA','manutencoes.consultar',true),
  ('ADMIN','manutencoes.abrir',true),
  ('GESTOR','manutencoes.abrir',true),
  ('OPERADOR','manutencoes.abrir',true),
  ('CONSULTA','manutencoes.abrir',false),
  ('ADMIN','manutencoes.concluir',true),
  ('GESTOR','manutencoes.concluir',true),
  ('OPERADOR','manutencoes.concluir',true),
  ('CONSULTA','manutencoes.concluir',false),
  ('ADMIN','importacoes.simular',true),
  ('GESTOR','importacoes.simular',true),
  ('OPERADOR','importacoes.simular',true),
  ('CONSULTA','importacoes.simular',false),
  ('ADMIN','importacoes.executar',true),
  ('GESTOR','importacoes.executar',true),
  ('OPERADOR','importacoes.executar',false),
  ('CONSULTA','importacoes.executar',false),
  ('ADMIN','importacoes.consultar',true),
  ('GESTOR','importacoes.consultar',true),
  ('OPERADOR','importacoes.consultar',true),
  ('CONSULTA','importacoes.consultar',false),
  ('ADMIN','importacoes.excluir_lote',true),
  ('GESTOR','importacoes.excluir_lote',false),
  ('OPERADOR','importacoes.excluir_lote',false),
  ('CONSULTA','importacoes.excluir_lote',false),
  ('ADMIN','catalogo.consultar',true),
  ('GESTOR','catalogo.consultar',true),
  ('OPERADOR','catalogo.consultar',true),
  ('CONSULTA','catalogo.consultar',true),
  ('ADMIN','catalogo.cadastrar',true),
  ('GESTOR','catalogo.cadastrar',true),
  ('OPERADOR','catalogo.cadastrar',false),
  ('CONSULTA','catalogo.cadastrar',false),
  ('ADMIN','catalogo.editar',true),
  ('GESTOR','catalogo.editar',true),
  ('OPERADOR','catalogo.editar',false),
  ('CONSULTA','catalogo.editar',false),
  ('ADMIN','catalogo.excluir',true),
  ('GESTOR','catalogo.excluir',true),
  ('OPERADOR','catalogo.excluir',false),
  ('CONSULTA','catalogo.excluir',false),
  ('ADMIN','catalogo.atualizar_sigem',true),
  ('GESTOR','catalogo.atualizar_sigem',false),
  ('OPERADOR','catalogo.atualizar_sigem',false),
  ('CONSULTA','catalogo.atualizar_sigem',false),
  ('ADMIN','centros.consultar',true),
  ('GESTOR','centros.consultar',true),
  ('OPERADOR','centros.consultar',true),
  ('CONSULTA','centros.consultar',true),
  ('ADMIN','centros.gerenciar',true),
  ('GESTOR','centros.gerenciar',true),
  ('OPERADOR','centros.gerenciar',false),
  ('CONSULTA','centros.gerenciar',false),
  ('ADMIN','etiquetas.visualizar',true),
  ('GESTOR','etiquetas.visualizar',true),
  ('OPERADOR','etiquetas.visualizar',true),
  ('CONSULTA','etiquetas.visualizar',true),
  ('ADMIN','etiquetas.gerar',true),
  ('GESTOR','etiquetas.gerar',true),
  ('OPERADOR','etiquetas.gerar',true),
  ('CONSULTA','etiquetas.gerar',true),
  ('ADMIN','etiquetas.imprimir',true),
  ('GESTOR','etiquetas.imprimir',true),
  ('OPERADOR','etiquetas.imprimir',true),
  ('CONSULTA','etiquetas.imprimir',true),
  ('ADMIN','relatorios.consultar',true),
  ('GESTOR','relatorios.consultar',true),
  ('OPERADOR','relatorios.consultar',true),
  ('CONSULTA','relatorios.consultar',true),
  ('ADMIN','relatorios.exportar',true),
  ('GESTOR','relatorios.exportar',true),
  ('OPERADOR','relatorios.exportar',true),
  ('CONSULTA','relatorios.exportar',true),
  ('ADMIN','configuracoes.templates',true),
  ('GESTOR','configuracoes.templates',true),
  ('OPERADOR','configuracoes.templates',false),
  ('CONSULTA','configuracoes.templates',false),
  ('ADMIN','historico.individual',true),
  ('GESTOR','historico.individual',true),
  ('OPERADOR','historico.individual',true),
  ('CONSULTA','historico.individual',true),
  ('ADMIN','historico.geral',true),
  ('GESTOR','historico.geral',true),
  ('OPERADOR','historico.geral',false),
  ('CONSULTA','historico.geral',false),
  ('ADMIN','historico.exportar',true),
  ('GESTOR','historico.exportar',true),
  ('OPERADOR','historico.exportar',false),
  ('CONSULTA','historico.exportar',false),
  ('ADMIN','usuarios.consultar',true),
  ('GESTOR','usuarios.consultar',false),
  ('OPERADOR','usuarios.consultar',false),
  ('CONSULTA','usuarios.consultar',false),
  ('ADMIN','usuarios.gerenciar',true),
  ('GESTOR','usuarios.gerenciar',false),
  ('OPERADOR','usuarios.gerenciar',false),
  ('CONSULTA','usuarios.gerenciar',false),
  ('ADMIN','usuarios.permissoes',true),
  ('GESTOR','usuarios.permissoes',false),
  ('OPERADOR','usuarios.permissoes',false),
  ('CONSULTA','usuarios.permissoes',false),
  ('ADMIN','usuarios.redefinir_senha',true),
  ('GESTOR','usuarios.redefinir_senha',false),
  ('OPERADOR','usuarios.redefinir_senha',false),
  ('CONSULTA','usuarios.redefinir_senha',false)
ON CONFLICT (perfil,permissao_codigo) DO NOTHING;

-- Protege o último administrador inclusive contra duas atualizações concorrentes.
CREATE OR REPLACE FUNCTION proteger_ultimo_admin_patrimonio()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  qtd integer;
BEGIN
  PERFORM pg_advisory_xact_lock(150015);
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Contas de usuário devem ser inativadas, não excluídas';
  END IF;
  IF OLD.perfil_acesso = 'ADMIN' AND OLD.ativo = true
     AND (NEW.perfil_acesso <> 'ADMIN' OR NEW.ativo = false) THEN
    SELECT count(*) INTO qtd FROM usuarios
      WHERE perfil_acesso = 'ADMIN' AND ativo = true;
    IF qtd <= 1 THEN
      RAISE EXCEPTION 'Não é permitido desativar o último administrador';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_proteger_ultimo_admin_patrimonio ON usuarios;
CREATE TRIGGER trg_proteger_ultimo_admin_patrimonio
BEFORE UPDATE OR DELETE ON usuarios
FOR EACH ROW EXECUTE FUNCTION proteger_ultimo_admin_patrimonio();

-- Substituição atômica de exceções e revogação de sessões.
CREATE OR REPLACE FUNCTION atualizar_permissoes_individuais_patrimonio(
  p_usuario uuid, p_administrador uuid, p_excecoes jsonb
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  item jsonb;
  anteriores jsonb;
BEGIN
  IF p_usuario = p_administrador THEN
    RAISE EXCEPTION 'Não é permitido alterar as próprias permissões';
  END IF;
  IF jsonb_typeof(p_excecoes) <> 'array' OR jsonb_array_length(p_excecoes)>100 THEN
    RAISE EXCEPTION 'Lista de exceções inválida';
  END IF;
  PERFORM 1 FROM usuarios WHERE id=p_usuario FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_excecoes) LOOP
    IF jsonb_typeof(item->'permitido') <> 'boolean'
       OR NOT EXISTS (
         SELECT 1 FROM permissoes
         WHERE codigo=item->>'codigo' AND exclusiva_admin=false
       ) THEN
      RAISE EXCEPTION 'Permissão individual inválida';
    END IF;
  END LOOP;
  SELECT coalesce(jsonb_agg(jsonb_build_object('codigo',permissao_codigo,'permitido',permitido)),'[]'::jsonb)
  INTO anteriores FROM usuarios_permissoes WHERE usuario_id=p_usuario;
  DELETE FROM usuarios_permissoes WHERE usuario_id=p_usuario;
  INSERT INTO usuarios_permissoes(usuario_id,permissao_codigo,permitido,atualizado_por)
  SELECT p_usuario,x.value->>'codigo',(x.value->>'permitido')::boolean,p_administrador
  FROM jsonb_array_elements(p_excecoes) AS x(value);
  UPDATE sessoes SET revogado_em=now()
  WHERE usuario_id=p_usuario AND revogado_em IS NULL;
  INSERT INTO historico_alteracoes(tabela,registro_id,operacao,dados_anteriores,dados_novos,usuario_id)
  VALUES('usuarios',p_usuario,'PERMISSOES_ALTERADAS',anteriores,p_excecoes,p_administrador);
END;
$$;

-- Transição de legado: a migração NÃO altera o tipo de usuarios.perfil.
-- Usuários AUXILIAR continuam funcionando até a API migrar para perfil_acesso.
COMMIT;

SELECT 'PERMISSOES_015_OK' AS resultado,
 (SELECT count(*) FROM permissoes) AS permissoes,
 (SELECT count(*) FROM perfis_permissoes) AS regras,
 (SELECT count(*) FROM usuarios WHERE perfil_acesso='ADMIN' AND ativo) AS administradores_ativos;
