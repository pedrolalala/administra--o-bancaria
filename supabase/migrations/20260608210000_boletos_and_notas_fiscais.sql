-- Add new columns to boletos if they don't exist
ALTER TABLE public.boletos ADD COLUMN IF NOT EXISTS numero_documento TEXT;
ALTER TABLE public.boletos ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'Normal';
ALTER TABLE public.boletos ADD COLUMN IF NOT EXISTS projeto_id UUID REFERENCES public.projetos(id);
ALTER TABLE public.boletos ADD COLUMN IF NOT EXISTS parcela_id UUID REFERENCES public.projeto_parcelas(id);

-- Create notas_fiscais table
CREATE TABLE IF NOT EXISTS public.notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_nf TEXT NOT NULL,
  serie TEXT,
  data_emissao DATE,
  valor NUMERIC,
  arquivo_url TEXT,
  fornecedor TEXT,
  arquiteto TEXT,
  boleto_id UUID REFERENCES public.boletos(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for notas_fiscais
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_nf" ON public.notas_fiscais;
CREATE POLICY "authenticated_select_nf" ON public.notas_fiscais FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_nf" ON public.notas_fiscais;
CREATE POLICY "authenticated_insert_nf" ON public.notas_fiscais FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_update_nf" ON public.notas_fiscais;
CREATE POLICY "authenticated_update_nf" ON public.notas_fiscais FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_delete_nf" ON public.notas_fiscais;
CREATE POLICY "authenticated_delete_nf" ON public.notas_fiscais FOR DELETE TO authenticated USING (true);

-- Ensure user pedro exists for auth testing
DO $$
DECLARE
  new_user_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'pedro@lucenera.com.br') THEN
    new_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      new_user_id, '00000000-0000-0000-0000-000000000000', 'pedro@lucenera.com.br',
      crypt('Skip@Pass', gen_salt('bf')), NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}', '{"name": "Pedro"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '', NULL, '', '', ''
    );
    INSERT INTO public.usuarios (id, email, nome, role)
    VALUES (new_user_id, 'pedro@lucenera.com.br', 'Pedro', 'admin')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Seed Data as per Acceptance Criteria
DO $$
DECLARE
  v_empresa_id uuid;
  v_projeto_id uuid;
BEGIN
  -- Get or Create Company
  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE cnpj = '12345678000199') THEN
    v_empresa_id := gen_random_uuid();
    INSERT INTO public.empresas (id, codigo, nome, cnpj, cidade, estado)
    VALUES (v_empresa_id, 9999, 'Empresa Teste CNAB', '12345678000199', 'São Paulo', 'SP');
  ELSE
    SELECT id INTO v_empresa_id FROM public.empresas WHERE cnpj = '12345678000199' LIMIT 1;
  END IF;

  -- Create dummy project
  IF NOT EXISTS (SELECT 1 FROM public.projetos WHERE nome = 'Projeto Teste MANOELLA') THEN
    v_projeto_id := gen_random_uuid();
    INSERT INTO public.projetos (id, nome, empresa_id)
    VALUES (v_projeto_id, 'Projeto Teste MANOELLA', v_empresa_id);
  ELSE
    SELECT id INTO v_projeto_id FROM public.projetos WHERE nome = 'Projeto Teste MANOELLA' LIMIT 1;
  END IF;

  -- Seed required data
  INSERT INTO public.boletos (nosso_numero, numero_documento, nome_pagador, valor, vencimento, status, tipo, empresa_id, projeto_id)
  VALUES 
    ('10000000001', 'N4716', 'MANOELLA', 484.40, '2026-06-15', 'Pendente', 'Nota Fiscal', v_empresa_id, v_projeto_id),
    ('10000000002', 'N4719', 'MANOELLA', 7113.36, '2026-05-30', 'Pendente', 'Nota Fiscal', v_empresa_id, v_projeto_id),
    ('10000000003', 'N4719', 'MANOELLA', 7113.36, '2026-06-30', 'Pendente', 'Nota Fiscal', v_empresa_id, v_projeto_id),
    ('10000000004', 'N4720', 'MANOELLA', 50000.00, '2026-05-29', 'Pendente', 'Nota Fiscal', v_empresa_id, v_projeto_id),
    ('10000000005', 'N4683', 'MANOELLA', 1775.00, '2026-06-15', 'Pendente', 'Nota Fiscal', v_empresa_id, v_projeto_id)
  ON CONFLICT (nosso_numero) DO NOTHING;
END $$;
