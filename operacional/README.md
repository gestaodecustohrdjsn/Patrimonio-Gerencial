# Patrimônio+ Operacional

PWA mobile do Patrimônio+ para operações patrimoniais em campo.

## Estado desta branch

Primeira fundação funcional da versão 0.1.0:

- PWA instalável em orientação vertical;
- frontend isolado em /operacional/;
- autenticação própria usando a API oficial;
- troca obrigatória de senha;
- sessão local que diferencia ausência de rede de sessão inválida;
- listagem de patrimônios;
- busca por ID, ID SES, descrição, centro de custo e marca/modelo;
- ficha rápida expandida;
- ações visíveis conforme permissões do usuário;
- leitura de QR Code pela câmera quando BarcodeDetector estiver disponível;
- campo manual como fallback do scanner;
- Service Worker restrito ao escopo /operacional/.

Ainda não implementado nesta etapa:

- IndexedDB para base patrimonial offline;
- fila de operações (outbox);
- sincronização idempotente;
- edição, movimentação e manutenção pelo mobile;
- histórico individual completo;
- cadastro offline;
- resolução de conflitos.

O Gerencial existente não é alterado por esta pasta.
