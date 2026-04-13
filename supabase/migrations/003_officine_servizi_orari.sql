-- Add servizi and orari_apertura JSONB columns to officine
ALTER TABLE officine ADD COLUMN IF NOT EXISTS servizi jsonb DEFAULT '[]'::jsonb;
ALTER TABLE officine ADD COLUMN IF NOT EXISTS orari_apertura jsonb DEFAULT '[]'::jsonb;

-- Create storage bucket for logos (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to the logos bucket
CREATE POLICY "Authenticated users can upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Authenticated users can update their logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'logos');

CREATE POLICY "Anyone can read logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'logos');
