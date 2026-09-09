CREATE TABLE public.chatgpt_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'ChatGPT',
  key_hash text NOT NULL,
  prefix text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone,
  revoked_at timestamp with time zone
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatgpt_api_keys TO authenticated;
GRANT ALL ON public.chatgpt_api_keys TO service_role;

ALTER TABLE public.chatgpt_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own ChatGPT API keys"
  ON public.chatgpt_api_keys
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_chatgpt_api_keys_updated_at
  BEFORE UPDATE ON public.chatgpt_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();