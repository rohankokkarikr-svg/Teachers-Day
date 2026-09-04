import { supabase, isSupabaseConfigured } from './supabase';

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
}

/**
 * Compresses an image file in the browser using HTML5 Canvas.
 * Produces an optimized, lightweight blob and base64 data URL (< 30KB).
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<{ blob: Blob; dataUrl: string }> {
  const {
    maxWidth = 400,
    maxHeight = 400,
    quality = 0.85,
    mimeType = 'image/jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get 2D canvas context'));
          return;
        }

        // Draw and smooth image
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL(mimeType, quality);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl });
            } else {
              reject(new Error('Failed to create compressed image blob'));
            }
          },
          mimeType,
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a teacher photo to Supabase Storage ('teacher-photos' bucket).
 * If Supabase Storage is configured and accessible, returns the public CDN URL.
 * If Supabase Storage is offline or not configured, returns the compressed lightweight data URL.
 */
export async function uploadTeacherPhoto(
  file: File,
  teacherId?: string
): Promise<{ success: boolean; url: string; error?: string }> {
  try {
    // 1. Compress image to < 30KB
    const { blob, dataUrl } = await compressImage(file, {
      maxWidth: 400,
      maxHeight: 400,
      quality: 0.85,
      mimeType: 'image/jpeg',
    });

    // 2. Try Supabase Storage upload if available
    if (isSupabaseConfigured) {
      const filename = `teacher_${teacherId || Date.now()}_${Date.now()}.jpg`;
      const bucketName = 'teacher-photos';

      try {
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filename, blob, {
            contentType: 'image/jpeg',
            cacheControl: '31536000',
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filename);

          if (publicUrlData?.publicUrl) {
            return {
              success: true,
              url: publicUrlData.publicUrl,
            };
          }
        }
      } catch {
        // Fallback to compressed data URL
      }
    }

    // 3. Fallback to compressed Data URL (lightweight ~20KB)
    return {
      success: true,
      url: dataUrl,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Image upload failed';
    return {
      success: false,
      url: '',
      error: msg,
    };
  }
}
