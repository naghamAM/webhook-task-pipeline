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
  'https://webhook.site/f7f4bbbf-4065-47ac-ae89-f237dc8a7f45'
)
ON CONFLICT DO NOTHING;

-- Sample jobs for demo
INSERT INTO jobs (id, pipeline_id, payload, status, processed_payload)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '11111111-1111-1111-1111-111111111111',
  '{"event":"user.created","data":{"name":"John Doe"}}'::jsonb,
  'processed',
  '{"event":"user.created","data":{"name":"John Doe"},"processed":true}'::jsonb
)
ON CONFLICT DO NOTHING;

INSERT INTO jobs (id, pipeline_id, payload, status, error_message)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  '11111111-1111-1111-1111-111111111111',
  '{"event":"user.updated","data":{"id":123}}'::jsonb,
  'pending',
  NULL
)
ON CONFLICT DO NOTHING;

-- Sample delivery attempts for demo
INSERT INTO delivery_attempts (id, job_id, subscriber_id, attempt_number, status, response_status)
VALUES (
  '77777777-7777-7777-7777-777777777777',
  '55555555-5555-5555-5555-555555555555',
  '22222222-2222-2222-2222-222222222222',
  1,
  'success',
  200
)
ON CONFLICT DO NOTHING;
