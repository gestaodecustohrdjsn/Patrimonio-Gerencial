# Arquitetura v0.1

## Objetivo
Substituir a planilha como fonte oficial, mantendo planilhas apenas como entrada, saída e conferência.

## Camadas
- GitHub Pages: interface estática.
- Supabase Auth: autenticação.
- Supabase API/RPC: acesso controlado.
- PostgreSQL: dados, regras e concorrência.
- Supabase Storage: documentos e etiquetas futuras.

## Decisões
1. A ID interna é gerada pelo banco.
2. Patrimônio não é apagado operacionalmente; é inativado.
3. Centros de custo inativos continuam no histórico.
4. Importações passam por área temporária.
5. O de-para é persistente.
6. Toda alteração relevante gera histórico.
7. A página pública do QR Code não mostrará informações financeiras.
