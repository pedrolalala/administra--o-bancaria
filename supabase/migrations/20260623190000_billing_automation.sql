DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Insert pedrolucenera if not exists
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

-- Create notas_fiscais storage bucket if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('notas_fiscais', 'notas_fiscais', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage
DROP POLICY IF EXISTS "Public notas_fiscais Read" ON storage.objects;
CREATE POLICY "Public notas_fiscais Read" ON storage.objects FOR SELECT USING (bucket_id = 'notas_fiscais');

DROP POLICY IF EXISTS "Authenticated notas_fiscais Insert" ON storage.objects;
CREATE POLICY "Authenticated notas_fiscais Insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'notas_fiscais');

-- Check RLS on orcamentos
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_select_orcamentos" ON public.orcamentos;
CREATE POLICY "authenticated_select_orcamentos" ON public.orcamentos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_update_orcamentos" ON public.orcamentos;
CREATE POLICY "authenticated_update_orcamentos" ON public.orcamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Check RLS on boletos
ALTER TABLE public.boletos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_select_boletos" ON public.boletos;
CREATE POLICY "authenticated_select_boletos" ON public.boletos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_boletos" ON public.boletos;
CREATE POLICY "authenticated_insert_boletos" ON public.boletos FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_boletos" ON public.boletos;
CREATE POLICY "authenticated_update_boletos" ON public.boletos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Check RLS on projeto_parcelas
ALTER TABLE public.projeto_parcelas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_select_parcelas" ON public.projeto_parcelas;
CREATE POLICY "authenticated_select_parcelas" ON public.projeto_parcelas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_update_parcelas" ON public.projeto_parcelas;
CREATE POLICY "authenticated_update_parcelas" ON public.projeto_parcelas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Seed Data to test automation
DO $$
DECLARE
  v_empresa_id uuid;
  v_projeto_id uuid;
  v_orcamento_id uuid;
BEGIN
  -- Get Company
  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE cnpj = '12345678000199') THEN
    v_empresa_id := gen_random_uuid();
    INSERT INTO public.empresas (id, codigo, nome, razao_social, cnpj, cidade, estado)
    VALUES (v_empresa_id, 9999, 'Empresa Teste Billing', 'Empresa Teste Billing LTDA', '12345678000199', 'São Paulo', 'SP');
  ELSE
    SELECT id INTO v_empresa_id FROM public.empresas WHERE cnpj = '12345678000199' LIMIT 1;
  END IF;

  -- Create dummy project
  IF NOT EXISTS (SELECT 1 FROM public.projetos WHERE nome = 'Projeto Billing Automation') THEN
    v_projeto_id := gen_random_uuid();
    INSERT INTO public.projetos (id, codigo, nome, empresa_id, status)
    VALUES (v_projeto_id, 'PRJ-BILL', 'Projeto Billing Automation', v_empresa_id, 'Ajustes finais');
    
    -- Create dummy parcels
    INSERT INTO public.projeto_parcelas (projeto_id, numero_parcela, valor, data_vencimento, status)
    VALUES 
      (v_projeto_id, 1, 1000.00, CURRENT_DATE + interval '30 days', 'pendente'),
      (v_projeto_id, 2, 1000.00, CURRENT_DATE + interval '60 days', 'pendente');
      
    -- Create budget
    v_orcamento_id := gen_random_uuid();
    INSERT INTO public.orcamentos (id, empresa_id, projeto_id, status, valor_total, desconto_global)
    VALUES (v_orcamento_id, v_empresa_id, v_projeto_id, 'aguardando_aprovacao', 2000.00, 0.00);
    
    -- Create items for RT calculation testing
    INSERT INTO public.projeto_itens (projeto_id, descricao, quantidade, preco_unitario, validado)
    VALUES 
      (v_projeto_id, 'Luminária Pendente', 2, 500.00, true),
      (v_projeto_id, 'Fita de LED', 10, 100.00, true);
  END IF;
END $$;
