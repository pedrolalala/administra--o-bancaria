DO $$
DECLARE
  new_user_id uuid;
  emp_islight uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  emp_slide uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  emp_foc uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  emp_lucenera uuid := '44444444-4444-4444-4444-444444444444'::uuid;
BEGIN
  -- User Pedro
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'pedro@lucenera.com.br') THEN
    new_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone, phone_change, phone_change_token, reauthentication_token)
    VALUES (new_user_id, '00000000-0000-0000-0000-000000000000', 'pedro@lucenera.com.br', crypt('Skip@Pass', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider": "email", "providers": ["email"]}', '{"name": "Pedro"}', false, 'authenticated', 'authenticated', '', '', '', '', '', NULL, '', '', '');
  END IF;

  -- Empresas
  IF NOT EXISTS (SELECT 1 FROM empresas WHERE nome = 'ISLIGHT') THEN
    INSERT INTO empresas (id, codigo, nome, cnpj, cidade, estado, ativo) VALUES (emp_islight, 1, 'ISLIGHT', '00000000000100', 'RIBEIRAO PRETO', 'SP', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM empresas WHERE nome = 'SLIDE') THEN
    INSERT INTO empresas (id, codigo, nome, cnpj, cidade, estado, ativo) VALUES (emp_slide, 2, 'SLIDE', '00000000000200', 'RIBEIRAO PRETO', 'SP', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM empresas WHERE nome = 'FOC') THEN
    INSERT INTO empresas (id, codigo, nome, cnpj, cidade, estado, ativo) VALUES (emp_foc, 3, 'FOC', '00000000000300', 'RIBEIRAO PRETO', 'SP', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM empresas WHERE nome = 'LUCENERA') THEN
    INSERT INTO empresas (id, codigo, nome, cnpj, cidade, estado, ativo) VALUES (emp_lucenera, 4, 'LUCENERA', '00000000000400', 'RIBEIRAO PRETO', 'SP', true);
  END IF;

  -- Boletos for Retorno
  IF NOT EXISTS (SELECT 1 FROM boletos WHERE nosso_numero = '09000004227') THEN
    INSERT INTO boletos (nosso_numero, numero_documento, valor, vencimento, nome_pagador, status, empresa_id) VALUES
    ('09000004227', 'N4644', 3000.00, '2026-05-20', '21106 CASA AL - ANDR', 'Pendente', (SELECT id FROM empresas WHERE nome = 'LUCENERA' LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM boletos WHERE nosso_numero = '09000004663') THEN
    INSERT INTO boletos (nosso_numero, numero_documento, valor, vencimento, nome_pagador, status, empresa_id) VALUES
    ('09000004663', 'N4696', 10000.00, '2026-05-20', 'JOYCE YURI SILVESTRE', 'Pendente', (SELECT id FROM empresas WHERE nome = 'LUCENERA' LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM boletos WHERE nosso_numero = '09000003175') THEN
    INSERT INTO boletos (nosso_numero, numero_documento, valor, vencimento, nome_pagador, status, empresa_id) VALUES
    ('09000003175', 'I3175', 14726.90, '2026-05-20', 'CAMILA STRANG DE PAU', 'Pendente', (SELECT id FROM empresas WHERE nome = 'LUCENERA' LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM boletos WHERE nosso_numero = '09000004218') THEN
    INSERT INTO boletos (nosso_numero, numero_documento, valor, vencimento, nome_pagador, status, empresa_id) VALUES
    ('09000004218', 'N4641', 1091.10, '2026-03-20', 'CAMILA STRANG DE PAU', 'Pendente', (SELECT id FROM empresas WHERE nome = 'LUCENERA' LIMIT 1));
  END IF;

  -- Boletos for Consultar Duplicatas (mixed)
  IF NOT EXISTS (SELECT 1 FROM boletos WHERE nosso_numero = 'DUP001') THEN
    INSERT INTO boletos (nosso_numero, numero_documento, valor, vencimento, nome_pagador, status, empresa_id) VALUES
    ('DUP001', '7180', 802.57, '2026-06-30', 'CA & RIBEIRO INTERIORES LTDA', 'Pendente', (SELECT id FROM empresas WHERE nome = 'ISLIGHT' LIMIT 1)),
    ('DUP002', '7181', 1500.00, '2026-05-15', 'MANOELLA', 'Pago', (SELECT id FROM empresas WHERE nome = 'ISLIGHT' LIMIT 1)),
    ('DUP003', '7182', 320.00, '2026-06-01', 'ISLIGHT', 'Pendente', (SELECT id FROM empresas WHERE nome = 'ISLIGHT' LIMIT 1)),
    ('DUP004', '7183', 450.00, '2026-04-10', 'CLIENTE VENCIDO 1', 'Pendente', (SELECT id FROM empresas WHERE nome = 'ISLIGHT' LIMIT 1)),
    ('DUP005', '7184', 1200.00, '2026-07-20', 'CLIENTE FUTURO 1', 'Pendente', (SELECT id FROM empresas WHERE nome = 'SLIDE' LIMIT 1)),
    ('DUP006', '7185', 900.00, '2026-06-15', 'MANOELLA', 'Pendente', (SELECT id FROM empresas WHERE nome = 'FOC' LIMIT 1)),
    ('DUP007', '7186', 800.00, '2026-06-10', 'ISLIGHT', 'Pago', (SELECT id FROM empresas WHERE nome = 'SLIDE' LIMIT 1)),
    ('DUP008', '7187', 550.00, '2026-05-20', 'NOVO CLIENTE', 'Pendente', (SELECT id FROM empresas WHERE nome = 'LUCENERA' LIMIT 1)),
    ('DUP009', '7188', 2100.00, '2026-06-05', 'EMPRESA TESTE', 'Pendente', (SELECT id FROM empresas WHERE nome = 'LUCENERA' LIMIT 1)),
    ('DUP010', '7189', 300.00, '2026-06-25', 'MANOELLA', 'Pendente', (SELECT id FROM empresas WHERE nome = 'ISLIGHT' LIMIT 1));
  END IF;

END $$;
