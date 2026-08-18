import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StudentAudioPlayer } from './student-audio-player';

describe('StudentAudioPlayer', () => {
  it('يعرض تحكمًا واضحًا ورسالة عملية عند تعذر تشغيل الوسيط المحمي', () => {
    render(<StudentAudioPlayer src="/api/v1/player/media/protected" />);

    expect(screen.getByRole('heading', { name: 'استمع جيدًا' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تشغيل الصوت' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'موضع تشغيل الصوت' })).toBeDisabled();

    fireEvent.error(screen.getByTestId('question-media-audio'));
    expect(screen.getByRole('alert')).toHaveTextContent('تعذر تشغيل الصوت');
  });
});
