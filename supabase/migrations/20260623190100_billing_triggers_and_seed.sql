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
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.check_orcamento_approval()
RETURNS trigger AS $$
DECLARE
  v_invalid_count int;
  v_zero_price_count int;
BEGIN
  IF NEW.status = 'Aprovado' AND OLD.status IS DISTINCT FROM 'Aprovado' THEN
    IF NEW.projeto_id IS NULL THEN
      RAISE EXCEPTION 'Projeto não encontrado para este orçamento.';
    END IF;

    SELECT count(*) INTO v_invalid_count
    FROM public.projeto_itens
    WHERE projeto_id = NEW.projeto_id AND validado = false;

    IF v_invalid_count > 0 THEN
      RAISE EXCEPTION 'Existem itens não validados no projeto.';
    END IF;

    SELECT count(*) INTO v_zero_price_count
    FROM public.projeto_itens
    WHERE projeto_id = NEW.projeto_id AND preco_unitario = 0;

    IF v_zero_price_count > 0 THEN
      RAISE EXCEPTION 'Orçamento % possui peças especiais pendentes de precificação', COALESCE(NEW.numero, NEW.id::text);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_check_orcamento_approval ON public.orcamentos;
CREATE TRIGGER tr_check_orcamento_approval
  BEFORE UPDATE OF status ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.check_orcamento_approval();

-- pg_net is not available in the current Postgres environment.
-- In a full Supabase project, this function would use net.http_post or Supabase Database Webhooks.
CREATE OR REPLACE FUNCTION public.invoke_billing_automation()
RETURNS trigger AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_orcamento_aprovado ON public.orcamentos;
CREATE TRIGGER on_orcamento_aprovado
  AFTER UPDATE OF status ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.invoke_billing_automation();
