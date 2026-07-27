# Arquitetura — Patrimônio+ v0.7

```text
GitHub Pages
    ├── Área administrativa autenticada
    └── Consulta pública somente leitura
                ↓
             Supabase
                ↓
            PostgreSQL
```

## Separação de acesso

A área administrativa usa autenticação Supabase e as políticas RLS existentes.

A consulta pública não recebe `SELECT` sobre a tabela `patrimonios`. Ela chama a função `consultar_patrimonio_publico(uuid)`, que retorna somente os campos permitidos de um único patrimônio identificado por token aleatório.

## QR Code

O QR aponta para:

```text
#/consulta/{public_token}
```

A ID interna continua visível na etiqueta, mas não é usada como chave pública previsível.

## Próxima etapa

A v0.8 será o módulo de importação da base patrimonial existente, com validação e prévia antes da confirmação.
