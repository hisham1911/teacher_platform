import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PortalVideoPlayer } from './portal-video-player';

describe('PortalVideoPlayer', () => {
  it('renders a native HTML5 video with preload="metadata" for local MP4 files', () => {
    const { container } = render(
      <PortalVideoPlayer
        src="/content/videos/present-simple-podcast.mp4"
        poster="/content/videos/posters/present-simple-podcast.jpg"
        title="Present Simple Lesson"
      />
    );

    const videoEl = container.querySelector('video');
    expect(videoEl).toBeInTheDocument();
    expect(videoEl).toHaveAttribute('src', '/content/videos/present-simple-podcast.mp4');
    expect(videoEl).toHaveAttribute('poster', '/content/videos/posters/present-simple-podcast.jpg');
    expect(videoEl).toHaveAttribute('preload', 'metadata');
  });

  it('renders an iframe when given an external or YouTube video URL', () => {
    render(
      <PortalVideoPlayer
        src="https://www.youtube.com/embed/sample123"
        title="External Lesson"
      />
    );

    const iframeEl = screen.getByTitle('External Lesson');
    expect(iframeEl).toBeInTheDocument();
    expect(iframeEl.tagName.toLowerCase()).toBe('iframe');
  });
});
