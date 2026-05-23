INSERT INTO role_permissions (id, role, screen_name, can_read, can_create, can_edit, can_delete, can_write)
VALUES
  (gen_random_uuid()::text, 'admin',      'vacancies.audit', true, false, false, false, false),
  (gen_random_uuid()::text, 'superadmin', 'vacancies.audit', true, false, false, false, false)
ON CONFLICT (role, screen_name) DO NOTHING;
