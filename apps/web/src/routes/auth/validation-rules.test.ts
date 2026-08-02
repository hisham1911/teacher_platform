import { describe, expect, it } from 'vitest';

describe('Signup validation rules', () => {
  it('rejects empty name / invalid email / short password / mismatched confirm', () => {
    const validateSignup = (input: { fullName: string; email: string; password: string; confirm: string }) => {
      const errors: Record<string, string> = {};
      if (input.fullName.trim().length < 2) errors.fullName = 'الاسم الكامل مطلوب';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) errors.email = 'صيغة البريد الإلكتروني غير صحيحة';
      if (input.password.length < 8) errors.password = 'كلمة المرور يجب ألا تقل عن 8 أحرف';
      if (input.password !== input.confirm) errors.confirm = 'تأكيد كلمة المرور لا يطابق';
      return errors;
    };

    expect(validateSignup({ fullName: 'أ', email: 'bad', password: '123', confirm: '456' })).toEqual({
      fullName: 'الاسم الكامل مطلوب',
      email: 'صيغة البريد الإلكتروني غير صحيحة',
      password: 'كلمة المرور يجب ألا تقل عن 8 أحرف',
      confirm: 'تأكيد كلمة المرور لا يطابق',
    });

    expect(
      validateSignup({ fullName: 'معلمة أحمد', email: 'teacher@example.com', password: 'Password123!', confirm: 'Password123!' }),
    ).toEqual({});
  });
});

describe('Login validation rules', () => {
  it('rejects invalid email and empty password', () => {
    const validateLogin = (input: { email: string; password: string }) => {
      const errors: Record<string, string> = {};
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) errors.email = 'صيغة البريد الإلكتروني غير صحيحة';
      if (input.password.length === 0) errors.password = 'كلمة المرور مطلوبة';
      return errors;
    };

    expect(validateLogin({ email: 'bad', password: '' })).toEqual({
      email: 'صيغة البريد الإلكتروني غير صحيحة',
      password: 'كلمة المرور مطلوبة',
    });
  });
});
