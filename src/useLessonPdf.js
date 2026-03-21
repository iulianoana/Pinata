import { useState, useEffect, useCallback } from "react";
import { uploadLessonPdf, getLessonPdfUrl, deleteLessonPdf } from "./lib/api";
import { cachePdf, getCachedPdf, removeCachedPdf, isCached } from "./lib/pdf-cache";

export default function useLessonPdf(lessonId) {
  const [pdfInfo, setPdfInfo] = useState(null); // { name, size, isCached }
  const [isLoading, setIsLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(null); // null | 0-100

  const refresh = useCallback(async () => {
    if (!lessonId) { setPdfInfo(null); setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const data = await getLessonPdfUrl(lessonId);
      if (data) {
        const cached = await isCached(lessonId);
        setPdfInfo({ name: data.pdfName, size: data.pdfSize, isCached: cached });
      } else {
        setPdfInfo(null);
      }
    } catch {
      // Offline: check if we have a cached PDF blob
      const cached = await isCached(lessonId);
      if (cached) {
        setPdfInfo({ name: "Cached PDF", size: null, isCached: true });
      } else {
        setPdfInfo(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [lessonId]);

  useEffect(() => { refresh(); }, [refresh]);

  const uploadPdf = useCallback(async (file) => {
    setUploadProgress(0);
    try {
      const lesson = await uploadLessonPdf(lessonId, file, setUploadProgress);
      setPdfInfo({ name: lesson.pdf_name, size: lesson.pdf_size, isCached: false });
    } finally {
      setUploadProgress(null);
    }
  }, [lessonId]);

  const viewPdf = useCallback(async () => {
    // Try cache first
    let blob = await getCachedPdf(lessonId);
    if (!blob) {
      const data = await getLessonPdfUrl(lessonId);
      if (!data) return;
      const res = await fetch(data.url);
      blob = await res.blob();
      await cachePdf(lessonId, blob);
      setPdfInfo((prev) => prev ? { ...prev, isCached: true } : prev);
    }
    return blob;
  }, [lessonId]);

  const deletePdf = useCallback(async () => {
    await deleteLessonPdf(lessonId);
    await removeCachedPdf(lessonId);
    setPdfInfo(null);
  }, [lessonId]);

  return { pdfInfo, isLoading, uploadProgress, uploadPdf, viewPdf, deletePdf, refresh };
}
