# Patrimônio+ 1.8.0 / API 3.6.0 — Documentos, Etiquetas A4 e Histórico Geral

## Ordem de publicação
1. Aplicar `database/migrations/013_configuracoes_documentos.sql`.
2. Executar `database/tests/014_configuracoes_documentos.sql`.
3. Esperado: `TESTE_CONFIGURACOES_DOCUMENTOS_180_OK`.
4. Publicar API 3.6.0.
5. Confirmar `/health` com versão 3.6.0.
6. Atualizar o frontend 1.8.0 e usar Ctrl+F5.

Use no PowerShell:
`Get-Content <arquivo> -Raw -Encoding UTF8 | Set-Clipboard`

## 1. Template da Relação Patrimonial
1. Abrir Configurações > Template da Relação Patrimonial.
2. Alterar Instituição, Unidade, Título e Rodapé.
3. Configurar as duas assinaturas.
4. Alternar data, quantidade e resumo de filtros.
5. Marcar/desmarcar colunas.
6. Enviar logo PNG/JPG/WEBP de até 300 KB.
7. Salvar.
8. Atualizar a página e confirmar persistência.
9. Testar Restaurar padrão e salvar novamente, se desejado.

## 2. Relação / PDF
1. Abrir Relatórios.
2. Selecionar Centro de Custo.
3. Aplicar alguns filtros.
4. Clicar Imprimir / Salvar PDF.
5. Confirmar:
   - logo;
   - instituição/unidade/título;
   - centro de custo;
   - data/quantidade conforme configuração;
   - resumo de filtros conforme configuração;
   - apenas as colunas habilitadas;
   - assinaturas;
   - rodapé;
   - repetição do cabeçalho da tabela em múltiplas páginas.
6. Usar o diálogo do navegador para Salvar como PDF.

## 3. Etiquetas A4
1. Abrir Etiquetas.
2. Selecionar 3 patrimônios.
3. Posição inicial = 1.
4. Imprimir A4 e confirmar grade 3 x 10.
5. Repetir com posição inicial = 8 e confirmar 7 espaços vazios antes da primeira etiqueta.
6. Selecionar mais de 30 itens e confirmar criação de múltiplas páginas.
7. Confirmar QR Code e ID interna em pelo menos 3 etiquetas.
8. Manter PNG/ZIP funcionando.

Observação: o layout inicial usa folha A4 genérica 3 x 10. Se a folha física possuir margens ou espaçamentos específicos do fabricante, ajustar medidas após teste físico.

## 4. Histórico Geral
1. Abrir Histórico.
2. Confirmar evento da importação oficial.
3. Testar pesquisa por ID interna ou texto.
4. Filtrar por módulo.
5. Filtrar por usuário.
6. Filtrar por operação.
7. Filtrar por data inicial/final.
8. Testar paginação.
9. Exportar a página em CSV.
10. Alterar o template da Relação Patrimonial e confirmar o novo evento no módulo Configurações.

## 5. Regressão
Confirmar:
- Visão Geral;
- Patrimônios;
- Centros de custo;
- Catálogo;
- Importação;
- movimentação;
- manutenção;
- etiqueta individual;
- QR público;
- perfil CONSULTA acessando apenas funções permitidas.

## Versões esperadas
- Frontend: 1.8.0
- API: 3.6.0
