INSERT INTO pipelines (id, source_key, action_type, action_config)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'demo-source',
  'add_field',
  '{"fieldName":"processed","fieldValue":true}'::jsonb
)
ON CONFLICT (source_key) DO NOTHING;

INSERT INTO pipelines (id, source_key, action_type, action_config)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'uppercase-source',
  'uppercase_name',
  '{}'::jsonb
)
ON CONFLICT (source_key) DO NOTHING;

INSERT INTO pipelines (id, source_key, action_type, action_config)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  'filter-source',
  'filter_fields',
  '{"allowedFields":["event","data"]}'::jsonb
)
ON CONFLICT (source_key) DO NOTHING;

INSERT INTO subscribers (id, pipeline_id, target_url)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'https://example.com/webhook-receiver'
)
ON CONFLICT DO NOTHING;
