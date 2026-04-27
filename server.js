import express from "express";
import dotenv from "dotenv";
import Airtable from "airtable";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

const services = {
  oil: { name: "Oil Change", price: 80, category: "oil change" },
  tires: { name: "Tire Set", price: 400, category: "tires" },
  repair: { name: "Repair", price: 100, category: "repair" },
};

const expenses = {
  parts: { name: "Parts", price: 50, category: "parts" },
  supplier: { name: "Supplier", price: 200, category: "supplier" },
  misc: { name: "Misc", price: 20, category: "misc" },
};

async function getTodayData() {
  const records = await base("Transactions").select().all();
  const today = new Date().toISOString().slice(0, 10);

  let income = 0;
  let expensesTotal = 0;
  let cash = 0;
  let card = 0;
  const categories = {};

  records.forEach((record) => {
    const f = record.fields;
    if (!f.createdAt || !f.createdAt.startsWith(today)) return;

    const amount = Number(f.amount || 0);
    const category = f.category || "unknown";

    if (f.type === "income") {
      income += amount;
      categories[category] = (categories[category] || 0) + amount;

      if (f.paymentType === "cash") cash += amount;
      if (f.paymentType === "card") card += amount;
    }

    if (f.type === "expense") {
      expensesTotal += amount;
    }
  });

  const profit = income - expensesTotal;
  const topCategory =
    Object.entries(categories).sort((a, b) => b[1] - a[1])[0] || null;

  let insight = "Neo: Start logging transactions to see insights.";

  if (income > 0) {
    insight = `Neo: Profit is €${profit}. Top service today: ${
      topCategory ? topCategory[0] : "none"
    }.`;
  }

  if (expensesTotal > income && income > 0) {
    insight = `Neo: Warning — expenses are higher than income today.`;
  }

  if (profit > 0 && card > cash) {
    insight = `Neo: Good day so far. Profit is €${profit}, and most payments are by card.`;
  }

  if (profit > 0 && cash > card) {
    insight = `Neo: Good day so far. Profit is €${profit}, with more cash than card payments.`;
  }

  const prediction = income > 0 ? Math.round(income * 1.25) : 0;

  return {
    income,
    expenses: expensesTotal,
    profit,
    cash,
    card,
    topCategory,
    insight,
    prediction,
  };
}

app.get("/", async (req, res) => {
  const data = await getTodayData();

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Neo POS</title>
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f4f6f8;
      color: #111;
    }

    .container {
      max-width: 1000px;
      margin: auto;
      padding: 20px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }

    .brand {
      font-size: 34px;
      font-weight: bold;
    }

    .status {
      background: #e6f4ea;
      padding: 8px 14px;
      border-radius: 999px;
      font-weight: bold;
    }

    .neo {
      background: #111;
      color: white;
      padding: 20px;
      border-radius: 18px;
      margin-bottom: 20px;
      font-size: 18px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
    }

    .card {
      background: white;
      padding: 20px;
      border-radius: 18px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .label {
      color: #666;
      font-size: 14px;
    }

    .value {
      font-size: 30px;
      font-weight: bold;
      margin-top: 8px;
    }

    h2 {
      margin-top: 28px;
    }

    .item {
      background: white;
      padding: 20px;
      border-radius: 18px;
      margin-bottom: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .item-title {
      font-size: 24px;
      font-weight: bold;
    }

    .price {
      color: #666;
      margin: 6px 0 12px;
    }

    .btn-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    button {
      padding: 18px;
      font-size: 20px;
      font-weight: bold;
      border: none;
      border-radius: 14px;
      background: #111;
      color: white;
      cursor: pointer;
    }

    .expense-btn {
      background: #7a1f1f;
    }

    .chat {
      background: white;
      padding: 20px;
      border-radius: 18px;
      margin-top: 28px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    input {
      width: 100%;
      box-sizing: border-box;
      padding: 16px;
      font-size: 18px;
      border-radius: 12px;
      border: 1px solid #ccc;
      margin-bottom: 10px;
    }

    #answer {
      margin-top: 14px;
      font-size: 18px;
      white-space: pre-wrap;
    }

    .payment-screen {
      position: fixed;
      inset: 0;
      background: white;
      display: none;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 20px;
      z-index: 10;
    }

    .pay-btn {
      width: 70%;
      max-width: 400px;
      padding: 34px;
      font-size: 30px;
      border-radius: 20px;
    }

    .cash { background: #2e7d32; }
    .cardb { background: #1565c0; }

    @media (max-width: 700px) {
      .grid {
        grid-template-columns: 1fr;
      }

      .btn-row {
        grid-template-columns: 1fr;
      }

      .brand {
        font-size: 28px;
      }
    }
  </style>
</head>

<body>
  <div class="container">
    <div class="header">
      <div class="brand">Neo POS</div>
      <div class="status">Online</div>
    </div>

    <div class="neo">
      ${data.insight}<br>
      Estimated end-of-day income: €${data.prediction}
    </div>

    <div class="grid">
      <div class="card">
        <div class="label">Income</div>
        <div class="value">€${data.income}</div>
      </div>
      <div class="card">
        <div class="label">Expenses</div>
        <div class="value">€${data.expenses}</div>
      </div>
      <div class="card">
        <div class="label">Profit</div>
        <div class="value">€${data.profit}</div>
      </div>
      <div class="card">
        <div class="label">Cash</div>
        <div class="value">€${data.cash}</div>
      </div>
      <div class="card">
        <div class="label">Card</div>
        <div class="value">€${data.card}</div>
      </div>
      <div class="card">
        <div class="label">Top Service</div>
        <div class="value">${data.topCategory ? data.topCategory[0] : "-"}</div>
      </div>
    </div>

    <h2>Income</h2>

    ${Object.entries(services).map(([key, s]) => `
      <div class="item">
        <div class="item-title">${s.name}</div>
        <div class="price">€${s.price}</div>
        <div class="btn-row">
          <button onclick="choose('${key}', 1)">+1</button>
          <button onclick="choose('${key}', 2)">+2</button>
          <button onclick="choose('${key}', 4)">+4</button>
        </div>
      </div>
    `).join("")}

    <h2>Expenses</h2>

    ${Object.entries(expenses).map(([key, e]) => `
      <div class="item">
        <div class="item-title">${e.name}</div>
        <div class="price">€${e.price}</div>
        <div class="btn-row">
          <button class="expense-btn" onclick="expense('${key}', 1)">+1</button>
          <button class="expense-btn" onclick="expense('${key}', 2)">+2</button>
          <button class="expense-btn" onclick="expense('${key}', 4)">+4</button>
        </div>
      </div>
    `).join("")}

    <div class="chat">
      <h2>Ask Neo</h2>
      <input id="question" placeholder="Example: How is business today?" />
      <button onclick="askNeo()">Ask Neo</button>
      <div id="answer"></div>
    </div>
  </div>

  <div id="pay" class="payment-screen">
    <button class="pay-btn cash" onclick="sendIncome('cash')">CASH</button>
    <button class="pay-btn cardb" onclick="sendIncome('card')">CARD</button>
    <button class="pay-btn" onclick="cancelPayment()">CANCEL</button>
  </div>

  <script>
    let currentService = null;
    let currentQuantity = 1;

    function choose(service, quantity) {
      currentService = service;
      currentQuantity = quantity;
      document.getElementById("pay").style.display = "flex";
    }

    function cancelPayment() {
      document.getElementById("pay").style.display = "none";
    }

    function sendIncome(paymentType) {
      fetch("/log-income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: currentService,
          quantity: currentQuantity,
          paymentType
        })
      }).then(() => location.reload());
    }

    function expense(expense, quantity) {
      fetch("/log-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expense, quantity })
      }).then(() => location.reload());
    }

    function askNeo() {
      const question = document.getElementById("question").value;
      const answer = document.getElementById("answer");
      answer.innerText = "Neo is thinking...";

      fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      })
      .then(res => res.text())
      .then(text => {
        answer.innerText = text;
      });
    }
  </script>
</body>
</html>
  `);
});

app.post("/ask", async (req, res) => {
  try {
    const data = await getTodayData();
    const question = req.body.question || "";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are Neo, an AI business assistant for a small tire/garage shop.

Today:
Income: €${data.income}
Expenses: €${data.expenses}
Profit: €${data.profit}
Cash: €${data.cash}
Card: €${data.card}
Top service: ${data.topCategory ? data.topCategory[0] : "none"}
Estimated end-of-day income: €${data.prediction}

Your style:
- short
- direct
- practical
- business-focused
- give advice when useful
          `,
        },
        {
          role: "user",
          content: question,
        },
      ],
    });

    res.send(response.choices[0].message.content);
  } catch (error) {
    console.log("Neo error:", error);
    res.status(500).send("Neo had trouble answering.");
  }
});

app.post("/log-income", async (req, res) => {
  try {
    const service = services[req.body.service];
    const quantity = Number(req.body.quantity || 1);
    const paymentType = req.body.paymentType || "unknown";

    if (!service) return res.status(400).send("Unknown service");
    if (!quantity || quantity <= 0) return res.status(400).send("Invalid quantity");

    const total = service.price * quantity;

    await base("Transactions").create([
      {
        fields: {
          amount: total,
          type: "income",
          category: service.category,
          paymentType,
          person: "",
          createdAt: new Date().toISOString(),
        },
      },
    ]);

    res.send("ok");
  } catch (error) {
    console.log("Income error:", error);
    res.status(500).send("Could not save income.");
  }
});

app.post("/log-expense", async (req, res) => {
  try {
    const expense = expenses[req.body.expense];
    const quantity = Number(req.body.quantity || 1);

    if (!expense) return res.status(400).send("Unknown expense");
    if (!quantity || quantity <= 0) return res.status(400).send("Invalid quantity");

    const total = expense.price * quantity;

    await base("Transactions").create([
      {
        fields: {
          amount: total,
          type: "expense",
          category: expense.category,
          paymentType: "expense",
          person: "",
          createdAt: new Date().toISOString(),
        },
      },
    ]);

    res.send("ok");
  } catch (error) {
    console.log("Expense error:", error);
    res.status(500).send("Could not save expense.");
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Neo POS running on http://localhost:3000");
});