import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

app.use(express.json());
app.use(express.static(__dirname));

const PROMPTS = {
  posts: (niche) =>
    `Ты — эксперт по контент-маркетингу. Придумай 5 свежих и конкретных идей для постов в соцсетях для эксперта${niche ? ` в нише «${niche}»` : ""}.
Каждая идея — одно предложение, практичная и готовая к публикации.
Ответь ТОЛЬКО валидным JSON без markdown: {"items":["идея1","идея2","идея3","идея4","идея5"]}`,

  stories: (niche) =>
    `Ты — эксперт по контент-маркетингу. Придумай 3 идеи для Instagram/Telegram Stories на сегодня${niche ? ` для эксперта в нише «${niche}»` : ""}.
Каждая идея — формат + краткое описание в одном предложении.
Ответь ТОЛЬКО валидным JSON без markdown: {"items":["идея1","идея2","идея3"]}`,

  week: (niche) =>
    `Ты — эксперт по контент-маркетингу. Составь контент-план на неделю (Понедельник–Воскресенье)${niche ? ` для эксперта в нише «${niche}»` : ""}.
Для каждого дня — одна конкретная идея публикации.
Ответь ТОЛЬКО валидным JSON без markdown:
{"items":[{"day":"Понедельник","text":"..."},{"day":"Вторник","text":"..."},{"day":"Среда","text":"..."},{"day":"Четверг","text":"..."},{"day":"Пятница","text":"..."},{"day":"Суббота","text":"..."},{"day":"Воскресенье","text":"..."}]}`,
};

function parseAIResponse(content) {
  const cleaned = content.replace(/```json\s*|\s*```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed.items || !Array.isArray(parsed.items)) {
    throw new Error("Неверный формат ответа AI");
  }
  return parsed.items;
}

app.post("/api/generate", async (req, res) => {
  const { type, niche = "" } = req.body;

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "API-ключ не настроен. Создайте файл .env и добавьте OPENAI_API_KEY",
    });
  }

  if (!PROMPTS[type]) {
    return res.status(400).json({ error: "Неизвестный тип генерации" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: "Ты помощник для создания контента. Отвечай только валидным JSON на русском языке.",
          },
          { role: "user", content: PROMPTS[type](niche.trim()) },
        ],
        temperature: 0.9,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = err.error?.message || `OpenAI API error: ${response.status}`;
      return res.status(response.status).json({ error: message });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({ error: "Пустой ответ от AI" });
    }

    const items = parseAIResponse(content);
    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message || "Ошибка при генерации идей",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn("⚠ OPENAI_API_KEY не найден — создайте файл .env");
  }
});
