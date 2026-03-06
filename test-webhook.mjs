#!/usr/bin/env node

const BASE_URL = "http://localhost:3000/api/webhook";

async function testWebhook() {
  console.log("🧪 Testing WhatsApp Webhook System\n");

  // Test 1: Verify webhook (GET)
  console.log("1️⃣ Testing webhook verification (GET)...");
  try {
    const response = await fetch(
      `${BASE_URL}?hub.mode=subscribe&hub.verify_token=${process.env.VERIFY_TOKEN || "test_token"}&hub.challenge=test_challenge_123`
    );
    const text = await response.text();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${text}\n`);
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`);
  }

  // Test 2: Send test message (POST)
  console.log("2️⃣ Testing message webhook (POST)...");
  try {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "+1234567890",
                    type: "text",
                    text: {
                      body: "order for pizza",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${JSON.stringify(data, null, 2)}\n`);
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`);
  }

  console.log("✅ Testing complete!");
}

testWebhook();
