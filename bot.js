import dotenv from "dotenv";
dotenv.config();

import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";
import Airtable from "airtable";

// INIT SERVICES
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
  polling: true,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

// DEBUG START
console.log("Bot is running...");
console.log("Airtable key loaded:", !!process.env.AIRTABLE_API_KEY);

const helpMessage = `Send me transactions like:
- 12 lunch
- 50 from John haircut
- paid 8 for coffee

Commands:
/today - show today's totals
/help - show this help`;

function parseAiResult(content) {
  try {
    return JSON.parse(content);
  } catch (error) {
    console.log("Invalid AI JSON:", content);
    return null;
  }
}

async function getTodayTotals() {
  const records = await base("Transactions").select().all();

  const today = new Date().toISOString().slice(0, 10);

  let todayIncome = 0;
  let todayExpenses = 0;

  records.forEach((record) => {
    const fields = record.fields;

    if (!fields.createdAt || !fields.createdAt.startsWith(today)) {
      return;
    }

    if (fields.type === "income") {
      todayIncome += Number(fields.amount || 0);
    }

    if (fields.type === "expense") {
      todayExpenses += Number(fields.amount || 0);
    }
  });

  return {
    income: todayIncome,
    expenses: todayExpenses,
    profit: todayIncome - todayExpenses,
  };
}

function formatTodayTotals(totals) {
  return (
    `Today:\n` +
    `Income: €${totals.income}\n` +
    `Expenses: €${totals.expenses}\n` +
    `Profit: €${totals.profit}`
  );
}

// MESSAGE HANDLER
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  console.log("Message received:", text);

  try {
    if (text === "/help") {
      await bot.sendMessage(chatId, helpMessage);
      return;
    }

    if (text === "/today") {
      const totals = await getTodayTotals();
      await bot.sendMessage(chatId, formatTodayTotals(totals));
      return;
    }

    // 1. AI PROCESSING
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a smart financial assistant.

Extract transaction data and respond.

Return ONLY valid JSON in this format:
{
  "amount": number,
  "type": "income" or "expense",
  "category": string,
  "person": string or null,
  "reply": string
}

Rules:
- If the user paid money, type is "expense".
- If the user received money, type is "income".
- Keep reply short and friendly.
          `,
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    const result = parseAiResult(response.choices[0].message.content);

    if (!result) {
      await bot.sendMessage(
        chatId,
        'I could not understand that as a transaction. Try: "12 lunch" or "50 from John haircut".'
      );
      return;
    }

    console.log("AI result:", result);

    // 2. SAVE TO AIRTABLE
    await base("Transactions").create([
      {
        fields: {
          amount: result.amount,
          type: result.type,
          category: result.category,
          person: result.person || "",
          createdAt: new Date().toISOString(),
        },
      },
    ]);

    console.log("Saved to Airtable");

    // 3. READ TODAY'S TRANSACTIONS FROM AIRTABLE
    const totals = await getTodayTotals();

    // 4. REPLY TO USER
    const finalReply = `${result.reply}\n\n` + formatTodayTotals(totals);

    await bot.sendMessage(chatId, finalReply);
  } catch (error) {
    console.log("ERROR:", error);
    await bot.sendMessage(chatId, "Something went wrong 😅");
  }
});
