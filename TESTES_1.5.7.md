# Patrimônio+ 1.5.7 / API 3.3.4 — Log global, Catálogo SIGEM e Configurações

## 1. Visão Geral — Histórico recente
1. Abrir a Visão Geral.
2. Confirmar que "Histórico recente do sistema" aparece logo abaixo de "Últimos patrimônios".
3. Conferir data/hora, usuário, ação e entidade.
4. Validar pelo menos:
   - cadastro/edição de patrimônio;
   - movimentação;
   - manutenção;
   - inativação/reativação;
   - criação/edição/inativação de Centro de Custo;
   - alteração da classificação SIGEM.
5. Se houver mais de 10 eventos, testar "Ver mais eventos" e "Mostrar menos".

## 2. Catálogo SIGEM
1. Confirmar a nova aba "Catálogo SIGEM" no menu, logo após Centros de custo.
2. Abrir como ADMIN.
3. Confirmar os totais por Tipo.
4. Pesquisar um item.
5. Filtrar por Tipo.
6. Alterar a classificação de um item sem patrimônio vinculado e depois retornar ao Tipo original.
7. Confirmar que a alteração aparece no Histórico recente da Visão Geral.
8. Confirmar que a gestão SIGEM não aparece mais dentro de Configurações.

## 3. Configurações
1. Abrir Configurações como ADMIN.
2. Confirmar que existe somente o card "Template da Relação Patrimonial".
3. Clicar no card e confirmar que ele expande.
4. Clicar novamente e confirmar que recolhe.
5. Confirmar a mensagem de estrutura preparada para o futuro editor do template.

## 4. Regressão
Confirmar rapidamente:
- login;
- Patrimônios;
- Centros de custo;
- Importação;
- Etiquetas;
- Relatórios;
- cadastro/edição;
- movimentação;
- manutenção.

## Versões esperadas
- Frontend: 1.5.7
- API /health: 3.3.4

Não há migration de banco nesta versão.
