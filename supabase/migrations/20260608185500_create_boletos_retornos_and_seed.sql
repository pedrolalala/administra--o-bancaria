-- 1. Create Tables
CREATE TABLE IF NOT EXISTS public.boletos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nosso_numero TEXT NOT NULL,
  nome_pagador TEXT,
  valor NUMERIC,
  vencimento DATE,
  data_pagamento DATE,
  valor_pago NUMERIC,
  status TEXT NOT NULL DEFAULT 'Pendente',
  empresa_id UUID REFERENCES public.empresas(id),
  CONSTRAINT boletos_nosso_numero_key UNIQUE (nosso_numero)
);

CREATE TABLE IF NOT EXISTS public.retornos_processados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo TEXT NOT NULL,
  data_upload TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  empresa_id UUID REFERENCES public.empresas(id),
  quantidade_liquidacoes INT,
  quantidade_confirmacoes INT,
  processado BOOLEAN DEFAULT TRUE
);

-- 2. Add RLS Policies
ALTER TABLE public.boletos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retornos_processados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_boletos" ON public.boletos;
CREATE POLICY "authenticated_select_boletos" ON public.boletos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_boletos" ON public.boletos;
CREATE POLICY "authenticated_insert_boletos" ON public.boletos FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_update_boletos" ON public.boletos;
CREATE POLICY "authenticated_update_boletos" ON public.boletos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_delete_boletos" ON public.boletos;
CREATE POLICY "authenticated_delete_boletos" ON public.boletos FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_select_retornos" ON public.retornos_processados;
CREATE POLICY "authenticated_select_retornos" ON public.retornos_processados FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_retornos" ON public.retornos_processados;
CREATE POLICY "authenticated_insert_retornos" ON public.retornos_processados FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_update_retornos" ON public.retornos_processados;
CREATE POLICY "authenticated_update_retornos" ON public.retornos_processados FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_delete_retornos" ON public.retornos_processados;
CREATE POLICY "authenticated_delete_retornos" ON public.retornos_processados FOR DELETE TO authenticated USING (true);

-- 3. Seed User and Mock Data
DO $$
DECLARE
  new_user_id uuid;
  v_empresa_id uuid;
BEGIN
  -- Seed user
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

  -- Create a default company for demo file CNPJ matching
  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE cnpj = '12345678000199') THEN
    v_empresa_id := gen_random_uuid();
    INSERT INTO public.empresas (id, codigo, nome, cnpj, cidade, estado)
    VALUES (v_empresa_id, 9999, 'Empresa Teste CNAB', '12345678000199', 'São Paulo', 'SP');
  ELSE
    SELECT id INTO v_empresa_id FROM public.empresas WHERE cnpj = '12345678000199' LIMIT 1;
  END IF;

  -- Insert some boletos to test matching
  IF v_empresa_id IS NOT NULL THEN
    INSERT INTO public.boletos (nosso_numero, nome_pagador, valor, vencimento, status, empresa_id)
    VALUES 
      ('123456789012', 'João Silva', 1500.00, CURRENT_DATE, 'Pendente', v_empresa_id),
      ('987654321098', 'Maria Oliveira', 2300.50, CURRENT_DATE, 'Pendente', v_empresa_id)
    ON CONFLICT (nosso_numero) DO NOTHING;
  END IF;

END $$;
