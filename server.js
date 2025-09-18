import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import cors from "cors";
import fetch from "node-fetch";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// 🔹 Setup Brevo transporter
const transporter = nodemailer.createTransport({
  host: process.env.BREVO_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_PASS,
  },
});

transporter.verify((err, success) => {
  if (err) console.log("SMTP Error:", err);
  else console.log("SMTP Connected Successfully!");
});

// 🔹 JSONBin helpers
const BIN_URL = `https://api.jsonbin.io/v3/b/${process.env.BIN_ID}`;
const headers = {
  "X-Master-Key": process.env.JSONBIN_API_KEY,
  "X-Access-Key": process.env.JSONBIN_ACCESS_KEY,
  "Content-Type": "application/json",
};

const readRequests = async () => {
  const res = await fetch(BIN_URL, { headers });
  const data = await res.json();
  return data.record || [];
};

const writeRequests = async (requests) => {
  await fetch(BIN_URL, {
    method: "PUT",
    headers,
    body: JSON.stringify(requests),
  });
};

// 🔹 Visitor submits request
app.post("/request-resume", async (req, res) => {
  const { name, email } = req.body;
  const id = Date.now();
  const pendingRequests = await readRequests();
  pendingRequests.push({ id, name, email });
  await writeRequests(pendingRequests);

  const adminEmail = process.env.ADMIN_EMAIL;
  const acceptLink = `${process.env.BACKEND_URL}/accept/${id}`;
  const rejectLink = `${process.env.BACKEND_URL}/reject/${id}`;

  try {
    await transporter.sendMail({
      from: `"Sufiyan Khan" <${process.env.VERIFIED_EMAIL}>`,
      to: adminEmail,
      subject: `New Resume Request from ${name}`,
      html: `<p><b>Visitor Name:</b> ${name}</p>
             <p><b>Email:</b> ${email}</p>
             <p>To <b>ACCEPT</b> click: <a href="${acceptLink}">ACCEPT</a></p>
             <p>To <b>REJECT</b> click: <a href="${rejectLink}">REJECT</a></p>`,
    });
    res.status(200).json({ message: "Request submitted successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error sending email to admin" });
  }
});

// 🔹 Accept request → send resume
app.get("/accept/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  let pendingRequests = await readRequests();
  const request = pendingRequests.find((r) => r.id === id);
  if (!request) return res.send("Request not found or already processed");

  try {
    await transporter.sendMail({
      from: `"Sufiyan Khan" <${process.env.VERIFIED_EMAIL}>`,
      to: request.email,
      subject: "Here’s my Resume!",
      text: "Hello! Please find my resume attached.",
      attachments: [
        {
          filename: "Sufiyan_KhanResume.pdf",
          path: "./Sufiyan_KhanResume.pdf",
        },
      ],
    });

    pendingRequests = pendingRequests.filter((r) => r.id !== id);
    await writeRequests(pendingRequests);
    res.send("✅ Resume sent to visitor successfully!");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Error sending resume");
  }
});

// 🔹 Reject request → notify visitor
app.get("/reject/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  let pendingRequests = await readRequests();
  const request = pendingRequests.find((r) => r.id === id);
  if (!request) return res.send("Request not found or already processed");

  try {
    await transporter.sendMail({
      from: `"Sufiyan Khan" <${process.env.VERIFIED_EMAIL}>`,
      to: request.email,
      subject: "Resume Request Update",
      html: `<p>Hello <b>${request.name}</b>,</p>
             <p>Unfortunately, your request for my resume was rejected.</p>
             <p>Thanks for your interest!</p>`,
    });

    pendingRequests = pendingRequests.filter((r) => r.id !== id);
    await writeRequests(pendingRequests);
    res.send("❌ Resume request rejected and visitor notified.");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Error rejecting request");
  }
});

// 🔹 Pending requests API
app.get("/pending-requests", async (req, res) => {
  const pendingRequests = await readRequests();
  res.json(pendingRequests);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
