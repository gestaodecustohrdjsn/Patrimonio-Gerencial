# Patrimônio+ Operacional

PWA mobile do Patrimônio+ para operações patrimoniais em campo.

## Versão 0.2.0

A experiência foi redesenhada para ser uma central de operações, sem carregar a relação completa de patrimônios na tela inicial.

### Implementado

- Painel inicial leve com quantitativos via endpoint agregado;
- ações principais: Escanear item, Novo Patrimônio, Auditoria e Procurar Patrimônio;
- QR Code abre diretamente uma ficha operacional completa;
- busca sob demanda com filtros por centro, tipo, situação, mobilidade e manutenção;
- movimentação de patrimônio;
- entrada e conclusão de manutenção;
- inativação e reativação;
- edição operacional de ID SES, descrição, marca/modelo, estado e mobilidade;
- cadastro rápido de novo patrimônio;
- histórico individual e acesso condicional ao Histórico Geral;
- menu lateral com Painel, Sincronização, Gerencial, Auditorias e Históricos;
- espaço reservado para Depósito / Estoque;
- Service Worker isolado em /operacional/.

### Arquitetura de desempenho

A tela inicial não usa `GET /api/patrimonios`. O PWA utiliza endpoints específicos e leves:

- `GET /api/operacional/resumo`;
- `GET /api/operacional/patrimonios/qr/:token`;
- `GET /api/operacional/patrimonios/:id`;
- `GET /api/operacional/patrimonios/buscar`.

### Próximas etapas

- IndexedDB;
- fila offline (outbox);
- sincronização idempotente;
- resolução de conflitos;
- desenho funcional do módulo de Auditoria;
- desenho funcional de Depósito / Estoque.


## Refinamento 0.2.1

- painel inicial simplificado, sem saudação e textos auxiliares;
- botões operacionais sem descrições redundantes;
- ficha individual redesenhada como cartão de identidade patrimonial;
- Marca / Modelo movido para o rodapé da identificação principal;
- ID SES removida da grade inferior por já estar no cabeçalho;
- botão de inativação com ícone vetorial embutido;
- operador logado removido dos formulários de movimentação e manutenção e registrado implicitamente pela sessão;
- Novo Patrimônio com busca no Catálogo, vínculo por descricao_padrao_id e classificação herdada do item selecionado.


## Perda patrimonial 0.3.0

- estado terminal PERDIDO separado de inativação;
- formulário de perda com motivo, data, responsáveis e observações;
- geração de Termo de Perda por impressão/salvar PDF;
- snapshot do patrimônio e do template no momento da ocorrência;
- filtro específico para patrimônios perdidos;
- patrimônios perdidos ficam fora das contagens operacionais;
- template do termo preparado para validação pela Qualidade.
