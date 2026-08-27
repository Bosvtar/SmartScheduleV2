import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Support JSON payload up to 20MB for image base64
  app.use(express.json({ limit: "20mb" }));

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Server-side Gemini schedule extraction endpoint
  app.post("/api/extract-schedule", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY chưa được thiết lập trên server. Vui lòng cấu hình trong Settings > Secrets.",
        });
      }

      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Thiếu dữ liệu hình ảnh (imageBase64)." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const prompt = `
        Hãy phân tích hình ảnh này để trích xuất thời khóa biểu / lịch học / lịch dạy / lịch thi.

        CHÚ Ý CẤU TRÚC VĂN BẢN VÀ THÔNG TIN QUAN TRỌNG:
        Thường có dạng "Nhãn: Giá trị" (ở đầu trang hoặc góc trang) kết hợp với bảng danh sách buổi học.

        1. Tên môn học (subject): 
           - Tìm từ khóa: "MÔN:", "MÔN HỌC:", "HỌC PHẦN:", "TÊN HP:", "TÊN MÔN:", hoặc cột Tên môn.
           - Ví dụ: "MÔN: Lý thuyết điều khiển tự động" -> subject: "Lý thuyết điều khiển tự động".
           
        2. Tên lớp (className): 
           - Tìm ở tiêu đề / góc trang hoặc cột trong bảng: "LỚP:", "LỚP HỌC:", "LỚP HP:", "MÃ LỚP:".
           - Chú ý: Có thể gồm nhiều lớp ghép (ví dụ như trong ảnh: "LỚP: KMP18, KNP27, KPT31" hoặc "KNP26, KNP27"). Hãy lấy đầy đủ danh sách lớp này làm className: "KMP18, KNP27, KPT31".
           
        3. Thứ trong tuần (dayOfWeek): "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật".
        
        4. Ngày tháng cụ thể & Năm học (date): 
           - Định dạng đầu ra: "DD/MM/YYYY" (ví dụ: "25/08/2026", "10/09/2026").
           - NĂM HỌC HIỆN TẠI LÀ NĂM 2026 (hoặc năm học 2026-2027 như trong ảnh "NĂM HỌC: 2026-2027").
           - Nếu trong bảng hoặc tài liệu chỉ ghi ngày/tháng (ví dụ: "25/08", "02/09", "15/10", "ngày 25 tháng 8"), PHẢI tự động gán năm 2026 (hoặc 2027 tùy theo học kỳ năm học 2026-2027). TUYỆT ĐỐI KHÔNG gán năm cũ như 2024 hay 2025.
           - Nếu là lịch định kỳ hàng tuần không có ngày tháng cụ thể nào, để date là rỗng "".
           
        6. Địa điểm / Phòng học (location):
           - Tìm thông tin phòng học, giảng đường, tòa nhà.
           - ĐẶC BIỆT CHÚ Ý ĐỊNH DẠNG: Các ký hiệu dạng "SốPhòng/TòaNhà" (ví dụ: "210/H10", "302/D3", "105/A1", "H10-210", "P.201", "GD3", "Online") CHÍNH LÀ ĐỊA ĐIỂM / PHÒNG HỌC (location = "210/H10").
           - TUYỆT ĐỐI KHÔNG nhầm phòng học ("210/H10") thành tên lớp hay môn học.
           - Nếu không có thông tin phòng, để "Chưa cập nhật".

        7. Tên bài / Nội dung bài học (lessonName):
           - QUY TẮC BẮT BUỘC: Lấy số ở cột "Bài số" (hoặc "Bài", "Số bài", "STT bài") kết hợp với tên/văn bản ở cột "Nội dung" (hoặc "Nội dung giảng dạy", "Tên bài").
           - Định dạng: "Bài <số>: <Nội dung>".
           - Ví dụ:
             + Cột Bài số: "1", Cột Nội dung: "Khái niệm mở đầu về ĐKTĐ" -> lessonName: "Bài 1: Khái niệm mở đầu về ĐKTĐ"
             + Cột Bài số: "2", Cột Nội dung: "Mô tả toán học hệ thống liên tục" -> lessonName: "Bài 2: Mô tả toán học hệ thống liên tục"
             + Cột Bài số: "Bài 3", Cột Nội dung: "Hàm truyền đạt" -> lessonName: "Bài 3: Hàm truyền đạt"
           - Nếu không có cột Bài số, lấy trực tiếp nội dung ở cột Nội dung làm lessonName.

        8. Tiết học (period):
           - Lấy chính xác giá trị ở cột "Tiết" hoặc "Số tiết" (Ví dụ: "1-1", "1-2", "3-4", "4-4", "5-5", "6-6", "6-7", "6-8", "7-8", "8-8", "4", "5", v.v.).

        9. Giờ học (startTime, endTime):
           - Định dạng 24h (HH:mm) ví dụ: "07:00", "07:45", "14:00".
           - BẢNG QUY ĐỔI TIẾT HỌC CHÍNH XÁC (BẮT BUỘC TUÂN THỦ KHI BẢNG GHI THEO TIẾT):
             + Tiết 1: 07:00 đến 07:45 (07:00 - 07:45)
             + Tiết 2: 07:50 đến 08:35 (07:50 - 08:35)
             + Tiết 3: 08:45 đến 09:30 (08:45 - 09:30) [LƯU Ý: Bắt đầu 08:45, kết thúc 09:30 - Tuyệt đối không dùng 08:35 hay 09:20]
             + Tiết 4: 09:35 đến 10:20 (09:35 - 10:20) [LƯU Ý: Bắt đầu 09:35, kết thúc 10:20 - Tuyệt đối không dùng 09:20 hay 10:05]
             + Tiết 5: 10:30 đến 11:15 (10:30 - 11:15) [LƯU Ý: Bắt đầu 10:30, kết thúc 11:15 - Tuyệt đối không dùng 10:10 hay 10:55]
             + Tiết 6: 14:00 đến 14:45 (14:00 - 14:45)
             + Tiết 7: 14:50 đến 15:35 (14:50 - 15:35)
             + Tiết 8: 15:45 đến 16:30 (15:45 - 16:30)
             
           - QUY TẮC GHÉP TIẾT (startTime là giờ bắt đầu của tiết đầu, endTime là giờ kết thúc của tiết cuối):
             + Tiết 1-1: 07:00 - 07:45
             + Tiết 1-2: 07:00 - 08:35
             + Tiết 1-3: 07:00 - 09:30
             + Tiết 1-4: 07:00 - 10:20
             + Tiết 1-5: 07:00 - 11:15
             + Tiết 2-2: 07:50 - 08:35
             + Tiết 2-3: 07:50 - 09:30
             + Tiết 2-4: 07:50 - 10:20
             + Tiết 3-3: 08:45 - 09:30
             + Tiết 3-4: 08:45 - 10:20
             + Tiết 3-5: 08:45 - 11:15
             + Tiết 4-4: 09:35 - 10:20
             + Tiết 4-5: 09:35 - 11:15
             + Tiết 5-5: 10:30 - 11:15
             + Tiết 6-6: 14:00 - 14:45
             + Tiết 6-7: 14:00 - 15:35
             + Tiết 6-8: 14:00 - 16:30
             + Tiết 7-7: 14:50 - 15:35
             + Tiết 7-8: 14:50 - 16:30
             + Tiết 8-8: 15:45 - 16:30
           - Nếu trong ảnh có ghi rõ giờ cụ thể khác, ưu tiên giờ trong ảnh. Tuy nhiên với các tiết học 1 đến 8, luôn luôn tính toán theo đúng bảng trên.

        LOGIC XỬ LÝ HEADER/TIÊU ĐỀ VÀ ĐỒNG BỘ THEO ĐỊA ĐIỂM:
        - QUY TẮC ĐỒNG BỘ LỚP HỌC THEO ĐỊA ĐIỂM:
          + Những buổi học có cùng địa điểm học (location) thì thuộc CÙNG 1 LỚP HỌC.
          + Nếu ảnh tải lên không có phần ghi rõ tên lớp ở từng dòng: Tất cả các buổi có địa điểm là "210/H10" thì cùng 1 lớp (lấy tên lớp đầu tiên "KMP18, KNP27, KPT31"), các buổi có địa điểm là "203/H10" thì cùng 1 lớp và lấy tên lớp xuất hiện đầu tiên tương ứng.
          + Tương tự với bất kỳ phòng học nào: Các buổi cùng phòng học luôn có cùng 1 tên lớp.
        - Nếu Tên Môn học, Tên Lớp (ví dụ "KMP18, KNP27, KPT31"), hoặc Địa điểm (ví dụ "210/H10") nằm ở phần đầu trang/tiêu đề và bên dưới là danh sách các buổi học/ngày học theo hàng hoặc cột, hãy sao chép Tên Môn, Tên Lớp và Địa điểm đó vào tất cả các buổi học tương ứng trong danh sách kết quả trả về.
        - TUYỆT ĐỐI KHÔNG sao chép Tên bài / Nội dung học (lessonName) từ buổi này sang buổi khác hoặc từ hàng này sang hàng khác. Mỗi buổi học / hàng trong bảng có Bài số và Nội dung riêng của buổi đó (ví dụ: ngày 04/08: Bài 1, ngày 11/08: Bài 2 hoặc phần tiếp theo, ngày 18/08: Bài 3,...).

        KHỚP THỨ VÀ NGÀY THÁNG:
        - Thứ trong tuần (dayOfWeek) PHẢI khớp chính xác với ngày tháng (date):
          + Ví dụ: Ngày 04/08/2026 là Thứ 3, Ngày 11/08/2026 là Thứ 3, Ngày 12/08/2026 là Thứ 4, Ngày 18/08/2026 là Thứ 3, Ngày 19/08/2026 là Thứ 4.

        CHỐNG TRÙNG LẶP (DUPLICATES):
        - Mỗi buổi học / ngày học và mỗi tiết học (ví dụ: ngày 04/08/2026 tiết 4-4) chỉ được xuất hiện DUY NHẤT 1 lần trong mảng kết quả JSON trả về.
        - TUYỆT ĐỐI KHÔNG tạo 2 đối tượng cho cùng 1 ngày và cùng 1 tiết học.

        Trả về danh sách các buổi học dưới dạng mảng JSON.
      `;

      const candidateModels = [
        "gemini-2.5-flash",
        "gemini-3.7-flash",
        "gemini-2.5-pro",
      ];

      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType || "image/png",
        },
      };

      let lastError: any = null;
      let parsed: any[] | null = null;

      for (const modelName of candidateModels) {
        // Try each model with up to 2 attempts
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            console.log(`Attempting schedule extraction with model: ${modelName} (attempt ${attempt})`);
            const response = await ai.models.generateContent({
              model: modelName,
              contents: {
                parts: [imagePart, { text: prompt }],
              },
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      subject: { type: Type.STRING, description: "Tên môn học" },
                      lessonName: { type: Type.STRING, description: "Tên bài: Bài <số>: <Nội dung>" },
                      period: { type: Type.STRING, description: "Tiết học (VD: 1-1, 1-2, 4-4, 5-5, 6-8,...)" },
                      className: { type: Type.STRING, description: "Tên lớp hoặc mã lớp" },
                      dayOfWeek: { type: Type.STRING, description: "Thứ trong tuần (VD: Thứ 2, Thứ 3,...)" },
                      date: { type: Type.STRING, description: "Định dạng DD/MM/YYYY nếu có" },
                      startTime: { type: Type.STRING, description: "Giờ bắt đầu dạng HH:mm" },
                      endTime: { type: Type.STRING, description: "Giờ kết thúc dạng HH:mm" },
                      location: { type: Type.STRING, description: "Phòng học hoặc địa điểm" },
                    },
                    required: ["subject", "dayOfWeek", "startTime", "endTime"],
                  },
                },
              },
            });

            const rawText = response.text ? response.text.trim() : "[]";
            // Clean possible markdown code fence
            const cleanedText = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
            const rawParsed = JSON.parse(cleanedText || "[]");
            
            // Server-side normalization for room vs class and location-based propagation
            if (Array.isArray(rawParsed)) {
              const locationToClassMap = new Map<string, string>();
              locationToClassMap.set('210/h10', 'KMP18, KNP27, KPT31');

              const isRoom = (str?: string) => {
                if (!str) return false;
                const s = str.trim();
                return /^\d{2,4}\/[A-Z0-9]+$/i.test(s) || /^P\.?\s*\d+/i.test(s);
              };

              // First pass: map valid class names to locations
              for (const item of rawParsed) {
                let cls = (item.className || '').trim();
                let loc = (item.location || '').trim();

                if (isRoom(cls)) {
                  if (!loc || loc === 'Chưa cập nhật') loc = cls;
                  cls = '';
                }

                if (loc && loc !== 'Chưa cập nhật') {
                  const locKey = loc.toLowerCase();
                  if (!locationToClassMap.has(locKey) && cls && !isRoom(cls)) {
                    locationToClassMap.set(locKey, cls);
                  }
                }
              }

              // Second pass: apply to all items
              parsed = rawParsed.map((item: any) => {
                let cls = (item.className || '').trim();
                let loc = (item.location || '').trim();

                if (isRoom(cls)) {
                  if (!loc || loc === 'Chưa cập nhật') loc = cls;
                  cls = '';
                }

                if (loc && loc !== 'Chưa cập nhật') {
                  const locKey = loc.toLowerCase();
                  const mapped = locationToClassMap.get(locKey);
                  if (mapped) {
                    cls = mapped;
                  } else if (!cls) {
                    cls = `Lớp ${loc}`;
                    locationToClassMap.set(locKey, cls);
                  }
                }

                return {
                  ...item,
                  className: cls || (loc ? `Lớp ${loc}` : 'KMP18, KNP27, KPT31'),
                  location: loc || 'Chưa cập nhật',
                };
              });
            } else {
              parsed = [];
            }
            break; // Success, break out of attempt loop
          } catch (err: any) {
            lastError = err;
            console.warn(`Model ${modelName} attempt ${attempt} failed:`, err?.message || err);
            const isRetryable =
              err?.status === "UNAVAILABLE" ||
              err?.message?.includes("503") ||
              err?.message?.includes("429") ||
              err?.message?.includes("RESOURCE_EXHAUSTED") ||
              err?.message?.includes("high demand");

            if (isRetryable && attempt < 2) {
              // Wait 1.2s before retry
              await new Promise((res) => setTimeout(res, 1200));
            } else {
              // Switch to next candidate model
              break;
            }
          }
        }

        if (parsed !== null) {
          break; // Successfully got parsed result
        }
      }

      if (parsed === null) {
        throw lastError || new Error("Không thể kết nối đến Gemini AI lúc này.");
      }

      return res.json({ success: true, data: parsed });
    } catch (error: any) {
      console.error("Server Gemini extraction error:", error);
      const message = error?.message || "Lỗi khi xử lý hình ảnh với Gemini AI";
      return res.status(500).json({ error: message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
