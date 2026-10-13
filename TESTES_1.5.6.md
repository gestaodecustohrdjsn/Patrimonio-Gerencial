# Patrimônio+ 1.5.6 / API 3.3.3 — SIGEM, Configurações e Centros de Custo

## 1. Cadastro de patrimônio
1. Abrir **Novo patrimônio**.
2. Confirmar a ordem:
   - Descrição SIGEM;
   - Descrição complementar;
   - Tipo;
   - ID SES.
3. Selecionar um item SIGEM.
4. Confirmar que o Tipo é preenchido automaticamente e fica bloqueado no cadastro.
5. Preencher a descrição complementar (ex.: "preta com rodinhas") e salvar.
6. Na listagem, confirmar que aparece o nome SIGEM (ex.: "Cadeira"), e não apenas a descrição complementar.

## 2. Listagens e relatórios
Confirmar que o nome principal usa SIGEM em:
- Visão geral;
- Patrimônios;
- Pesquisa;
- Etiquetas;
- Relação por Centro de Custo;
- CSV da relação;
- impressão/PDF da relação;
- consulta pública por QR.
Para patrimônio sem SIGEM, a descrição complementar deve ser usada como fallback.

## 3. Configurações > Classificação do Catálogo SIGEM
1. Entrar como ADMIN.
2. Abrir **Configurações**.
3. Confirmar os totais por Tipo.
4. Pesquisar um item SIGEM.
5. Trocar a classificação.
6. Cancelar a primeira confirmação e verificar que nada muda.
7. Repetir, confirmar e verificar a alteração.
8. Se houver patrimônio vinculado e ainda usando o Tipo anterior, confirmar que ele é sincronizado.
9. Se houver patrimônio com Tipo divergente intencionalmente, ele não deve ser sobrescrito pela sincronização automática.

## 4. Centros de Custo
### Cadastro
1. Abrir **Centros de custo**.
2. Clicar em **+ Novo centro de custo**.
3. Cadastrar um centro de teste com código e nome únicos.
4. Confirmar que aparece como Ativo.

### Edição
1. Editar o centro de teste.
2. Alterar nome ou código.
3. Confirmar que a alteração aparece imediatamente.

### Inativar / Ativar
1. Inativar o centro.
2. Confirmar que fica como Inativo.
3. Confirmar que não aparece para novos cadastros ou movimentações.
4. Reativar e confirmar retorno às seleções.

### Exclusão segura
1. Criar um segundo centro de teste e não vinculá-lo a nada.
2. Excluir digitando o código exato: deve funcionar.
3. Tentar excluir um centro já usado por patrimônio ou movimentação: deve ser bloqueado e orientar a inativação.

## 5. Regressão
Confirmar rapidamente:
- login;
- cadastro/edição;
- inativar/reativar patrimônio;
- movimentação;
- manutenção;
- etiquetas;
- relatório;
- histórico.

## Versões esperadas
- Frontend: 1.5.6
- API /health: 3.3.3

Não há migration de banco nesta versão.
