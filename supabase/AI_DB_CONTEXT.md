# AI DB Context — Administração Bancária

Este sistema é um módulo do ecossistema Lucenera e usa um Supabase compartilhado.

Este arquivo resume o recorte de banco necessário para trabalhar na Administração Bancária sem depender de documentação externa.

Se uma demanda exigir estrutura de banco que não aparece neste contexto, documente a necessidade em `DB_CHANGE_REQUEST_TEMPLATE.md` antes de alterar código que dependa dela.

## Papel do sistema

Sistema financeiro para boletos, notas fiscais, remessa e retorno bancário.

## Objetos reais relevantes no Supabase

Principais tabelas:

- `boletos`
- `notas_fiscais`
- `projeto_parcelas`
- `orcamentos`
- `projetos`
- `empresas`
- `contatos`
- `remessas`
- `retornos_processados`
- `transacoes`
- `contas_bancarias`
- `categorias_financeiras`

Views úteis:

- `vw_financeiro_projetos`
- `vw_conferencia_financeira`
- `vw_remessas_completa`
- `vw_remessas_resumo_status`
- `vw_remessas_vencimento`
- `vw_transacoes_completas`

## Colunas-chave reais

`boletos` possui:

- `id`
- `nosso_numero`
- `nome_pagador`
- `valor`
- `vencimento`
- `data_pagamento`
- `valor_pago`
- `status`
- `empresa_id`
- `numero_documento`
- `projeto_id`
- `parcela_id`
- `comprovante_url`
- `orcamento_id`

`notas_fiscais` possui:

- `id`
- `numero_nf`
- `serie`
- `data_emissao`
- `valor`
- `arquivo_url`
- `fornecedor`
- `arquiteto`
- `boleto_id`
- `orcamento_id`

`projeto_parcelas` possui:

- `id`
- `projeto_id`
- `numero_parcela`
- `valor`
- `status`
- `data_vencimento`
- `data_pagamento`
- `valor_pago`
- `forma_pagamento`
- `comprovante_url`
- `transacao_id`
- `venda_id`
- `orcamento_id`

## Decisões de negócio

- O financeiro deve usar `orcamento_id` como vínculo principal do fluxo aprovado.
- Não usar `venda_id` para orçamento aprovado -> financeiro.
- `projeto_id` pode existir em tabelas legadas, mas o financeiro deve conseguir exibir projeto/cliente derivando de `orcamento_id`.
- Remessa/batch é ação manual do usuário.
- Nota fiscal pode evoluir, mas depende de decisão de API/ferramenta.
- Upload de boleto/NF deve futuramente migrar para OneDrive/SharePoint.
- Vencimento deve vir de forma/prazo do orçamento; financeiro valida.

## Como agir ao codar

- Filtrar/listar financeiro por `orcamento_id` quando o registro veio de orçamento aprovado.
- Quando precisar mostrar cliente/projeto, buscar por relacionamento com `orcamentos`/`projetos`/`contatos`.
- Se precisar de novas colunas, preencha `DB_CHANGE_REQUEST_TEMPLATE.md`.
- Automação fiscal ou bancária nova precisa de SPEC e solicitação de banco/integração antes de virar código definitivo.
- Se precisar de API de nota fiscal ou storage OneDrive, registre pendência técnica.
