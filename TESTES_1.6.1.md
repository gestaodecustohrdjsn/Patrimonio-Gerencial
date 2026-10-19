# Patrimônio+ 1.6.1 — Codificação do Catálogo + Card QR

## 1. Correção de codificação
1. Aplicar `database/migrations/010_corrigir_codificacao_catalogo.sql` usando PowerShell com `-Encoding UTF8`.
2. Esperado: `CATALOGO_ENCODING_161_OK`.
3. Executar `database/tests/011_catalogo_encoding.sql`, também com `-Encoding UTF8`.
4. Esperado: `TESTE_CATALOGO_ENCODING_161_OK`.

## 2. Conferência visual
Pesquisar no Catálogo e no Novo patrimônio:
- Aspirador Ultrassônico/ Bisturi Ultrassônico
- Bisturi Elétrico (a partir de 151 W)
- Bisturi Elétrico (até 150 W)
- Bisturi Elétrico - HRPP

Os acentos devem aparecer corretamente, sem sequências como `Ã©`, `Ã´` ou `Ã§`.

## 3. Configurações
1. Abrir Configurações.
2. Confirmar o card `Template da Página Pública do QR Code`.
3. Confirmar que expande e recolhe.
4. Nenhuma configuração funcional é salva ainda; é apenas reserva de interface.

## Observação importante
Em Windows PowerShell, para scripts SQL UTF-8 sem BOM, usar sempre:
`Get-Content <arquivo> -Raw -Encoding UTF8 | Set-Clipboard`

Frontend esperado: 1.6.1.
API permanece 3.4.0.
