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
- `negociacoes`
- `plano_de_contas`
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

`transacoes` possui (universo diferente de `boletos` — SPEC-117, tela "Contas em Aberto"):

- `id`
- `tipo` (enum `transacao_tipo`: `receita`/`despesa`/`transferencia`; `despesa` = Contas a Pagar, `receita` = Contas a Receber)
- `descricao`
- `valor`
- `dt_emissao`, `dt_vencimento`, `dt_pagamento`
- `num_parc`
- `status_pago` (smallint: `0`=ABERTO, `1`=PAGO, `2`=CANCELADO — **nunca** tratar `1` nem `2` como "em aberto")
- `negociacao_id` (FK para `negociacoes`)
- `empresa_id` (FK direta para `empresas`; existe em paralelo à FK `negociacoes.empresa_id` — a tela "Contas em Aberto" usa a de `negociacoes`, replicando `scripts/panorama_financeiro/exportar_nao_quitadas.py`)
- `perfil` (`ribeirao`/`sao_paulo`/null — SPEC-064; **não aparece no `supabase/db/current/01_schema_full.sql` central nem em `src/lib/supabase/types.ts` deste sistema, mas existe de fato no banco desde a migration `20260805_077`** — achado colateral da SPEC-117, snapshot central está atrasado)

`negociacoes` possui:

- `id`
- `empresa_id` (FK para `empresas`)
- `contato_id` (FK para `contatos`, pode ser nulo)
- `plano_contas_id` (FK para `plano_de_contas`, pode ser nulo)
- `tipo` (mesmo enum `transacao_tipo`)
- `cod_duplicata`
- `total_parc`

`plano_de_contas` possui:

- `id`
- `nome`
- `nivel`
- `parent_id` (hierarquia grupo/subgrupo/categoria)

## Contas em Aberto (SPEC-117)

- Página `src/pages/ContasEmAberto.tsx` (rota `/contas-em-aberto`) lê `transacoes` filtrando `status_pago = 0`, com joins/embeds supabase-js equivalentes a `transacoes JOIN negociacoes JOIN empresas LEFT JOIN contatos LEFT JOIN plano_de_contas`.
- É um universo **desconectado** de `boletos` — não existe FK entre as duas tabelas. Não confundir: `ConsultarDuplicatas.tsx`/`Boletos.tsx` continuam lendo só `boletos`.
- ~2.382 linhas com `status_pago = 0` hoje (acima do cap silencioso de 1000 do PostgREST — a página pagina a busca em lotes com `.range()`, achado da SPEC-081).
- `dt_vencimento` com ano fora de 2000-2100 é dado corrompido conhecido (import antigo) — a página trata como inválido em vez de calcular atraso sem sentido, mesma regra de `scripts/panorama_financeiro/exportar_nao_quitadas.py`.

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

## SPEC-007 — SSO entre sistemas

- Este app é destino do fluxo Orçamentos -> Financeiro/Bancário.
- `AuthProvider` chama `consumeCodeFromUrl('financeiro')` antes de redirecionar para login.
- A migration central `20260708_030_spec007_sso_cross_system` e as Edge Functions `generate-cross-system-code`/`exchange-cross-system-code` estão publicadas no Supabase remoto desde 2026-07-07; falta homologação com usuário real.
- Não aceitar `access_token`/`refresh_token` em query string; somente `sso_code`.
