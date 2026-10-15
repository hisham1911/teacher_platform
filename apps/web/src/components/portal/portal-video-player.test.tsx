import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PortalVideoPlayer } from './portal-video-player';
import { toEmbedVideoUrl } from './video-utils';

describe('toEmbedVideoUrl', () => {
  it('converts youtube.com/watch?v= URLs into embed URLs', () => {
    expect(toEmbedVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ'
    );
  });

  it('converts youtu.be/ share URLs into embed URLs', () => {
    expect(toEmbedVideoUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ'
    );
  });

  it('converts youtube.com/shorts/ URLs into embed URLs', () => {
    expect(toEmbedVideoUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ'
    );
  });

  it('converts vimeo URLs into player embed URLs', () => {
    expect(toEmbedVideoUrl('https://vimeo.com/123456789')).toBe(
      'https://player.vimeo.com/video/123456789'
    );
  });

  it('converts google drive preview URLs', () => {
    expect(toEmbedVideoUrl('https://drive.google.com/file/d/1a2b3c4d5e6f/view')).toBe(
      'https://drive.google.com/file/d/1a2b3c4d5e6f/preview'
    );
  });

  it('preserves existing embed or direct video URLs unchanged', () => {
    expect(toEmbedVideoUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ'
    );
    expect(toEmbedVideoUrl('https://example.com/video.mp4')).toBe('https://example.com/video.mp4');
    expect(toEmbedVideoUrl('')).toBe('');
  });
});

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

  it('renders an iframe with converted embed URL when given a standard YouTube watch link', () => {
    render(
      <PortalVideoPlayer
        src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="YouTube Lesson"
      />
    );

    const iframeEl = screen.getByTitle('YouTube Lesson');
    expect(iframeEl).toBeInTheDocument();
    expect(iframeEl.tagName.toLowerCase()).toBe('iframe');
    expect(iframeEl).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('supports videoUrl alias prop and renders correctly', () => {
    render(
      <PortalVideoPlayer
        videoUrl="https://youtu.be/dQw4w9WgXcQ"
        title="Aliased Video"
      />
    );

    const iframeEl = screen.getByTitle('Aliased Video');
    expect(iframeEl).toBeInTheDocument();
    expect(iframeEl).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ');
  });
});
