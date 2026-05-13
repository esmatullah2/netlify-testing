import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { sql, eq, and } from "drizzle-orm";
import { db } from "../drizzle/db/connections.js";
import {
  users,
  categories,
  paymentMethods,
  clientsVendors,
  contracts,
  transactions,
  userWallets,
  debts,
  fundTransfers,
} from "../drizzle/db/schema.js";

import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 MIDDLEWARES
const authJWT = (req, res, next) => {
  try {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: "No token" });
    const decoded = jwt.verify(token, "mysupersecretkey");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== "Admin" && req.user.role !== "admin") {
    return res.status(403).json({ error: "Admins only" });
  }
  next();
};

// 🔐 AUTH APIs
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!password) return res.status(400).json({ error: "پاسورډ اړین دی!" });
    const hash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash: hash,
        role: role || "User",
      })
      .returning();
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.select().from(users).where(eq(users.email, email));
    if (user.length === 0)
      return res.status(400).json({ error: "User not found" });

    const foundUser = user[0];
    const isMatch = await bcrypt.compare(password, foundUser.passwordHash);
    if (!isMatch) return res.status(400).json({ error: "Wrong password" });

    const token = jwt.sign(
      { id: foundUser.id, role: foundUser.role },
      "mysupersecretkey",
      { expiresIn: "1d" },
    );
    res.json({
      token,
      user: { id: foundUser.id, name: foundUser.name, role: foundUser.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/me", authJWT, async (req, res) => {
  const user = await db.select().from(users).where(eq(users.id, req.user.id));
  res.json(user[0]);
});

// ==========================================
// 💸 FUND TRANSFERS (د پیسو استول)
// ==========================================
app.get("/api/transfers", authJWT, async (req, res) => {
  try {
    if (req.user.role === "Admin" || req.user.role === "admin") {
      res.json(await db.select().from(fundTransfers));
    } else {
      res.json(
        await db
          .select()
          .from(fundTransfers)
          .where(eq(fundTransfers.employeeId, req.user.id)),
      );
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/transfers", authJWT, requireAdmin, async (req, res) => {
  try {
    const { employeeId, amount, currency, rate, deductedAfn, description } =
      req.body;

    const [newTransfer] = await db
      .insert(fundTransfers)
      .values({
        adminId: req.user.id,
        employeeId: Number(employeeId),
        amount: String(amount),
        currency: currency || "AFN",
        rate: String(rate || 1),
        deductedAfn: String(deductedAfn || amount), // 🌟 څومره افغانۍ کمې شوې؟
        description,
      })
      .returning();

    res.json(newTransfer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 👤 USERS MANAGEMENT
app.get("/api/users", authJWT, requireAdmin, async (req, res) => {
  const data = await db.select().from(users);
  res.json(data);
});

app.post("/api/users", authJWT, requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash: hash,
        role: role || "User",
        permissions: {},
      })
      .returning();
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/users/:id", authJWT, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, password, role } = req.body;
    const updateData = { name, email, role };
    if (password && password.trim() !== "")
      updateData.passwordHash = await bcrypt.hash(password, 10);
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/users/:id", authJWT, requireAdmin, async (req, res) => {
  try {
    if (req.params.id == 1)
      return res.status(403).json({ error: "اصلي اډمین نشي ړنګېدلی!" });
    await db.delete(users).where(eq(users.id, req.params.id));
    res.json({ message: "کارمند ړنګ شو!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put(
  "/api/users/:id/permissions",
  authJWT,
  requireAdmin,
  async (req, res) => {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({ permissions: req.body.permissions })
        .where(eq(users.id, req.params.id))
        .returning();
      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// 📂 SETTINGS
app.get("/api/categories", authJWT, async (req, res) => {
  res.json(await db.select().from(categories));
});
app.post("/api/categories", authJWT, async (req, res) => {
  const [n] = await db.insert(categories).values(req.body).returning();
  res.status(201).json(n);
});
app.get("/api/payment-methods", authJWT, async (req, res) => {
  res.json(await db.select().from(paymentMethods));
});
app.post("/api/payment-methods", authJWT, async (req, res) => {
  const [n] = await db.insert(paymentMethods).values(req.body).returning();
  res.status(201).json(n);
});

// 📝 CONTRACTS
app.get("/api/contracts", authJWT, async (req, res) => {
  try {
    let data;
    if (req.user.role === "Admin" || req.user.role === "admin") {
      data = await db.select().from(contracts);
    } else {
      data = await db
        .select()
        .from(contracts)
        .where(eq(contracts.userId, req.user.id));
    }
    const today = new Date();
    const updatedData = data.map((c) => {
      if (c.endDate && c.status === "Active" && new Date(c.endDate) < today)
        return { ...c, status: "Expired", isExpired: true };
      return { ...c, isExpired: false };
    });
    res.json(updatedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/contracts", authJWT, async (req, res) => {
  try {
    const { clientVendorId, title, amount, startDate, endDate, status } =
      req.body;
    const [newContract] = await db
      .insert(contracts)
      .values({
        userId: req.user.id,
        clientId: Number(clientVendorId),
        title,
        totalValue: String(amount),
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : null,
        status,
      })
      .returning();
    res.status(201).json(newContract);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/contracts/:id", authJWT, requireAdmin, async (req, res) => {
  try {
    const { clientVendorId, title, amount, startDate, endDate, status } =
      req.body;
    const [u] = await db
      .update(contracts)
      .set({
        clientId: Number(clientVendorId),
        title,
        totalValue: String(amount),
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : null,
        status,
      })
      .where(eq(contracts.id, req.params.id))
      .returning();
    res.json(u);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/contracts/:id", authJWT, requireAdmin, async (req, res) => {
  try {
    await db.delete(contracts).where(eq(contracts.id, req.params.id));
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 👥 CLIENTS
app.get("/api/clients", authJWT, async (req, res) => {
  try {
    if (req.user.role === "Admin" || req.user.role === "admin")
      res.json(await db.select().from(clientsVendors));
    else
      res.json(
        await db
          .select()
          .from(clientsVendors)
          .where(eq(clientsVendors.userId, req.user.id)),
      );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/clients", authJWT, async (req, res) => {
  try {
    const [n] = await db
      .insert(clientsVendors)
      .values({ ...req.body, userId: req.user.id })
      .returning();
    res.status(201).json(n);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.put("/api/clients/:id", authJWT, async (req, res) => {
  try {
    const [u] = await db
      .update(clientsVendors)
      .set(req.body)
      .where(eq(clientsVendors.id, req.params.id))
      .returning();
    res.json(u);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.delete("/api/clients/:id", authJWT, async (req, res) => {
  try {
    await db.delete(clientsVendors).where(eq(clientsVendors.id, req.params.id));
    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 💰 TRANSACTIONS
app.get("/api/transactions", authJWT, async (req, res) => {
  const data = await db.select().from(transactions);
  if (req.user.role !== "Admin" && req.user.role !== "admin")
    return res.json(data.filter((t) => t.userId === req.user.id));
  res.json(data);
});

app.post("/api/transactions", authJWT, async (req, res) => {
  try {
    const { amount, currency, type, newClientName, newClientPhone } = req.body;
    let { clientVendorId } = req.body;
    const amt = parseFloat(amount);

    if (!clientVendorId && newClientName) {
      const [newClient] = await db
        .insert(clientsVendors)
        .values({
          userId: req.user.id,
          name: newClientName,
          phone: newClientPhone || "",
          type: "Customer",
        })
        .returning();
      clientVendorId = newClient.id;
    }

    const txData = {
      ...req.body,
      userId: req.user.id,
      clientVendorId: Number(clientVendorId),
    };
    delete txData.newClientName;
    delete txData.newClientPhone;

    const [newTrans] = await db.insert(transactions).values(txData).returning();
    res.json(newTrans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/transactions/:id", authJWT, requireAdmin, async (req, res) => {
  try {
    await db
      .delete(transactions)
      .where(eq(transactions.id, Number(req.params.id)));
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/transactions/:id", authJWT, requireAdmin, async (req, res) => {
  try {
    const {
      clientVendorId,
      categoryId,
      paymentMethodId,
      amount,
      currency,
      type,
      transactionDate,
      description,
    } = req.body;
    const [u] = await db
      .update(transactions)
      .set({
        clientVendorId: Number(clientVendorId),
        categoryId: Number(categoryId),
        paymentMethodId: Number(paymentMethodId),
        amount: String(amount),
        currency,
        type,
        description,
        transactionDate: new Date(transactionDate).toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(transactions.id, Number(req.params.id)))
      .returning();
    res.json(u);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// ==========================================
// 📊 DASHBOARD BALANCES (د حسابونو کلک بېلتون او منفي کېدل)
// ==========================================
app.get("/api/dashboard/balances", authJWT, async (req, res) => {
  try {
    const isAdmin = req.user.role === "Admin" || req.user.role === "admin";
    const balanceMap = {};

    const ensureCurrency = (curr) => {
      if (!balanceMap[curr])
        balanceMap[curr] = {
          currency: curr,
          totalIncome: 0,
          totalExpense: 0,
          netBalance: 0,
        };
    };

    if (isAdmin) {
      // 🌟 اډمین: یوازې د ځان (اډمین) معاملې ګوري
      const adminTx = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, req.user.id));
      adminTx.forEach((tr) => {
        ensureCurrency(tr.currency);
        const amt = Number(tr.amount) || 0;
        if (tr.type === "Income" || tr.type === "Capital") {
          balanceMap[tr.currency].totalIncome += amt;
          balanceMap[tr.currency].netBalance += amt;
        } else if (tr.type === "Expense") {
          balanceMap[tr.currency].totalExpense += amt;
          balanceMap[tr.currency].netBalance -= amt;
        }
      });

      // 🌟 اډمین: هغه پیسې چې کارمندانو ته یې لېږلي دي، د اډمین له افغانیو څخه منفي کیږي!
      const allTransfers = await db.select().from(fundTransfers);
      ensureCurrency("AFN");
      allTransfers.forEach((tf) => {
        const deducted = Number(tf.deductedAfn) || 0;
        balanceMap["AFN"].totalExpense += deducted;
        balanceMap["AFN"].netBalance -= deducted; // 👈 دلته ستاسو له اکاونټ پیسې منفي شوې
      });

      // 🌟 اډمین: خپل پورونه
      const myDebts = await db
        .select()
        .from(debts)
        .where(eq(debts.userId, req.user.id));
      myDebts.forEach((d) => {
        ensureCurrency(d.currency);
        const remain = (Number(d.amount) || 0) - (Number(d.paidAmount) || 0);
        if (d.type === "Receivable")
          balanceMap[d.currency].netBalance -= remain; // پیسې مو ورکړي (کمې شوې)
        else if (d.type === "Payable")
          balanceMap[d.currency].netBalance += remain; // پیسې مو اخیستي (زیاتې شوې)
      });
    } else {
      // 🌟 کارمند: یوازې خپلې معاملې ګوري (هېڅ بل کارمند نشي لیدلی)
      const myTx = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, req.user.id));
      const myTransfers = await db
        .select()
        .from(fundTransfers)
        .where(eq(fundTransfers.employeeId, req.user.id));

      // کارمند ته پیسې راغلې دي (خالصه پانګه یې زیاتیږي)
      myTransfers.forEach((tf) => {
        ensureCurrency(tf.currency);
        balanceMap[tf.currency].netBalance += Number(tf.amount);
        balanceMap[tf.currency].totalIncome += Number(tf.amount);
      });

      myTx.forEach((tr) => {
        ensureCurrency(tr.currency);
        const amt = Number(tr.amount) || 0;
        if (tr.type === "Income" || tr.type === "Capital") {
          balanceMap[tr.currency].totalIncome += amt;
          balanceMap[tr.currency].netBalance += amt;
        } else if (tr.type === "Expense") {
          balanceMap[tr.currency].totalExpense += amt;
          balanceMap[tr.currency].netBalance -= amt;
        }
      });

      // کارمند خپل پورونه ګوري
      const myDebts = await db
        .select()
        .from(debts)
        .where(eq(debts.userId, req.user.id));
      myDebts.forEach((d) => {
        ensureCurrency(d.currency);
        const remain = (Number(d.amount) || 0) - (Number(d.paidAmount) || 0);
        if (d.type === "Receivable")
          balanceMap[d.currency].netBalance -= remain;
        else if (d.type === "Payable")
          balanceMap[d.currency].netBalance += remain;
      });
    }

    res.json(Object.values(balanceMap));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// // // 📊 🌟 DASHBOARD BALANCES (د پورونو او پیسو لېږلو کلک حساب) 🌟
// // app.get("/api/dashboard/balances", authJWT, async (req, res) => {
// //   try {
// //     const isAdmin = req.user.role === "Admin" || req.user.role === "admin";
// //     const balanceMap = {};

// //     const ensureCurrency = (curr) => {
// //       if (!balanceMap[curr]) balanceMap[curr] = { currency: curr, totalIncome: 0, totalExpense: 0, netBalance: 0 };
// //     };

// //     // 1. Transactions
// //     let allTx = await db.select().from(transactions);
// //     if (!isAdmin) allTx = allTx.filter(t => t.userId === req.user.id);

// //     allTx.forEach(tr => {
// //       ensureCurrency(tr.currency);
// //       const amt = Number(tr.amount) || 0;
// //       if (tr.type === 'Income' || tr.type === 'Capital') {
// //         balanceMap[tr.currency].totalIncome += amt;
// //         balanceMap[tr.currency].netBalance += amt;
// //       } else if (tr.type === 'Expense') {
// //         balanceMap[tr.currency].totalExpense += amt;
// //         balanceMap[tr.currency].netBalance -= amt;
// //       }
// //     });

// //     // 2. Fund Transfers (اډمین پیسې ورکوي)
// //     let allTransfers = await db.select().from(fundTransfers);
// //     if (!isAdmin) allTransfers = allTransfers.filter(t => t.employeeId === req.user.id);

// //     allTransfers.forEach(tf => {
// //       ensureCurrency(tf.currency);
// //       const amt = Number(tf.amount) || 0;
// //       if (!isAdmin) {
// //         // کارمند ته پیسې راغلې دي (خالصه پانګه یې زیاتیږي)
// //         balanceMap[tf.currency].netBalance += amt;
// //         balanceMap[tf.currency].totalIncome += amt;
// //       }
// //     });

//     // 3. Debts (طلب او پور اتومات له بکس څخه کم/زیاتیږي)
//     let allDebts = await db.select().from(debts);
//     if (!isAdmin) allDebts = allDebts.filter(d => d.userId === req.user.id);

//     allDebts.forEach(d => {
//        ensureCurrency(d.currency);
//        const total = Number(d.amount) || 0;
//        const paid = Number(d.paidAmount) || 0;

//        if (d.type === 'Receivable') {
//           // د بل چا طلب راباندې دی (ما پیسې ورکړي): له بکس څخه کمېږي
//           balanceMap[d.currency].netBalance -= (total - paid);
//        } else if (d.type === 'Payable') {
//           // موږ د چا پوروړي یو (پیسې مو اخیستي): بکس ته اضافه کېږي
//           balanceMap[d.currency].netBalance += (total - paid);
//        }
//     });

//     res.json(Object.values(balanceMap));
//   } catch (error) { res.status(500).json({ error: error.message }); }
// });

// 📒 DEBTS
app.get("/api/debts", authJWT, async (req, res) => {
  try {
    if (req.user.role === "Admin" || req.user.role === "admin")
      res.json(await db.select().from(debts));
    else
      res.json(
        await db.select().from(debts).where(eq(debts.userId, req.user.id)),
      );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/debts", authJWT, async (req, res) => {
  try {
    const { clientId, amount, currency, type, dueDate, description, status } =
      req.body;
    const [newDebt] = await db
      .insert(debts)
      .values({
        userId: req.user.id,
        clientId: Number(clientId),
        amount: String(amount),
        currency: currency || "AFN",
        type,
        dueDate: dueDate ? new Date(dueDate) : null,
        description: description || "",
        status: status || "Pending",
      })
      .returning();
    res.status(201).json(newDebt);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/debts/:id/pay", authJWT, async (req, res) => {
  try {
    const targetDebt = await db
      .select()
      .from(debts)
      .where(eq(debts.id, Number(req.params.id)));
    if (targetDebt.length === 0)
      return res.status(404).json({ error: "پور پیدا نشو!" });

    const debt = targetDebt[0];
    const newPaidTotal =
      Number(debt.paidAmount || 0) + Number(req.body.payAmount);
    const newStatus = newPaidTotal >= Number(debt.amount) ? "Paid" : "Pending";

    const [u] = await db
      .update(debts)
      .set({
        paidAmount: String(newPaidTotal),
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(debts.id, debt.id))
      .returning();
    res.json(u);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🚀 START SERVER

export default app;
