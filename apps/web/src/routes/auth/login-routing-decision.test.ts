import { describe, expect, it } from 'vitest';

describe('Login post-success routing decision', () => {
  function decidePostLoginRoute(workspacesCount: number): string {
    if (workspacesCount === 0) return '/onboarding';
    if (workspacesCount === 1) return '/dashboard';
    return '/onboarding/choose';
  }

  it('user with no workspace goes to onboarding', () => {
    expect(decidePostLoginRoute(0)).toBe('/onboarding');
  });

  it('user with exactly one workspace goes to dashboard', () => {
    expect(decidePostLoginRoute(1)).toBe('/dashboard');
  });

  it('user with multiple workspaces goes to workspace chooser', () => {
    expect(decidePostLoginRoute(3)).toBe('/onboarding/choose');
  });
});
