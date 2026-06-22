DO $$
DECLARE
  new_user_id uuid;
  empresa_islight uuid;
  empresa_lucenera uuid;
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
      new_user_id, '00000000-0000-0000-0000-000000000000',
      'pedro@lucenera.com.br', crypt('Skip@Pass', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Pedro"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '', NULL, '', '', ''
    );
    
    INSERT INTO public.usuarios (id, email, nome)
    VALUES (new_user_id, 'pedro@lucenera.com.br', 'Pedro')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Ensure empresas exist for the required views
  empresa_islight := gen_random_uuid();
  INSERT INTO public.empresas (id, nome, razao_social)
  VALUES (empresa_islight, 'ISLIGHT', 'ISLIGHT LTDA')
  ON CONFLICT DO NOTHING;

  empresa_lucenera := gen_random_uuid();
  INSERT INTO public.empresas (id, nome, razao_social)
  VALUES (empresa_lucenera, 'LUCENERA', 'LUCENERA LTDA')
  ON CONFLICT DO NOTHING;

  -- Insert mock boletos matching the User Story for Retorno de Boletos and Consultar Duplicatas
  INSERT INTO public.boletos (nosso_numero, numero_documento, nome_pagador, valor, vencimento, status, empresa_id)
  VALUES 
    ('09000004227', 'N4644', '21106 CASA AL - ANDR', 3000.00, '2026-05-20', 'Pendente', empresa_lucenera),
    ('09000004663', 'N4696', 'JOYCE YURI SILVESTRE', 10000.00, '2026-05-20', 'Pendente', empresa_lucenera),
    ('09000003175', '13175', 'CAMILA STRANG DE PAU', 14726.90, '2026-05-20', 'Pendente', empresa_lucenera),
    ('09000004218', 'N4641', 'CAMILA STRANG DE PAU', 1091.10, '2026-03-20', 'Pendente', empresa_lucenera),
    -- And for ISLIGHT and MANOELLA in Consultar Duplicatas
    ('09000001111', 'F123', 'MANOELLA', 1500.00, '2026-06-30', 'Pendente', empresa_islight),
    ('09000001112', '7180', 'CA & RIBEIRO INTERIORES LTDA', 802.57, '2026-06-30', 'Pendente', empresa_islight),
    ('09000001113', 'F125', 'MANOELLA', 2500.00, '2026-05-10', 'Pendente', empresa_islight),
    ('09000001114', 'F126', 'CLIENTE X', 500.00, '2026-06-15', 'Pago', empresa_islight)
  ON CONFLICT DO NOTHING;

END $$;
