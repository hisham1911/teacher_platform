import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateCommentContent,
  guestbookClient,
  isTeacherLoggedIn,
  loginTeacher,
  logoutTeacher,
  getTeacherSession,
  studentResultsClient,
  customLessonsClient,
  getMergedGrammarTopics,
  uploadMediaToSupabase,
} from './guestbook-client';

describe('Guestbook Client & Validation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('validateCommentContent', () => {
    it('accepts thoughtful, educational comments', () => {
      const result = validateCommentContent('مبادرة رائعة ومفيدة جداً للمعلمات شكراً لكم');
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

    it('authenticates Teacher with fixed credentials', () => {
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
      expect(session?.name).toBe('معلمات اللغة الإنجليزية');

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

  describe('studentResultsClient', () => {
    it('returns default seed results when empty', async () => {
      const results = await studentResultsClient.getAllResults();
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results[0]?.studentName).toBeTruthy();
    });

    it('records a new quiz result and retrieves it', async () => {
      const recorded = await studentResultsClient.recordResult({
        studentName: 'نورة إبراهيم',
        studentGrade: 'الصف الثاني متوسط',
        category: 'placement',
        activityTitle: 'التشخيص اللغوي',
        score: 18,
        totalQuestions: 20,
      });

      expect(recorded.id).toBeTruthy();
      expect(recorded.percentage).toBe(90);
      expect(recorded.studentName).toBe('نورة إبراهيم');

      const all = await studentResultsClient.getAllResults();
      expect(all.some((r) => r.studentName === 'نورة إبراهيم')).toBe(true);
    });

    it('deletes result when teacher is logged in', async () => {
      const recorded = await studentResultsClient.recordResult({
        studentName: 'طالبة للاختبار',
        category: 'grammar',
        activityTitle: 'اختبار تجريبي',
        score: 5,
        totalQuestions: 5,
      });

      // Cannot delete without login
      const fail = await studentResultsClient.deleteResult(recorded.id);
      expect(fail).toBe(false);

      // Login
      loginTeacher('maryam', 'maryam2026');
      const ok = await studentResultsClient.deleteResult(recorded.id);
      expect(ok).toBe(true);

      const all = await studentResultsClient.getAllResults();
      expect(all.some((r) => r.id === recorded.id)).toBe(false);
      logoutTeacher();
    });
  });

  describe('customLessonsClient & getMergedGrammarTopics', () => {
    it('merges custom lesson into grammar topics', async () => {
      const initial = getMergedGrammarTopics();
      expect(initial.length).toBeGreaterThanOrEqual(9);

      await customLessonsClient.saveLesson({
        id: 'new-grammar-rule',
        section: 'grammar',
        slug: 'new-grammar-rule',
        titleAr: 'قاعدة تجريبية مضافة',
        titleEn: 'Experimental Rule',
        description: 'شرح القاعدة التجريبية',
        imageUrl: '/content/grammar/present-simple.jpg',
        questions: [],
      });

      const updated = getMergedGrammarTopics();
      expect(updated.some((t) => t.slug === 'new-grammar-rule')).toBe(true);

      // Delete custom lesson
      await customLessonsClient.deleteCustomLesson('new-grammar-rule');
      const afterDelete = getMergedGrammarTopics();
      expect(afterDelete.some((t) => t.slug === 'new-grammar-rule')).toBe(false);
    });
  });

  describe('uploadMediaToSupabase', () => {
    it('rejects files larger than 50MB', async () => {
      const largeFile = new File(['x'.repeat(100)], 'large-video.mp4', { type: 'video/mp4' });
      Object.defineProperty(largeFile, 'size', { value: 55 * 1024 * 1024 });

      const res = await uploadMediaToSupabase(largeFile);
      expect(res.url).toBe('');
      expect(res.error).toContain('50 ميجابايت');
    });
  });
});


