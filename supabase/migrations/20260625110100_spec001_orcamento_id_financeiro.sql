-- SPEC-001 — vínculos por orçamento para Administração Bancária
-- Complemento idempotente para o projeto financeiro.
-- A RPC transacional fica no projeto de Orçamentos, mas estas colunas garantem
-- que Boletos e Notas Fiscais consigam filtrar e registrar dados por orcamento_id.

ALTER TABLE public.boletos
  ADD COLUMN IF NOT EXISTS orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL;

ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL;

ALTER TABLE public.projeto_parcelas
  ADD COLUMN IF NOT EXISTS orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_boletos_orcamento_id
  ON public.boletos(orcamento_id);

CREATE INDEX IF NOT EXISTS idx_notas_fiscais_orcamento_id
  ON public.notas_fiscais(orcamento_id);

CREATE INDEX IF NOT EXISTS idx_projeto_parcelas_orcamento_id
  ON public.projeto_parcelas(orcamento_id);
