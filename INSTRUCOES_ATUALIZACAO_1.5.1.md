# Frontend 1.5.1

Esta versão é somente frontend.
Não há alteração de API nem de banco.

## Corrigido/refinado
- Ficha pública usa o novo formato de `centros_custo`, `descricoes_padrao` e `centros_permitidos`.
- Tipo e Status voltam a mostrar somente seus valores originais.
- Mobilidade e centros permitidos ficam em Localização e condição.
- `[Móvel]` e `[Em manutenção]` aparecem como texto concatenado na listagem, sem pill.
- `Fixo` deixa de ser exibido como badge.
- Movimentação e Manutenção reorganizadas em blocos simétricos e numerados.

## Publicação
Pode subir por cima da versão atual.
O runtime é `js/runtime-v151/`.

Depois:
1. Ctrl + F5.
2. Confirme `build 1.5.1`.
3. Teste a ficha pública, a ficha interna, movimentação e manutenção.
