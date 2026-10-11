import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateCommentContent,
  guestbookClient,
  isTeacherLoggedIn,
  loginTeacher,
  logoutTeacher,
  getTeacherSession,
} from './guestbook-client';

describe('Guestbook Client & Validation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('validateCommentContent', () => {
    it('accepts thoughtful, educational comments', () => {
      const result = validateCommentContent('مبادرة رائعة ومفيدة جداً للمعلمة مريم شكراً لكِ');
      expect(result.isValid).toBe(true);
    });

    it('rejects comments that are too short', () => {
      const result = validateCommentContent('أه');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('قصير');
    });

    it('rejects comments containing external links', () => {
      const result = validateCommentContent('زوروا موقعنا https://example.com لمزيد من التفاصيل');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('الروابط');
    });

    it('rejects comments containing phone numbers', () => {
      const result = validateCommentContent('تواصلوا معي على 0501234567');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('الهواتف');
    });
  });

  describe('guestbookClient CRUD operations with Local Fallback', () => {
    it('returns default entries when initialized', async () => {
      const entries = await guestbookClient.getEntries();
      expect(entries.length).toBeGreaterThanOrEqual(4);
      expect(entries[0]?.name).toBeTruthy();
    });

    it('adds a new entry and increments count', async () => {
      const created = await guestbookClient.addEntry({
        name: 'طالبة مجتهدة',
        role: 'طالبة — الصف الأول متوسط',
        message: 'أحببت التمارين كثيراً والمسابقات التفاعلية',
      });

      expect(created.id).toBeTruthy();
      expect(created.name).toBe('طالبة مجتهدة');

      const all = await guestbookClient.getEntries();
      expect(all.some((e) => e.name === 'طالبة مجتهدة')).toBe(true);
    });

    it('increments likes on entry', async () => {
      const entries = await guestbookClient.getEntries();
      const first = entries[0]!;
      const initialLikes = first.likes;

      const updatedLikes = await guestbookClient.likeEntry(first.id, initialLikes);
      expect(updatedLikes).toBe(initialLikes + 1);
    });

    it('rejects deletion with wrong teacher passcode and deletes with valid passcode', async () => {
      const created = await guestbookClient.addEntry({
        name: 'تجربة حذف',
        role: 'زائر',
        message: 'رسالة للتجربة سيتم حذفها',
      });

      const failed = await guestbookClient.deleteEntry(created.id, 'wrong_pass');
      expect(failed).toBe(false);

      const success = await guestbookClient.deleteEntry(created.id, 'maryam2026');
      expect(success).toBe(true);

      const all = await guestbookClient.getEntries();
      expect(all.some((e) => e.id === created.id)).toBe(false);
    });

    it('isolates entries by topicSlug and returns seed Q&A', async () => {
      const psEntries = await guestbookClient.getEntries('present-simple');
      expect(psEntries.length).toBeGreaterThanOrEqual(1);
      expect(psEntries.some((e) => e.teacherReply !== undefined)).toBe(true);

      const generalEntries = await guestbookClient.getEntries();
      expect(generalEntries.some((e) => e.topicSlug === 'present-simple')).toBe(false);
    });

    it('allows teacher to reply with valid passcode and rejects with invalid passcode', async () => {
      const topic = 'relative-clauses';
      const question = await guestbookClient.addEntry({
        name: 'طالبة تسأل',
        role: 'طالبة',
        message: 'متى نستخدم whose؟',
        topicSlug: topic,
      });

      const failedReply = await guestbookClient.addTeacherReply(
        question.id,
        'إجابة غير مصرحة',
        'wrong-pass',
        topic
      );
      expect(failedReply).toBe(false);

      const successReply = await guestbookClient.addTeacherReply(
        question.id,
        'نستخدم whose للملكية (Possession)',
        'maryam2026',
        topic
      );
      expect(successReply).toBe(true);

      const topicEntries = await guestbookClient.getEntries(topic);
      const updated = topicEntries.find((e) => e.id === question.id);
      expect(updated?.teacherReply).toBe('نستخدم whose للملكية (Possession)');
      expect(updated?.repliedAt).toBeDefined();
    });

    it('toggles likes properly and prevents infinite liking', async () => {
      const entries = await guestbookClient.getEntries();
      const first = entries[0]!;
      const initialLikes = first.likes;

      // 1. First like
      const res1 = await guestbookClient.toggleLike(first.id, initialLikes);
      expect(res1.isLiked).toBe(true);
      expect(res1.newLikes).toBe(initialLikes + 1);

      // 2. Second click toggles off (un-likes) and does NOT increment infinitely
      const res2 = await guestbookClient.toggleLike(first.id, res1.newLikes);
      expect(res2.isLiked).toBe(false);
      expect(res2.newLikes).toBe(initialLikes);
    });

    it('authenticates Teacher Maryam Al-Somaili with fixed credentials', () => {
      expect(guestbookClient).toBeDefined();
      expect(isTeacherLoggedIn()).toBe(false);

      // Invalid login
      const fail = loginTeacher('wrong', 'wrong');
      expect(fail).toBe(false);
      expect(isTeacherLoggedIn()).toBe(false);

      // Valid login
      const success = loginTeacher('maryam', 'maryam2026');
      expect(success).toBe(true);
      expect(isTeacherLoggedIn()).toBe(true);

      const session = getTeacherSession();
      expect(session?.name).toBe('مريم الصميلي');

      // Logout
      logoutTeacher();
      expect(isTeacherLoggedIn()).toBe(false);
    });

    it('aggregates all entries across platform for the teacher dashboard', async () => {
      const all = await guestbookClient.getAllEntriesAcrossPlatform();
      expect(all.length).toBeGreaterThan(5);
      // Contains both guestbook (null topicSlug) and lesson topics
      expect(all.some((e) => !e.topicSlug)).toBe(true);
      expect(all.some((e) => e.topicSlug === 'present-simple')).toBe(true);
    });
  });
});


