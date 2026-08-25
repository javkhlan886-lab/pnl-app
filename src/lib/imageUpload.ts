// Сонгосон зургийг browser дээр нь багасгаж (урт тал ихдээ maxDim px),
// base64 data URI болгож хөрвүүлнэ — сервер рүү анхны хэмжээгээр нь
// (хэдэн MB) илгээхээс сэргийлнэ.
export function resizeImageToDataUrl(file: File, maxDim = 800, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Файл унших үед алдаа гарлаа."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Зургийг нээх үед алдаа гарлаа."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas дэмжигдэхгүй байна.")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
