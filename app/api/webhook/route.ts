"use client";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = 'force-dynamic';
const prisma = new PrismaClient();

// 1. Define the interface for your temporary state data
interface TempData {
  productId?: number;
  productName?: string;
  price?: number;
  quantity?: number;
  name?: string;
  address?: string;
  total?: number;
}

// --- 1. ADMIN & VERIFICATION (GET) ---
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  try {
    const orders = await prisma.order.findMany({
      include: {
        user: true,
        items: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(orders);
  } catch (error) {
    // Fixed: Log the error and remove unused variable warning
    console.error("Admin Fetch Error:", error);
    return NextResponse.json({ error: "Forbidden or Error" }, { status: 403 });
  }
}

// --- 2. MESSAGE HANDLING (POST) ---
export async function POST(request: Request) {
  console.log("🔔 --- NEW WEBHOOK REQUEST RECEIVED ---");

  try {
    const body = await request.json();
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message || message.type !== "text") {
      console.log("ℹ️ Status update or non-text message ignored.");
      return NextResponse.json({ status: "ignored" });
    }

    const customerPhone = message.from;
    const msgText = message.text.body.trim();
    console.log(`📩 Message from ${customerPhone}: "${msgText}"`);

    const user = await prisma.user.upsert({
      where: { phoneNumber: customerPhone },
      update: {},
      create: { phoneNumber: customerPhone, lastState: "IDLE" },
    });

    let reply = "";
    let nextState = user.lastState;
    
    // 2. Safely parse tempData using our Interface
    let tempData: TempData = JSON.parse((user.tempData as string) || "{}");

    // FLOW LOGIC
    switch (user.lastState) {
      case "IDLE":
        reply = "Welcome! 😊\n\nඅලුත් Order එකක් දාන්න '1' එවන්න.\nවැඩි විස්තර සඳහා '2' එවන්න.";
        nextState = "AWAITING_SERVICE_CHOICE";
        break;

      case "AWAITING_SERVICE_CHOICE":
        if (msgText === "1") {
          const products = await prisma.product.findMany();
          const productList = products.map(p => `${p.id}. ${p.name} - Rs. ${p.price}`).join("\n");
          reply = `අපේ නිෂ්පාදන:\n\n${productList}\n\nඅවශ්‍ය නිෂ්පාදනයේ අංකය එවන්න.`;
          nextState = "AWAITING_PRODUCT_SELECTION";
        } else {
          reply = "ස්තුතියි අප හා සම්බන්ධ වීම ගැන!";
          nextState = "IDLE";
        }
        break;

      case "AWAITING_PRODUCT_SELECTION":
        const product = await prisma.product.findUnique({ where: { id: parseInt(msgText) } });
        if (product) {
          tempData.productId = product.id;
          tempData.productName = product.name;
          tempData.price = Number(product.price);
          reply = `ඔබ තෝරාගත්තේ: ${product.name}\nමිල: Rs. ${product.price}\n\nතහවුරු කිරීමට 'YES' එවන්න.`;
          nextState = "AWAITING_PRODUCT_CONFIRMATION";
        } else {
          reply = "කරුණාකර වලංගු අංකයක් එවන්න.";
        }
        break;

      case "AWAITING_PRODUCT_CONFIRMATION":
        if (msgText.toUpperCase() === "YES") {
          reply = "ප්‍රමාණය (Quantity) කීයක් අවශ්‍යද?";
          nextState = "AWAITING_QUANTITY";
        } else {
          reply = "අවලංගු කරන ලදී. නැවත ආරම්භ කිරීමට 'Hi' එවන්න.";
          nextState = "IDLE";
        }
        break;

      case "AWAITING_QUANTITY":
        tempData.quantity = parseInt(msgText);
        reply = "ඔබේ නම එවන්න.";
        nextState = "AWAITING_NAME";
        break;

      case "AWAITING_NAME":
        tempData.name = msgText;
        reply = "භාණ්ඩ එවිය යුතු ලිපිනය (Address) එවන්න.";
        nextState = "AWAITING_ADDRESS";
        break;

      case "AWAITING_ADDRESS":
        tempData.address = msgText;
        tempData.total = (tempData.price || 0) * (tempData.quantity || 1);
        reply = `විස්තර පරීක්ෂා කරන්න:\n📦 Item: ${tempData.productName}\n🔢 Qty: ${tempData.quantity}\n💰 Total: Rs. ${tempData.total}\n👤 Name: ${tempData.name}\n📍 Address: ${tempData.address}\n\nසියල්ල නිවැරදි නම් 'CONFIRM' එවන්න.`;
        nextState = "AWAITING_FINAL_CONFIRMATION";
        break;

      case "AWAITING_FINAL_CONFIRMATION":
        if (msgText.toUpperCase() === "CONFIRM") {
          await prisma.$transaction(async (tx) => {
            if (!tempData.productId || !tempData.total) return;
            
            await tx.order.create({
              data: {
                userId: user.id,
                totalAmount: tempData.total.toString(),
                status: "CONFIRMED",
                items: { create: { productId: tempData.productId, quantity: tempData.quantity || 1 } }
              }
            });
            await tx.user.update({
              where: { id: user.id },
              data: { 
                name: tempData.name || "", 
                address: tempData.address || "" 
              }
            });
          });
          reply = "සාර්ථකයි! ✅ ඔබේ ඇණවුම ලැබුණා.";
          nextState = "IDLE";
          tempData = {};
        } else {
          reply = "'CONFIRM' හෝ 'CANCEL' ලෙස එවන්න.";
        }
        break;
    }

    // UPDATE STATE & DB
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        lastState: nextState, 
        tempData: JSON.stringify(tempData) 
      }
    });

    await sendWhatsAppMessage(customerPhone, reply);
    return NextResponse.json({ status: "success" });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ ERROR:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// --- 3. HELPER: SEND WHATSAPP MESSAGE ---
async function sendWhatsAppMessage(to: string, text: string) {
  const url = `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: text },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Meta API Error:", JSON.stringify(errorData, null, 2));
    }
  } catch (err) {
    console.error("❌ Fetch Error:", err);
  }
}