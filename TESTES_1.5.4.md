# Patrimônio+ 1.5.4 — Testes de Relação por Centro de Custo

## Objetivo
Validar a geração de relações patrimoniais sem alterar dados cadastrais.

## Casos de teste

1. **Acesso ao módulo**
   - Abrir `Relatórios`.
   - Confirmar que a tela `Relação por Centro de Custo` é exibida.
   - Antes de escolher um centro, nenhum patrimônio deve ser listado.

2. **Centro de custo**
   - Selecionar um centro com patrimônios.
   - Conferir se o total exibido corresponde aos bens cuja localização atual é aquele centro.
   - Patrimônios removidos não devem aparecer.

3. **Filtros/flags**
   - Testar individualmente e em combinação:
     - Tipo;
     - Status;
     - Mobilidade (Fixo/Móvel);
     - Manutenção (Em manutenção/Fora de manutenção);
     - Aquisição;
     - Estado de conservação;
     - Pesquisa textual.
   - Confirmar que os cards e a tabela respondem aos mesmos filtros.

4. **Localização atual x centros permitidos**
   - Usar um bem Móvel que possua centros permitidos.
   - Confirmar que ele aparece apenas na relação do seu centro atual.
   - Centros permitidos não devem ser tratados como localização.

5. **Exportação CSV**
   - Exportar a relação.
   - Conferir Centro de Custo, filtros e colunas:
     ID Interna, ID SES, Descrição, Tipo, Estado, Mobilidade, Status e Manutenção.

6. **Impressão/PDF**
   - Clicar em `Imprimir / Salvar PDF`.
   - Conferir cabeçalho, Centro de Custo, filtros, total e tabela.
   - Confirmar orientação A4 horizontal e quebra de páginas sem cortar linhas.

## Regressão rápida
- Login;
- Patrimônios;
- Cadastro/edição;
- Movimentação;
- Manutenção;
- Etiquetas;
- Importação.

Nenhum desses módulos deve ter mudança funcional nesta versão.
