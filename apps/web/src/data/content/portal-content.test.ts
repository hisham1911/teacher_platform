import { describe, it, expect } from 'vitest';
import { writingPrompts } from './writing';
import { portalCompetitions, speedQuestions } from './competitions';
import { portalSections } from './portal-sections';

describe('Portal Educational Content Integrity', () => {
  it('contains valid writing prompts with model answers and explanations', () => {
    expect(writingPrompts.length).toBeGreaterThanOrEqual(6);

    for (const prompt of writingPrompts) {
      expect(prompt.id).toBeTruthy();
      expect(prompt.slug).toBeTruthy();
      expect(prompt.modelAnswer.trim().length).toBeGreaterThan(0);
      expect(prompt.explanationAr.trim().length).toBeGreaterThan(0);
      expect(prompt.instructionAr.trim().length).toBeGreaterThan(0);

      if (prompt.category === 'sentence') {
        expect(prompt.scrambledWords).toBeDefined();
        expect(prompt.scrambledWords!.length).toBeGreaterThan(2);
      }
    }
  });

  it('contains 3 distinct competitions with valid metadata', () => {
    expect(portalCompetitions.length).toBe(3);
    const ids = portalCompetitions.map((c) => c.id);
    expect(ids).toContain('million');
    expect(ids).toContain('placement');
    expect(ids).toContain('speed');

    for (const comp of portalCompetitions) {
      expect(comp.titleAr).toBeTruthy();
      expect(comp.titleEn).toBeTruthy();
      expect(comp.path).toBeTruthy();
      expect(comp.features.length).toBeGreaterThan(0);
    }
  });

  it('validates speed questions have valid options and categories', () => {
    expect(speedQuestions.length).toBeGreaterThanOrEqual(25);

    for (const q of speedQuestions) {
      expect(q.prompt).toBeTruthy();
      expect(q.category).toBeTruthy();
      expect(q.options.length).toBe(4);
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      expect(correctCount).toBe(1);
    }
  });

  it('verifies portal sections list includes writing and competitions', () => {
    const sectionIds = portalSections.map((s) => s.id);
    expect(sectionIds).toContain('writing');
    expect(sectionIds).toContain('competitions');
    expect(sectionIds).toContain('grammar');
    expect(sectionIds).toContain('reading');
    expect(sectionIds).toContain('listening');
  });
});
