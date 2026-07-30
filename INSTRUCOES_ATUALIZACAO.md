# Atualização para v0.9

## Supabase
Não há SQL novo nesta versão. Mantenha o banco da v0.7/v0.8.

## GitHub
1. Faça backup de `js/config.js`.
2. Substitua os arquivos do repositório pelo conteúdo desta pasta.
3. Recoloque sua URL e chave pública no `js/config.js`, se necessário.
4. Faça commit e aguarde o GitHub Pages.
5. Atualize com Ctrl+F5.

## Teste da etiqueta
Abra um patrimônio, gere a etiqueta e compare a prévia com o PNG/PDF. O QR foi reduzido em mais 2%; a ID foi elevada apenas na prévia, pois a exportação já estava correta.

## Teste da importação
Abra `Importação`, selecione um CSV, confira o mapeamento automático, ajuste as colunas e clique em `Validar dados`. A importação só é liberada sem erros bloqueantes.

Campos obrigatórios na importação: descrição, tipo, aquisição e centro de custo. Valores e ID SES podem ficar vazios.
