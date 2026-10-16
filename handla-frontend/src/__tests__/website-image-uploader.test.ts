import {
  uploadWebsiteImage,
  safeUploadWebsiteImage,
  validateWebsiteImage,
  MAX_WEBSITE_IMAGE_SIZE,
  ALLOWED_WEBSITE_IMAGE_TYPES,
} from '../lib/website-image-uploader';
import { websiteProjectApi } from '../lib/api';

jest.mock('../lib/api', () => ({
  websiteProjectApi: {
    uploadImage: jest.fn(),
  },
}));

describe('website-image-uploader unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateWebsiteImage', () => {
    it('passes for valid JPEG, PNG, WEBP, and GIF files under 5MB', () => {
      const validPng = new File(['dummy content'], 'photo.png', { type: 'image/png' });
      expect(() => validateWebsiteImage(validPng)).not.toThrow();

      const validJpg = new File(['dummy content'], 'photo.jpg', { type: 'image/jpeg' });
      expect(() => validateWebsiteImage(validJpg)).not.toThrow();

      const validWebp = new File(['dummy content'], 'photo.webp', { type: 'image/webp' });
      expect(() => validateWebsiteImage(validWebp)).not.toThrow();

      const validGif = new File(['dummy content'], 'photo.gif', { type: 'image/gif' });
      expect(() => validateWebsiteImage(validGif)).not.toThrow();
    });

    it('throws error when file exceeds 5MB limit', () => {
      const oversizedContent = new Uint8Array(MAX_WEBSITE_IMAGE_SIZE + 10);
      const oversizedFile = new File([oversizedContent], 'large.png', { type: 'image/png' });

      expect(() => validateWebsiteImage(oversizedFile)).toThrow(/Image too large/);
    });

    it('throws error for unsupported MIME types (e.g. svg, pdf, exe)', () => {
      const svgFile = new File(['<svg></svg>'], 'image.svg', { type: 'image/svg+xml' });
      expect(() => validateWebsiteImage(svgFile)).toThrow(/Unsupported image type/);

      const pdfFile = new File(['%PDF'], 'document.pdf', { type: 'application/pdf' });
      expect(() => validateWebsiteImage(pdfFile)).toThrow(/Unsupported image type/);
    });
  });

  describe('uploadWebsiteImage', () => {
    it('uploads file via multipart FormData and returns public URL', async () => {
      const file = new File(['image-bytes'], 'banner.png', { type: 'image/png' });
      const mockUrl = 'https://bucket.s3.region.amazonaws.com/website/projects/123-abc.png';

      (websiteProjectApi.uploadImage as jest.Mock).mockResolvedValueOnce({
        data: {
          message: 'Website image uploaded successfully',
          data: { fileUrl: mockUrl },
        },
      });

      const onProgress = jest.fn();
      const url = await uploadWebsiteImage({ file, onProgress });

      expect(url).toBe(mockUrl);
      expect(websiteProjectApi.uploadImage).toHaveBeenCalledWith(
        expect.any(FormData),
        expect.objectContaining({
          signal: undefined,
          onUploadProgress: expect.any(Function),
        }),
      );
    });

    it('passes AbortSignal to websiteProjectApi.uploadImage to support upload cancellation', async () => {
      const file = new File(['image-bytes'], 'banner.png', { type: 'image/png' });
      const controller = new AbortController();

      (websiteProjectApi.uploadImage as jest.Mock).mockImplementationOnce(
        (_formData: FormData, config: any) => {
          if (config.signal?.aborted) {
            return Promise.reject(new Error('canceled'));
          }
          return Promise.resolve({ data: { data: { fileUrl: 'https://url' } } });
        },
      );

      controller.abort();

      await expect(
        uploadWebsiteImage({ file, signal: controller.signal }),
      ).rejects.toThrow('canceled');

      expect(websiteProjectApi.uploadImage).toHaveBeenCalledWith(
        expect.any(FormData),
        expect.objectContaining({
          signal: controller.signal,
        }),
      );
    });

    it('throws error when server returns no file URL', async () => {
      const file = new File(['image-bytes'], 'banner.png', { type: 'image/png' });
      (websiteProjectApi.uploadImage as jest.Mock).mockResolvedValueOnce({
        data: { data: {} },
      });

      await expect(uploadWebsiteImage({ file })).rejects.toThrow(
        /Upload succeeded but server did not return a valid file URL/,
      );
    });
  });

  describe('safeUploadWebsiteImage', () => {
    it('returns url and null error on success', async () => {
      const file = new File(['image-bytes'], 'banner.png', { type: 'image/png' });
      const mockUrl = 'https://bucket.s3.region.amazonaws.com/website/projects/123-abc.png';

      (websiteProjectApi.uploadImage as jest.Mock).mockResolvedValueOnce({
        data: { data: { fileUrl: mockUrl } },
      });

      const result = await safeUploadWebsiteImage({ file });
      expect(result).toEqual({ url: mockUrl, error: null });
    });

    it('catches and returns error message on upload failure or cancellation', async () => {
      const file = new File(['image-bytes'], 'banner.png', { type: 'image/png' });

      (websiteProjectApi.uploadImage as jest.Mock).mockRejectedValueOnce({
        response: {
          data: {
            message: 'File extension is incompatible with detected format.',
          },
        },
      });

      const result = await safeUploadWebsiteImage({ file });
      expect(result).toEqual({
        url: null,
        error: 'File extension is incompatible with detected format.',
      });
    });
  });

  describe('Axios instance FormData serialization and Content-Type boundary', () => {
    it('deletes default application/json and allows Axios/browser to generate multipart boundary', () => {
      // Unmock api module to test the actual Axios instance interceptors
      const actualApiModule = jest.requireActual('../lib/api');
      const realApiInstance = actualApiModule.default;
      expect(realApiInstance).toBeDefined();

      const config: any = {
        data: new FormData(),
        headers: {
          'Content-Type': 'application/json',
          'other-header': 'test',
        },
      };

      // Find and invoke the FormData interceptor on the real Axios instance
      const handlers = realApiInstance.interceptors.request.handlers || [];
      for (const h of handlers) {
        if (typeof h.fulfilled === 'function') {
          h.fulfilled(config);
        }
      }

      // Content-Type should be removed so Axios can set multipart/form-data; boundary=...
      expect(config.headers['Content-Type']).toBeUndefined();
      expect(config.headers['content-type']).toBeUndefined();
      expect(config.headers['other-header']).toBe('test');
    });
  });
});
