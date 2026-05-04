# Quick Task: Registrar login LinkedIn para auditoria

## Objetivo
Garantir que usuários autenticados/cadastrados via LinkedIn sejam identificados no banco para controle interno de auditoria, seguindo o padrão existente usado para Google/Clerk.

## Plano
- Localizar persistência atual de método de autenticação/cadastro.
- Adicionar detecção de LinkedIn em payloads do Clerk.
- Atualizar testes do webhook/auth.
- Rodar validação focada.
