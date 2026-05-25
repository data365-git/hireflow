-- 0018: seed Video Editor question template and standard message templates
INSERT INTO question_templates (id, name, description, is_system)
VALUES (
  'qt-video-editor-full',
  'Video Editor — Full Application',
  'Comprehensive screening for Video Editor roles',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO question_template_items (id, template_id, text, type, options, order_index)
VALUES
  ('qt-video-editor-full-q0', 'qt-video-editor-full', '📱 Telefon raqamingizni yuboring', 'phone', NULL, 0),
  ('qt-video-editor-full-q1', 'qt-video-editor-full', 'Oilaviy ahvolingizni ko''rsating', 'single-choice', '["Yolg''iz","Turmush qurgan","Ajrashgan","Boshqa"]'::jsonb, 1),
  ('qt-video-editor-full-q2', 'qt-video-editor-full', 'Talabamisiz?', 'yes-no', NULL, 2),
  ('qt-video-editor-full-q3', 'qt-video-editor-full', 'Ta''lim muassasasining nomi?', 'short-text', NULL, 3),
  ('qt-video-editor-full-q4', 'qt-video-editor-full', 'Ta''lim sohangizni ko''rsating', 'short-text', NULL, 4),
  ('qt-video-editor-full-q5', 'qt-video-editor-full', 'Qaysi shaklda o''qiysiz?', 'single-choice', '["Kunduzgi","Sirtqi","Kechki"]'::jsonb, 5),
  ('qt-video-editor-full-q6', 'qt-video-editor-full', 'Nechanchi kursda o''qiysiz?', 'single-choice', '["1-kurs","2-kurs","3-kurs","4-kurs","Magistratura","Bitirgan"]'::jsonb, 6),
  ('qt-video-editor-full-q7', 'qt-video-editor-full', 'Ingliz tilini bilish darajangiz qanday?', 'single-choice', '["None","A1-A2","B1-B2","C1-C2","Native"]'::jsonb, 7),
  ('qt-video-editor-full-q8', 'qt-video-editor-full', 'Rus tilini bilish darajangiz qanday?', 'single-choice', '["None","A1-A2","B1-B2","C1-C2","Native"]'::jsonb, 8),
  ('qt-video-editor-full-q9', 'qt-video-editor-full', '💼 Ish tajribangiz haqida ma''lumot bering.
🏢 Kompaniya nomi
👤 Lavozimingiz
📅 Ishlagan davringiz
📝 Ishdan ketish sababi', 'long-text', NULL, 9),
  ('qt-video-editor-full-q11', 'qt-video-editor-full', 'Nega aynan sizni ushbu lavozimga munosib nomzod sifatida tanlashimiz kerak? 100 so''zdan iborat motivatsion xat yozing. E''tibor bering: ushbu xat saralash jarayonida muhim rol o''ynaydi.', 'long-text', NULL, 11)
ON CONFLICT (id) DO NOTHING;

INSERT INTO message_templates (id, kind, name, content, is_system, owner_id, is_global)
VALUES
  ('mt-intro-uz-standard', 'intro', 'Standard Intro — UZ', 'Salom! Data365 jamoasiga qiziqishingiz uchun tashakkur. Quyidagi savollarga javob bering, biz sizning arizangizni ko''rib chiqamiz.', true, NULL, true),
  ('mt-success-uz-standard', 'success', 'Standard Success — UZ', 'Arizangiz qabul qilindi! 5 ish kuni ichida sizga javob beramiz. Tashakkur!', true, NULL, true),
  ('mt-intro-ru-standard', 'intro', 'Standard Intro — RU', 'Здравствуйте! Спасибо за интерес к команде Data365. Ответьте на вопросы ниже, и мы рассмотрим вашу заявку.', true, NULL, true),
  ('mt-success-ru-standard', 'success', 'Standard Success — RU', 'Ваша заявка принята! Мы свяжемся с вами в течение 5 рабочих дней. Спасибо!', true, NULL, true),
  ('mt-intro-en-standard', 'intro', 'Standard Intro — EN', 'Hi! Thanks for your interest in Data365. Please answer the questions below so we can review your application.', true, NULL, true),
  ('mt-success-en-standard', 'success', 'Standard Success — EN', 'Your application has been received. We will get back to you within 5 business days. Thank you!', true, NULL, true)
ON CONFLICT (id) DO NOTHING;
