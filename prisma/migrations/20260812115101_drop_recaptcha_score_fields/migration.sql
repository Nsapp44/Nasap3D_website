-- Switched from Google reCAPTCHA v3 (score-based) to hCaptcha (deterministic
-- checkbox challenge, no score) — these fields no longer mean anything.
ALTER TABLE "Settings" DROP COLUMN "recaptchaMinScore";
ALTER TABLE "ContactMessage" DROP COLUMN "recaptchaScore";
