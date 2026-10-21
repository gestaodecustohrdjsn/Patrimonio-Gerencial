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
