# Patrimônio+ 1.5.5 / API 3.3.2 — Tipo SIGEM e CSV

## Tipo x SIGEM

1. Abrir Novo patrimônio.
2. Sem SIGEM selecionado:
   - Tipo deve permanecer editável.
3. Pesquisar e selecionar um item SIGEM que possua Tipo:
   - Tipo deve ser preenchido automaticamente;
   - Tipo deve ficar bloqueado no cadastro;
   - mensagem deve indicar o Tipo definido pelo SIGEM.
4. Alterar o texto do campo SIGEM, desfazendo o vínculo:
   - Tipo deve voltar a ficar editável.
5. Abrir um patrimônio já vinculado ao SIGEM em edição:
   - Tipo deve ficar editável;
   - se Tipo e SIGEM forem iguais, mostrar conferência normal;
   - se forem diferentes, mostrar aviso.
6. Na edição, escolher um Tipo diferente do SIGEM e salvar:
   - deve aparecer confirmação;
   - Cancelar não grava;
   - Confirmar grava;
   - histórico deve registrar a alteração de Tipo.

## Proteção da API

No cadastro novo, a API 3.3.2 deve rejeitar qualquer divergência Tipo x SIGEM.
Na edição, a divergência só pode ser gravada com `confirmar_tipo_divergente: true`.
Não há migration de banco nesta versão.

## CSV da Relação Patrimonial

1. Abrir Relatórios e selecionar um Centro de Custo.
2. Exportar CSV.
3. Confirmar que o conteúdo começa diretamente pelo cabeçalho.
4. Não devem existir linhas extras com Centro de Custo ou filtros.
5. Nome esperado:
   `{Centro de Custo} - Relação Patrimonial - DD-MM-AAAA.csv`.

## Diagnóstico do catálogo

Executar `database/tests/008_catalogo_tipos.sql`.
O resultado ideal de `itens_sem_tipo_valido` é 0.
