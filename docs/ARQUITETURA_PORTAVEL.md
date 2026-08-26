# Arquitetura portátil

O frontend não possui SDK de banco nem SDK de autenticação.
Todos os serviços (`auth`, `centros`, `sigem`, `patrimonios`) dependem apenas de `js/lib/api.js`.

A sessão é um token opaco emitido pela API. O token bruto fica no navegador e somente o hash SHA-256 fica no banco.
